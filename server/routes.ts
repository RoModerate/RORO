import "./env";
import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomBytes, createHmac, createHash } from "crypto";
import { botManager } from "./discord-bot-manager";
import { encryptToken, decryptToken } from "./encryption";
import { robloxCloud } from "./roblox-cloud";
import { isDatabaseAvailable, pool } from "./db";

// Discord OAuth configuration
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET!;

// Get dynamic redirect URI based on environment
function getRedirectUri(): string {
  // Always use the .env configured redirect URI for consistency
  if (process.env.DISCORD_REDIRECT_URI) {
    console.log('[OAuth] Using configured DISCORD_REDIRECT_URI:', process.env.DISCORD_REDIRECT_URI);
    return process.env.DISCORD_REDIRECT_URI;
  }
  
  // Fallback to dynamic Replit domain
  if (process.env.REPLIT_DEV_DOMAIN) {
    const uri = `https://${process.env.REPLIT_DEV_DOMAIN}/api/auth/discord/callback`;
    console.log('[OAuth] Using REPLIT_DEV_DOMAIN:', uri);
    return uri;
  }
  
  // Try REPLIT_DOMAINS as backup
  const replitDomain = process.env.REPLIT_DOMAINS?.split(',')[0];
  if (replitDomain) {
    const uri = `https://${replitDomain}/api/auth/discord/callback`;
    console.log('[OAuth] Using REPLIT_DOMAINS:', uri);
    return uri;
  }
  
  // Fallback to localhost for local development
  const uri = 'http://localhost:5000/api/auth/discord/callback';
  console.log('[OAuth] Using localhost fallback:', uri);
  return uri;
}

// Session storage (in-memory for development)
const sessions = new Map<string, { userId: string; expiresAt: number }>();
const adminSessions = new Map<string, string>(); // Maps session token to admin ID

// OAuth state storage for CSRF protection (nonce-based)
const oauthStates = new Map<string, { expiresAt: number }>();

// WebSocket clients
const wsClients = new Set<WebSocket>();

// Helper: Generate session token
function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

// Helper: Create session
function createSession(userId: string): string {
  const token = generateSessionToken();
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  sessions.set(token, { userId, expiresAt });
  return token;
}

// Helper: Get user from session
async function getUserFromSession(token: string | undefined) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return await storage.getUser(session.userId);
}

// Helper: Broadcast to WebSocket clients
function broadcastToClients(data: any) {
  const message = JSON.stringify(data);
  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Helper: Call ban appeal webhook
async function callBanAppealWebhook(webhookUrl: string, appeal: any, ban: any, action: 'created' | 'updated') {
  const payload = {
    appealId: appeal.id,
    action,
    status: appeal.status,
    userId: ban.discordUserId,
    userRobloxId: ban.robloxUserId,
    robloxUsername: ban.robloxUsername,
    reason: ban.reason,
    appealText: appeal.appealText,
    reviewNote: appeal.reviewNote,
    timestamp: new Date().toISOString(),
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Webhook returned status ${response.status}`);
    }

    console.log(`[Appeal Webhook] Successfully called webhook for appeal ${appeal.id}`);
    return { success: true };
  } catch (error: any) {
    console.error(`[Appeal Webhook] Failed to call webhook:`, error.message);
    
    // Retry once on failure with same full payload
    try {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      if (response.ok) {
        console.log(`[Appeal Webhook] Successfully called webhook on retry for appeal ${appeal.id}`);
        return { success: true };
      }
    } catch (retryError: any) {
      console.error(`[Appeal Webhook] Retry also failed:`, retryError.message);
    }

    return { success: false, error: error.message };
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // WebSocket setup - Reference: javascript_websocket blueprint
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('[WebSocket] Client connected. Total clients:', wsClients.size + 1);
    wsClients.add(ws);
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'Connected to Ro Moderate real-time updates',
      timestamp: new Date().toISOString(),
    }));
    
    ws.on('close', () => {
      wsClients.delete(ws);
      console.log('[WebSocket] Client disconnected. Total clients:', wsClients.size);
    });

    ws.on('error', (error) => {
      console.error('[WebSocket] Error:', error);
    });
  });

  // ===== HEALTH CHECK ENDPOINT =====
  
  app.get("/api/health", async (_req, res) => {
    try {
      const health: any = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: {
          available: isDatabaseAvailable(),
          connected: false,
        },
        bot: {
          online: botManager.isCentralizedBotOnline(),
        },
        websocket: {
          clients: wsClients.size,
        },
      };

      // Test database connection
      if (isDatabaseAvailable() && pool) {
        try {
          await pool.query('SELECT 1');
          health.database.connected = true;
        } catch (error: any) {
          health.database.connected = false;
          health.database.error = error.message;
        }
      }

      // Determine overall status
      if (!health.database.available) {
        health.status = "degraded";
        health.warnings = ["Database not configured - using in-memory storage"];
      } else if (!health.database.connected) {
        health.status = "degraded";
        health.warnings = ["Database connection failed"];
      }

      const statusCode = health.status === "healthy" ? 200 : 503;
      res.status(statusCode).json(health);
    } catch (error: any) {
      res.status(500).json({
        status: "unhealthy",
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ===== AUTHENTICATION ROUTES =====
  
  // Discord OAuth - Initiate
  app.get("/api/auth/discord", (req, res) => {
    console.log('[OAuth] Starting Discord OAuth flow');
    
    // Generate CSRF state token and encode invite + returnTo if present
    const inviteCode = req.query.invite as string | undefined;
    const returnTo = req.query.returnTo as string | undefined;
    const stateData = {
      nonce: randomBytes(16).toString("hex"),
      invite: inviteCode || null,
      returnTo: returnTo || null,
    };
    const state = Buffer.from(JSON.stringify(stateData)).toString("base64url");
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    oauthStates.set(stateData.nonce, { expiresAt });
    
    // Use the exact redirect URI from .env
    const redirectUri = process.env.DISCORD_REDIRECT_URI!;
    console.log('[OAuth] Redirect URI:', redirectUri);
    console.log('[OAuth] Client ID:', DISCORD_CLIENT_ID);
    console.log('[OAuth] State:', state);
    console.log('[OAuth] Return To:', returnTo);
    
    const scopes = ["identify", "guilds"].join("%20");
    const redirectUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&state=${state}`;
    
    console.log('[OAuth] Redirecting to Discord:', redirectUrl);
    res.redirect(redirectUrl);
  });

  // Discord OAuth - Callback
  app.get("/api/auth/discord/callback", async (req, res) => {
    const { code, state, error: oauthError } = req.query;
    
    console.log('[OAuth Callback] Received callback');
    console.log('[OAuth Callback] Code:', code ? 'present' : 'missing');
    console.log('[OAuth Callback] State:', state ? 'present' : 'missing');
    console.log('[OAuth Callback] Error:', oauthError || 'none');
    console.log('[OAuth Callback] Full URL:', req.url);
    console.log('[OAuth Callback] Headers:', JSON.stringify(req.headers));
    
    if (oauthError) {
      console.error('[OAuth Callback] OAuth error from Discord:', oauthError);
      return res.redirect("/?error=oauth_failed&details=" + encodeURIComponent(oauthError as string));
    }
    
    if (!code) {
      console.error('[OAuth Callback] Missing authorization code');
      return res.redirect("/?error=missing_code");
    }

    if (!state) {
      console.error('[OAuth Callback] Missing state parameter');
      return res.redirect("/?error=missing_state");
    }

    // Decode and verify state (includes nonce for CSRF protection + invite code + returnTo)
    let inviteCode: string | null = null;
    let returnTo: string | null = null;
    try {
      const stateData = JSON.parse(Buffer.from(state as string, "base64url").toString());
      console.log('[OAuth Callback] Decoded state:', stateData);
      
      // Strict nonce verification for CSRF protection
      const storedState = oauthStates.get(stateData.nonce);
      if (!storedState) {
        console.error('[OAuth Callback] State nonce not found - possible CSRF or expired session');
        return res.redirect("/?error=invalid_state");
      }
      if (storedState.expiresAt < Date.now()) {
        oauthStates.delete(stateData.nonce);
        console.error('[OAuth Callback] State expired');
        return res.redirect("/?error=state_expired");
      }
      
      // Extract invite code and returnTo from state
      inviteCode = stateData.invite;
      returnTo = stateData.returnTo;
      oauthStates.delete(stateData.nonce);
      console.log('[OAuth Callback] State verified successfully', { returnTo });
    } catch (error) {
      console.error('[OAuth Callback] State decode error:', error);
      return res.redirect("/?error=invalid_state_format");
    }

    try {
      // Use the exact redirect URI from .env
      const redirectUri = process.env.DISCORD_REDIRECT_URI!;
      
      console.log('[OAuth] Token exchange attempt:', {
        client_id: DISCORD_CLIENT_ID,
        redirect_uri: redirectUri,
        has_secret: !!DISCORD_CLIENT_SECRET,
        has_code: !!code,
      });
      
      // Exchange code for token
      const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: DISCORD_CLIENT_ID,
          client_secret: DISCORD_CLIENT_SECRET,
          grant_type: "authorization_code",
          code: code as string,
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('[OAuth] Token exchange failed:', {
          status: tokenResponse.status,
          statusText: tokenResponse.statusText,
          error: errorText,
        });
        return res.redirect(`/?error=token_exchange_failed&status=${tokenResponse.status}`);
      }

      const tokens = await tokenResponse.json();
      console.log('[OAuth] Token response received:', { has_access_token: !!tokens.access_token, has_refresh_token: !!tokens.refresh_token });
      
      if (!tokens.access_token) {
        console.error('[OAuth] No access token in response:', tokens);
        return res.redirect('/?error=no_access_token');
      }

      // Get user info
      const userResponse = await fetch("https://discord.com/api/users/@me", {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });

      const discordUser = await userResponse.json();

      // Get user's guilds
      const guildsResponse = await fetch("https://discord.com/api/users/@me/guilds", {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });

      const guilds = await guildsResponse.json();

      // Find or create user
      let user = await storage.getUserByDiscordId(discordUser.id);
      
      if (!user) {
        user = await storage.createUser({
          discordId: discordUser.id,
          username: discordUser.username,
          discriminator: discordUser.discriminator || null,
          avatar: discordUser.avatar,
          email: discordUser.email,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tosAcceptedAt: null,
        });
      } else {
        user = await storage.updateUser(user.id, {
          username: discordUser.username,
          avatar: discordUser.avatar,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
        })!;
      }

      // Handle invite code redemption first to determine if we should sync all servers
      let inviteProcessed = false;
      if (user && inviteCode) {
        const invite = await storage.getInviteCodeByCode(inviteCode);
        
        if (invite) {
          // Check if invite is valid
          const isExpired = invite.expiresAt && new Date(invite.expiresAt) < new Date();
          const maxUsesReached = invite.maxUses && invite.currentUses >= invite.maxUses;
          
          if (!isExpired && !maxUsesReached) {
            // Mark invite as processed to prevent full server sync
            inviteProcessed = true;
            
            // Check if user is already a member
            const existingMember = await storage.getServerMemberByUserAndServer(user.id, invite.serverId);
            
            if (!existingMember) {
              // Add user to server with invite's role and permissions
              await storage.createServerMember({
                serverId: invite.serverId,
                userId: user.id,
                role: invite.role,
                permissions: invite.permissions,
                invitedBy: invite.createdBy,
              });

              // Increment invite usage count
              await storage.updateInviteCode(invite.id, {
                currentUses: invite.currentUses + 1,
              });
            }
          }
        }
      }

      // Only sync all managed servers if NOT processing an invite
      // This ensures invited team members only see the server they were invited to
      if (user && !inviteProcessed) {
        const managedGuilds = guilds.filter((g: any) => (g.permissions & 0x20) === 0x20);
        
        for (const guild of managedGuilds) {
          const existingServer = await storage.getServerByDiscordId(guild.id);
          
          if (!existingServer) {
            await storage.createServer({
              discordServerId: guild.id,
              name: guild.name,
              icon: guild.icon,
              ownerId: user.id,
              settings: {},
            });
          } else if (existingServer.ownerId !== user.id) {
            await storage.updateServer(existingServer.id, {
              name: guild.name,
              icon: guild.icon,
            });
          }
        }
      }

      // Create session
      if (!user) {
        return res.status(500).send("Failed to create user");
      }
      const sessionToken = createSession(user.id);

      // Set cookie and redirect
      res.cookie("session", sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      // Validate returnTo to prevent open redirect vulnerability
      // Only allow internal paths (starting with /)
      let redirectUrl = "/";
      if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
        // Ensure it doesn't contain protocol or domain
        try {
          const url = new URL(returnTo, "http://localhost");
          if (url.hostname === "localhost") {
            redirectUrl = returnTo;
          }
        } catch {
          // Invalid URL, use default
          console.warn('[OAuth Callback] Invalid returnTo URL, using default');
        }
      }
      console.log('[OAuth Callback] Redirecting to:', redirectUrl);
      res.redirect(redirectUrl);
    } catch (error: any) {
      console.error("Discord OAuth error:", error);
      console.error("Error details:", error.message, error.response?.data);
      res.status(500).send(`Authentication failed: ${error.message || 'Unknown error'}`);
    }
  });

  // Get current user
  app.get("/api/auth/me", async (req, res) => {
    const token = req.cookies.session;
    const user = await getUserFromSession(token);
    
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Don't send sensitive fields
    const { accessToken, refreshToken, ...safeUser } = user;
    res.json(safeUser);
  });

  // Logout
  app.get("/api/auth/logout", (req, res) => {
    const token = req.cookies.session;
    if (token) {
      sessions.delete(token);
    }
    res.clearCookie("session");
    res.redirect("/");
  });

  // Accept TOS
  app.post("/api/user/accept-tos", async (req, res) => {
    const token = req.cookies.session;
    const user = await getUserFromSession(token);
    
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const updatedUser = await storage.acceptTos(user.id);
      const { accessToken, refreshToken, ...safeUser } = updatedUser;
      res.json(safeUser);
    } catch (error) {
      console.error("Error accepting TOS:", error);
      res.status(500).json({ error: "Failed to accept TOS" });
    }
  });

  // ===== MIDDLEWARE FOR AUTHENTICATED ROUTES =====
  
  const requireAuth = async (req: any, res: any, next: any) => {
    const token = req.cookies.session;
    const user = await getUserFromSession(token);
    
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    req.user = user;
    next();
  };

  // ===== ADMIN AUTHENTICATION =====

  const requireAdminAuth = async (req: any, res: any, next: any) => {
    const token = req.cookies.adminSession;
    
    if (!token || !adminSessions.has(token)) {
      return res.status(401).json({ error: "Not authenticated as admin" });
    }
    
    const adminId = adminSessions.get(token);
    req.admin = { id: adminId };
    next();
  };

  // Admin login
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }

      // Get admin from database
      const admin = await storage.getAdminByUsername(username);

      if (!admin) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Verify password
      const isValid = await bcrypt.compare(password, admin.passwordHash);

      if (!isValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Create admin session
      const token = randomBytes(32).toString('hex');
      adminSessions.set(token, admin.id);

      // Update last login time
      await storage.updateAdminLastLogin(admin.id);

      // Set secure cookie
      res.cookie('adminSession', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: 'lax',
      });

      res.json({
        id: admin.id,
        username: admin.username,
        role: admin.role,
      });
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Check admin auth status
  app.get("/api/admin/me", requireAdminAuth, async (req: any, res) => {
    try {
      const adminId = req.admin.id;
      const admin = await storage.getAdminByUsername('admin'); // This will need to be updated to get by ID
      
      if (!admin) {
        return res.status(404).json({ error: "Admin not found" });
      }

      res.json({
        id: admin.id,
        username: admin.username,
        role: admin.role,
      });
    } catch (error) {
      console.error("Admin me error:", error);
      res.status(500).json({ error: "Failed to fetch admin info" });
    }
  });

  // Admin logout
  app.post("/api/admin/logout", (req, res) => {
    const token = req.cookies.adminSession;
    if (token) {
      adminSessions.delete(token);
    }
    res.clearCookie("adminSession");
    res.json({ success: true });
  });

  // Get admin statistics
  app.get("/api/admin/stats", requireAdminAuth, async (req, res) => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      console.error("Admin stats error:", error);
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  // ===== SERVER ROUTES =====
  
  app.get("/api/servers", requireAuth, async (req: any, res) => {
    const servers = await storage.getServersByUserId(req.user.id);
    res.json(servers);
  });

  app.get("/api/servers/:id", requireAuth, async (req: any, res) => {
    const server = await storage.getServer(req.params.id);
    
    if (!server || server.ownerId !== req.user.id) {
      return res.status(404).json({ error: "Server not found" });
    }
    
    res.json(server);
  });

  // Public route to fetch server by vanity URL (sanitized data only)
  app.get("/api/public/servers/by-vanity/:vanityUrl", async (req: any, res) => {
    try {
      const { vanityUrl } = req.params;
      const servers = await storage.getAllServers();
      const server = servers.find((s: any) => s.settings?.vanityUrl === vanityUrl);
      
      if (!server) {
        return res.status(404).json({ error: "Server not found" });
      }
      
      // Return only public-safe data
      const publicData = {
        id: server.id,
        name: server.name,
        icon: server.icon,
        settings: {
          gameName: server.settings?.gameName,
          vanityUrl: server.settings?.vanityUrl,
          shortDescription: server.settings?.shortDescription,
          gameIcon: server.settings?.gameIcon,
          gameBanner: server.settings?.gameBanner,
        }
      };
      
      res.json(publicData);
    } catch (error: any) {
      console.error("Error fetching server by vanity URL:", error);
      res.status(500).json({ error: "Failed to fetch server" });
    }
  });

  // Update server (general endpoint for settings updates)
  app.patch("/api/servers/:serverId", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.params;
      const server = await storage.getServer(serverId);
      
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Deep merge helper for settings
      const deepMerge = (target: any, source: any): any => {
        const output = { ...target };
        for (const key in source) {
          if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            output[key] = deepMerge(target[key] || {}, source[key]);
          } else {
            output[key] = source[key];
          }
        }
        return output;
      };

      // If request has a settings field, deep merge it with existing settings
      const updates: any = {};
      if (req.body.settings) {
        updates.settings = deepMerge(server.settings || {}, req.body.settings);
      }

      // Merge any other top-level fields
      Object.keys(req.body).forEach(key => {
        if (key !== 'settings') {
          updates[key] = req.body[key];
        }
      });

      console.log(`[Server Update] Updating server ${serverId} with:`, Object.keys(updates));

      const updatedServer = await storage.updateServer(serverId, updates);
      res.json(updatedServer);
    } catch (error: any) {
      console.error("Server update error:", error);
      res.status(500).json({ error: error.message || "Failed to update server" });
    }
  });

  app.patch("/api/servers/:id/complete-setup", requireAuth, async (req: any, res) => {
    try {
      const server = await storage.getServer(req.params.id);
      
      if (!server || server.ownerId !== req.user.id) {
        return res.status(404).json({ error: "Server not found" });
      }

      const {
        reportsChannel,
        reportLogsChannel,
        appealsCategory,
        appealLogsChannel,
        ticketsChannel,
      } = req.body;

      // Verify the centralized bot is online
      if (!botManager.isCentralizedBotOnline()) {
        throw new Error("RoModerate bot is offline. Please wait for it to come online or contact support.");
      }

      const bot = botManager.getCentralizedBot();
      if (!bot || !bot.user) {
        throw new Error("RoModerate bot is not initialized.");
      }

      // Verify the bot has access to the server
      const guild = bot.guilds.cache.get(server.discordServerId);
      if (!guild) {
        throw new Error("RoModerate bot is not in your Discord server. Please install the bot first.");
      }

      // Generate unique bot key for bot integration (this replaces redirect URI approach)
      const botKey = `romod_${randomBytes(32).toString("hex")}`;
      
      // Generate link key for /linkkey command (128-bit hex)
      const linkKey = randomBytes(16).toString("hex").toUpperCase();
      const linkKeyExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Get bot info from centralized bot
      const botClientId = bot.user.id;
      
      // Check if bot record exists for this server
      const existingBot = await storage.getDiscordBotByServerId(server.id);
      
      if (!existingBot) {
        // Create new bot record using centralized bot info
        try {
          await storage.createDiscordBot({
            serverId: server.id,
            botTokenEncrypted: '',
            botId: bot.user.id,
            botName: bot.user.username,
            status: 'active',
            features: [],
            lastOnline: new Date(),
          });
        } catch (error) {
          console.warn('[Setup] Failed to create bot record in database, continuing with in-memory storage');
        }
      } else {
        // Update existing bot record
        try {
          await storage.updateDiscordBot(existingBot.id, {
            botId: bot.user.id,
            botName: bot.user.username,
            status: 'active',
            lastOnline: new Date(),
          });
        } catch (error) {
          console.warn('[Setup] Failed to update bot record in database, continuing with in-memory storage');
        }
      }

      // Update server settings AND link key
      const updated = await storage.updateServer(server.id, {
        linkKey,
        linkKeyExpiresAt,
        settings: {
          ...server.settings,
          setupCompleted: true,
          botClientId,
          botKey,
          reportsChannel,
          reportLogsChannel,
          appealsCategory,
          appealLogsChannel,
          ticketsChannel,
        },
      } as any);

      // Mark user's onboarding as completed
      await storage.updateUser(req.user.id, {
        onboardingCompleted: true,
      });

      res.json({
        server: updated,
        botKey,
        linkKey, // Send link key for /linkkey command
        linkKeyExpiresAt,
      });
    } catch (error: any) {
      console.error("Setup error:", error);
      res.status(500).json({ error: error.message || "Failed to complete setup" });
    }
  });

  // Bot Token (Onboarding Step 4)
  app.patch("/api/servers/:serverId/bot-token", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.params;
      const { botToken, botClientId, skipToken } = req.body;

      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // If skipping token, just update settings to mark as skipped
      if (skipToken) {
        const updated = await storage.updateServer(server.id, {
          settings: {
            ...server.settings,
            customBotConfigured: false,
          },
        });
        return res.json({ success: true, server: updated });
      }

      // If bot token provided, validate and save it
      if (botToken) {
        console.log(`[Bot Token] Verifying custom bot token for server ${serverId}...`);
        
        let verifyResponse;
        try {
          verifyResponse = await fetch("https://discord.com/api/v10/users/@me", {
            headers: {
              Authorization: `Bot ${botToken}`,
            },
          });
        } catch (error: any) {
          console.error(`[Bot Token] Network error during verification:`, error);
          return res.status(503).json({ 
            error: "Could not connect to Discord API. Please check your internet connection and try again.",
            details: error.message 
          });
        }

        if (!verifyResponse.ok) {
          console.error(`[Bot Token] Verification failed: ${verifyResponse.status} ${verifyResponse.statusText}`);
          
          // Provide specific error messages based on status code
          let errorMessage = "Invalid bot token. Please check your bot token and try again.";
          let errorDetails = "";
          
          switch (verifyResponse.status) {
            case 401:
              errorMessage = "Invalid bot token format or unauthorized token.";
              errorDetails = "Make sure you copied the complete bot token from the Discord Developer Portal. The token should start with a string of characters followed by a dot.";
              break;
            case 403:
              errorMessage = "Bot token is valid but lacks necessary permissions.";
              errorDetails = "Ensure your bot has the required intents enabled in the Discord Developer Portal (Presence Intent, Server Members Intent, Message Content Intent).";
              break;
            case 429:
              errorMessage = "Too many verification attempts. Please wait a moment and try again.";
              errorDetails = "Discord has rate-limited token verification requests. Wait 30-60 seconds before trying again.";
              break;
            case 500:
            case 502:
            case 503:
            case 504:
              errorMessage = "Discord API is currently unavailable.";
              errorDetails = "This is a temporary Discord service issue. Please try again in a few minutes.";
              break;
            default:
              errorMessage = `Bot token verification failed (HTTP ${verifyResponse.status}).`;
              errorDetails = "Please verify your bot token is correct and try again.";
          }
          
          console.error(`[Bot Token] Error details: ${errorMessage} - ${errorDetails}`);
          return res.status(400).json({ 
            error: errorMessage,
            details: errorDetails,
            statusCode: verifyResponse.status 
          });
        }

        const botData = await verifyResponse.json();
        console.log(`[Bot Token] ✓ Bot verified: ${botData.username} (ID: ${botData.id})`);

        const encryptedToken = encryptToken(botToken);

        // Create or update bot record (gracefully handle database unavailability)
        try {
          const existingBot = await storage.getDiscordBotByServerId(serverId);

          if (existingBot) {
            await storage.updateDiscordBot(existingBot.id, {
              botTokenEncrypted: encryptedToken,
              botId: botData.id,
              botName: botData.username,
              status: "pending",
              lastOnline: new Date(),
            });
          } else {
            await storage.createDiscordBot({
              serverId,
              botTokenEncrypted: encryptedToken,
              botId: botData.id,
              botName: botData.username,
              status: "pending",
              features: [],
              lastOnline: new Date(),
            });
          }
        } catch (dbError: any) {
          console.warn('[Bot Token] Failed to save bot to database (using in-memory storage):', dbError.message);
        }

        // Start the bot
        console.log(`[Bot Token] Starting custom Discord bot...`);
        const botStarted = await botManager.startBot(serverId, botToken, server.discordServerId);

        if (botStarted) {
          console.log(`[Bot Token] Custom bot ${botData.username} is now ONLINE for server ${serverId}`);
        } else {
          console.warn(`[Bot Token] Custom bot saved but failed to start - user can restart later`);
        }

        // Update server settings
        const updated = await storage.updateServer(server.id, {
          settings: {
            ...server.settings,
            customBotConfigured: true,
            customBotClientId: botClientId || botData.id,
          },
        });

        return res.json({
          success: true,
          message: botStarted ? "Custom bot is now online" : "Custom bot token saved (will start on next server restart)",
          botName: botData.username,
          botOnline: botStarted,
          server: updated,
        });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Bot token config error:", error);
      res.status(500).json({ error: error.message || "Failed to configure bot token" });
    }
  });

  // Generate Link Key
  app.post("/api/servers/:serverId/generate-link-key", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.params;
      const server = await storage.getServer(serverId);
      
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized - only owners can generate link keys" });
      }

      // Generate secure link key (128-bit = 32 hex characters)
      const linkKey = randomBytes(16).toString("hex").toUpperCase();
      
      // Set expiration to 24 hours from now
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Update server with link key
      const updated = await storage.updateServer(server.id, {
        linkKey,
        linkKeyExpiresAt: expiresAt,
      } as any);

      console.log(`[Link Key] Generated secure 128-bit link key for server ${serverId}`);

      res.json({
        linkKey,
        expiresAt,
        server: updated,
      });
    } catch (error: any) {
      console.error("Generate link key error:", error);
      res.status(500).json({ error: error.message || "Failed to generate link key" });
    }
  });

  // Reset Bot Key
  app.post("/api/servers/:serverId/reset-bot-key", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.params;
      const server = await storage.getServer(serverId);
      
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized - only owners can reset bot keys" });
      }

      // Generate new bot key
      const newBotKey = `romod_${randomBytes(32).toString("hex")}`;

      // Update server settings with new key
      const updated = await storage.updateServer(server.id, {
        settings: {
          ...server.settings,
          botKey: newBotKey,
        },
      });

      res.json({
        server: updated,
        botKey: newBotKey,
      });
    } catch (error: any) {
      console.error("Reset bot key error:", error);
      res.status(500).json({ error: error.message || "Failed to reset bot key" });
    }
  });

  // Update Bot Token
  app.patch("/api/servers/:serverId/update-bot-token", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.params;
      const { botToken } = req.body;

      if (!botToken) {
        return res.status(400).json({ error: "Bot token is required" });
      }

      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized - only owners can update bot tokens" });
      }

      console.log(`[Update Bot Token] Verifying bot token for server ${serverId}...`);
      const verifyResponse = await fetch("https://discord.com/api/v10/users/@me", {
        headers: {
          Authorization: `Bot ${botToken}`,
        },
      });

      if (!verifyResponse.ok) {
        console.error(`[Update Bot Token] Verification failed: ${verifyResponse.status}`);
        return res.status(400).json({ error: "Invalid bot token. Please check your bot token and try again." });
      }

      const botData = await verifyResponse.json();
      console.log(`[Update Bot Token] Bot verified: ${botData.username} (ID: ${botData.id})`);

      const encryptedToken = encryptToken(botToken);

      const existingBot = await storage.getDiscordBotByServerId(serverId);

      if (existingBot) {
        console.log(`[Update Bot Token] Updating existing bot...`);
        await storage.updateDiscordBot(existingBot.id, {
          botTokenEncrypted: encryptedToken,
          botId: botData.id,
          botName: botData.username,
          status: "active",
          lastOnline: new Date(),
        });
      } else {
        console.log(`[Update Bot Token] Creating new bot record...`);
        await storage.createDiscordBot({
          serverId,
          botTokenEncrypted: encryptedToken,
          botId: botData.id,
          botName: botData.username,
          status: "active",
          features: [],
          lastOnline: new Date(),
        });
      }

      console.log(`[Update Bot Token] Starting Discord bot...`);
      const botStarted = await botManager.startBot(serverId, botToken, server.discordServerId);
      
      if (!botStarted) {
        console.error(`[Update Bot Token] Failed to start bot`);
        return res.status(500).json({ error: "Bot token is valid but failed to start the bot. Please try again." });
      }

      console.log(`[Update Bot Token] Successfully started bot for server ${serverId} - Bot is now ONLINE`);

      res.json({
        success: true,
        message: "Bot token updated and bot is now online",
        botName: botData.username,
      });
    } catch (error: any) {
      console.error("Update bot token error:", error);
      res.status(500).json({ error: error.message || "Failed to update bot token" });
    }
  });

  // ===== ANALYTICS ROUTES =====
  
  app.get("/api/analytics", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.query;
      if (!serverId) {
        return res.status(400).json({ error: "serverId required" });
      }

      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const bans = await storage.getBansByServerId(serverId);
      const appeals = await storage.getAppealsByServerId(serverId);
      const tickets = await storage.getTicketsByServerId(serverId);

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const activeBans = bans.filter(b => b.isActive);
      const pendingAppeals = appeals.filter(a => a.status === "pending");
      const openTickets = tickets.filter(t => t.status === "open");

      const bansLast30Days = bans.filter(b => new Date(b.createdAt) >= thirtyDaysAgo).length;
      const appealsLast30Days = appeals.filter(a => new Date(a.createdAt) >= thirtyDaysAgo).length;
      const ticketsLast30Days = tickets.filter(t => new Date(t.createdAt) >= thirtyDaysAgo).length;

      res.json({
        totalBans: bans.length,
        activeBans: activeBans.length,
        totalAppeals: appeals.length,
        pendingAppeals: pendingAppeals.length,
        totalTickets: tickets.length,
        openTickets: openTickets.length,
        trends: {
          bansLast30Days,
          appealsLast30Days,
          ticketsLast30Days,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch analytics" });
    }
  });

  // ===== MODERATOR SHIFT ROUTES =====

  // Start a new shift
  app.post("/api/shifts/start", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.body;
      
      if (!serverId) {
        return res.status(400).json({ error: "serverId required" });
      }

      // Verify user owns server or is a member
      const server = await storage.getServer(serverId);
      if (!server) {
        return res.status(404).json({ error: "Server not found" });
      }
      
      const isOwner = server.ownerId === req.user.id;
      const isMember = await storage.getServerMemberByUserAndServer(req.user.id, serverId);
      
      if (!isOwner && !isMember) {
        return res.status(403).json({ error: "Not authorized - you must be a member of this server" });
      }

      // Check if user has an active shift
      const activeShift = await storage.getActiveShiftByUserId(req.user.id, serverId);
      if (activeShift) {
        return res.status(400).json({ 
          error: "You already have an active shift",
          shiftId: activeShift.id,
        });
      }

      const shift = await storage.createShift({
        serverId,
        userId: req.user.id,
        startTime: new Date(),
        endTime: null,
        status: 'active',
        metrics: {
          actionsCount: 0,
          bansIssued: 0,
          appealsReviewed: 0,
          ticketsHandled: 0,
          reportsProcessed: 0,
        },
      });

      broadcastToClients({
        type: 'shift_started',
        serverId,
        userId: req.user.id,
        shiftId: shift.id,
      });

      res.json(shift);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to start shift" });
    }
  });

  // End current shift
  app.post("/api/shifts/end", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.body;
      
      if (!serverId) {
        return res.status(400).json({ error: "serverId required" });
      }

      // Verify user owns server or is a member
      const server = await storage.getServer(serverId);
      if (!server) {
        return res.status(404).json({ error: "Server not found" });
      }
      
      const isOwner = server.ownerId === req.user.id;
      const isMember = await storage.getServerMemberByUserAndServer(req.user.id, serverId);
      
      if (!isOwner && !isMember) {
        return res.status(403).json({ error: "Not authorized - you must be a member of this server" });
      }

      const activeShift = await storage.getActiveShiftByUserId(req.user.id, serverId);
      if (!activeShift) {
        return res.status(404).json({ error: "No active shift found" });
      }

      const endTime = new Date();
      const updated = await storage.updateShift(activeShift.id, {
        endTime,
        status: 'completed',
      });

      broadcastToClients({
        type: 'shift_ended',
        serverId,
        userId: req.user.id,
        shiftId: activeShift.id,
        duration: endTime.getTime() - new Date(activeShift.startTime).getTime(),
      });

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to end shift" });
    }
  });

  // Get active shift for current user
  app.get("/api/shifts/active", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.query;
      
      if (!serverId) {
        return res.status(400).json({ error: "serverId required" });
      }

      // Verify user owns server or is a member
      const server = await storage.getServer(serverId as string);
      if (!server) {
        return res.status(404).json({ error: "Server not found" });
      }
      
      const isOwner = server.ownerId === req.user.id;
      const isMember = await storage.getServerMemberByUserAndServer(req.user.id, serverId as string);
      
      if (!isOwner && !isMember) {
        return res.status(403).json({ error: "Not authorized - you must be a member of this server" });
      }

      const activeShift = await storage.getActiveShiftByUserId(req.user.id, serverId as string);
      res.json(activeShift);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch active shift" });
    }
  });

  // Get shift history
  app.get("/api/shifts", requireAuth, async (req: any, res) => {
    try {
      const { serverId, userId, status, limit } = req.query;
      
      if (!serverId) {
        return res.status(400).json({ error: "serverId required" });
      }

      const server = await storage.getServer(serverId as string);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const options: any = {};
      if (userId) options.userId = userId;
      if (status) options.status = status;
      if (limit) options.limit = parseInt(limit as string);

      const shifts = await storage.getShiftsByServerId(serverId as string, options);
      res.json(shifts);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch shifts" });
    }
  });

  // ===== BAN MANAGEMENT ROUTES =====
  
  app.get("/api/bans", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.query;
      if (!serverId) {
        return res.status(400).json({ error: "serverId required" });
      }

      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const bans = await storage.getBansByServerId(serverId);
      res.json(bans);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch bans" });
    }
  });

  app.post("/api/bans", requireAuth, async (req: any, res) => {
    try {
      const { serverId, robloxUserId, robloxUsername, discordUserId, reason, expiresAt, metadata } = req.body;

      if (!serverId || !robloxUserId || !robloxUsername || !reason) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const ban = await storage.createBan({
        serverId,
        robloxUserId,
        robloxUsername,
        discordUserId: discordUserId || null,
        reason,
        bannedBy: req.user.id,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: true,
        metadata: metadata || null,
      });

      broadcastToClients({
        type: "ban_created",
        banId: ban.id,
        serverId,
      });

      res.json(ban);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create ban" });
    }
  });

  app.patch("/api/bans/:id", requireAuth, async (req: any, res) => {
    try {
      const ban = await storage.getBan(req.params.id);
      if (!ban) {
        return res.status(404).json({ error: "Ban not found" });
      }

      const server = await storage.getServer(ban.serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const updated = await storage.updateBan(req.params.id, req.body);
      
      broadcastToClients({
        type: "ban_updated",
        banId: req.params.id,
      });

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update ban" });
    }
  });

  // ===== APPEAL MANAGEMENT ROUTES =====

  app.get("/api/appeals", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.query;
      if (!serverId) {
        return res.status(400).json({ error: "serverId required" });
      }

      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const appeals = await storage.getAppealsByServerId(serverId);
      res.json(appeals);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch appeals" });
    }
  });

  app.post("/api/appeals", requireAuth, async (req: any, res) => {
    try {
      const { banId, serverId, discordUserId, appealText } = req.body;

      if (!banId || !serverId || !appealText) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const appeal = await storage.createAppeal({
        banId,
        serverId,
        discordUserId: discordUserId || null,
        appealText,
        status: "pending",
        reviewedBy: null,
        reviewNote: null,
        reviewedAt: null,
      });

      broadcastToClients({
        type: "appeal_created",
        appealId: appeal.id,
        serverId,
      });

      // Call ban appeal webhook if configured
      const server = await storage.getServer(serverId);
      const ban = await storage.getBan(banId);
      const webhookUrl = server?.settings?.banAppealWebhook;
      if (webhookUrl && ban) {
        callBanAppealWebhook(webhookUrl, appeal, ban, 'created').catch((error) => {
          console.error(`[Appeal] Webhook call failed for appeal ${appeal.id}:`, error);
        });
      }

      res.json(appeal);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create appeal" });
    }
  });

  app.patch("/api/appeals/:id", requireAuth, async (req: any, res) => {
    try {
      const appeal = await storage.getAppeal(req.params.id);
      if (!appeal) {
        return res.status(404).json({ error: "Appeal not found" });
      }

      const server = await storage.getServer(appeal.serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const { status, reviewNote } = req.body;

      // Get the original ban
      const ban = await storage.getBan(appeal.banId);
      if (!ban) {
        return res.status(404).json({ error: "Associated ban not found" });
      }

      // Declare robloxUnbanResult outside the if block so it's accessible later
      let robloxUnbanResult: { success: boolean; error?: string } | null = null;

      // If appeal is approved, unban the user
      if (status === "approved") {
        console.log(`[Appeal] Approving appeal ${req.params.id} - unbanning user ${ban.robloxUsername}`);
        
        // Deactivate the ban in our system
        await storage.updateBan(ban.id, {
          isActive: false,
        });

        // If Roblox API is configured, unban in Roblox too
        const serverSettings = server.settings as any;
        const robloxApiKey = serverSettings?.robloxApiKey;
        const robloxUniverseId = serverSettings?.robloxUniverseId;
        if (robloxApiKey && robloxUniverseId) {
          console.log(`[Appeal] Removing Roblox ban for user ${ban.robloxUserId}`);
          robloxUnbanResult = await robloxCloud.unbanUser({
            universeId: robloxUniverseId,
            userId: ban.robloxUserId,
            apiKey: robloxApiKey,
          });

          if (robloxUnbanResult.success) {
            console.log(`[Appeal] ✓ Successfully unbanned ${ban.robloxUsername} in Roblox`);
          } else {
            console.error(`[Appeal] Failed to unban in Roblox:`, robloxUnbanResult.error);
          }
        }

        // Update the ban metadata with unban info
        await storage.updateBan(ban.id, {
          metadata: {
            ...(ban.metadata || {}),
            unbannedViaAppeal: true,
            appealId: appeal.id,
            robloxUnbanResult: robloxUnbanResult ? {
              success: robloxUnbanResult.success,
              timestamp: new Date().toISOString(),
              error: robloxUnbanResult.error,
            } : undefined,
          },
        });

        broadcastToClients({
          type: "ban_removed",
          banId: ban.id,
          serverId: server.id,
          robloxUsername: ban.robloxUsername,
          reason: "Appeal approved",
        });
      }

      // Update the appeal
      const updated = await storage.updateAppeal(req.params.id, {
        status,
        reviewNote,
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
      });

      broadcastToClients({
        type: "appeal_updated",
        appealId: req.params.id,
        status,
        serverId: server.id,
      });

      // Call ban appeal webhook if configured
      const webhookUrl = server?.settings?.banAppealWebhook;
      if (webhookUrl) {
        callBanAppealWebhook(webhookUrl, updated, ban, 'updated').catch((error) => {
          console.error(`[Appeal] Webhook call failed for appeal ${updated.id}:`, error);
        });
      }

      res.json({
        ...updated,
        banUpdated: status === "approved",
        robloxUnbanned: status === "approved" && !!robloxUnbanResult?.success,
      });
    } catch (error: any) {
      console.error("[Appeal] Error updating appeal:", error);
      res.status(500).json({ error: error.message || "Failed to update appeal" });
    }
  });

  // ===== TICKET MANAGEMENT ROUTES =====

  app.get("/api/tickets", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.query;
      if (!serverId) {
        return res.status(400).json({ error: "serverId required" });
      }

      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const tickets = await storage.getTicketsByServerId(serverId);
      res.json(tickets);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch tickets" });
    }
  });

  app.post("/api/tickets", requireAuth, async (req: any, res) => {
    try {
      const { serverId, discordUserId, discordUsername, title, description, category, priority, metadata } = req.body;

      if (!serverId || !discordUserId || !discordUsername || !title || !description) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const ticket = await storage.createTicket({
        serverId,
        discordUserId,
        discordUsername,
        title,
        description,
        category: category || "general",
        status: "open",
        priority: priority || "medium",
        assignedTo: null,
        closedBy: null,
        closedAt: null,
        metadata: metadata || null,
      });

      broadcastToClients({
        type: "ticket_created",
        ticketId: ticket.id,
        serverId,
      });

      res.json(ticket);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create ticket" });
    }
  });

  app.patch("/api/tickets/:id", requireAuth, async (req: any, res) => {
    try {
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      const server = await storage.getServer(ticket.serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const updateData: any = { ...req.body };
      if (req.body.status === "closed" && ticket.status !== "closed") {
        updateData.closedBy = req.user.id;
        updateData.closedAt = new Date();
      }

      const updated = await storage.updateTicket(req.params.id, updateData);

      broadcastToClients({
        type: "ticket_updated",
        ticketId: req.params.id,
        status: req.body.status,
      });

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update ticket" });
    }
  });

  // Deploy ticket panel to Discord channel
  app.post("/api/servers/:serverId/ticket-panels/deploy", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.params;
      const { panelId } = req.body;

      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      if (!botManager.isCentralizedBotOnline()) {
        return res.status(503).json({ error: "Bot is offline. Please wait for it to come online." });
      }

      const serverSettings = server.settings as any;
      const ticketConfig = serverSettings?.ticketConfig || {};
      const panels = ticketConfig.panels || [];
      const panel = panels.find((p: any) => p.id === panelId);

      if (!panel) {
        return res.status(404).json({ error: "Panel not found" });
      }

      const result = await botManager.deployTicketPanel(panel.channelId, {
        title: panel.title,
        description: panel.description,
        color: panel.color,
        buttons: panel.buttons,
      });

      if (!result.success) {
        return res.status(500).json({ error: result.message || "Failed to deploy panel" });
      }

      // Update panel with message ID
      const updatedPanels = panels.map((p: any) => 
        p.id === panelId ? { ...p, messageId: result.messageId } : p
      );

      await storage.updateServer(serverId, {
        settings: {
          ...serverSettings,
          ticketConfig: {
            ...ticketConfig,
            panels: updatedPanels,
          },
        },
      } as any);

      res.json({ success: true, messageId: result.messageId });
    } catch (error: any) {
      console.error("[Ticket Panel] Deploy error:", error);
      res.status(500).json({ error: error.message || "Failed to deploy ticket panel" });
    }
  });

  // ===== DISCORD BOT STATUS & UTILITIES =====

  // Get centralized bot status
  app.get("/api/bot/status", async (req, res) => {
    try {
      const isOnline = botManager.isCentralizedBotOnline();
      const bot = botManager.getCentralizedBot();
      
      res.json({
        online: isOnline,
        botTag: bot?.user?.tag || undefined,
        botId: bot?.user?.id || undefined,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to get bot status" });
    }
  });

  // Restart centralized bot with optional new token
  app.post("/api/bot/restart", requireAuth, async (req: any, res) => {
    try {
      const { botToken } = req.body;

      // Verify the new token if provided
      if (botToken) {
        console.log('[Bot Restart] Verifying new bot token...');
        const verifyResponse = await fetch("https://discord.com/api/v10/users/@me", {
          headers: {
            Authorization: `Bot ${botToken}`,
          },
        });

        if (!verifyResponse.ok) {
          console.error(`[Bot Restart] Token verification failed: ${verifyResponse.status}`);
          return res.status(400).json({ error: "Invalid bot token. Please check your bot token and try again." });
        }

        const botData = await verifyResponse.json();
        console.log(`[Bot Restart] Token verified: ${botData.username} (ID: ${botData.id})`);
      }

      // Restart the bot
      console.log('[Bot Restart] Restarting centralized bot...');
      const success = await botManager.restartCentralizedBot(botToken);

      if (!success) {
        return res.status(500).json({ error: "Failed to restart bot. Please check the server logs." });
      }

      res.json({
        success: true,
        message: botToken ? "Bot token updated and bot restarted successfully" : "Bot restarted successfully",
      });
    } catch (error: any) {
      console.error("[Bot Restart] Error:", error);
      res.status(500).json({ error: error.message || "Failed to restart bot" });
    }
  });

  // Check if bot is in a specific server
  app.get("/api/servers/:serverId/bot-status", requireAuth, async (req: any, res) => {
    try {
      const server = await storage.getServer(req.params.serverId);
      
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const isOnline = botManager.isCentralizedBotOnline();
      const bot = botManager.getCentralizedBot();
      
      if (!isOnline || !bot) {
        return res.json({
          botOnline: false,
          botInServer: false,
          message: "Bot is currently offline. Please check your bot token and configuration.",
          inviteUrl: `https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&permissions=8&integration_type=0&scope=bot+applications.commands`
        });
      }

      const guild = bot.guilds.cache.get(server.discordServerId);
      
      res.json({
        botOnline: true,
        botInServer: !!guild,
        botTag: bot.user?.tag,
        serverName: guild?.name,
        message: guild 
          ? "Bot is online and connected to your server" 
          : "Bot is online but not in your Discord server. Please invite the bot.",
        inviteUrl: `https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&permissions=8&integration_type=0&scope=bot+applications.commands`
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to check bot status" });
    }
  });

  // Fetch Discord roles for a server using centralized bot
  app.get("/api/servers/:serverId/roles", requireAuth, async (req: any, res) => {
    try {
      const server = await storage.getServer(req.params.serverId);
      
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const bot = botManager.getCentralizedBot();
      if (!bot || !botManager.isCentralizedBotOnline()) {
        return res.status(503).json({ error: "Bot is not online. Please wait or restart the bot." });
      }

      const guild = bot.guilds.cache.get(server.discordServerId);
      if (!guild) {
        return res.status(404).json({ error: "Server not found. Make sure the bot is invited to your Discord server." });
      }

      const roles = guild.roles.cache
        .map((role: any) => ({
          id: role.id,
          name: role.name,
          color: role.color,
          position: role.position,
        }));

      res.json(Array.from(roles.values()));
    } catch (error: any) {
      console.error("Error fetching roles:", error);
      res.status(500).json({ error: error.message || "Failed to fetch roles" });
    }
  });

  // ===== BOT REGISTRATION ROUTES =====
  
  app.get("/api/bots", requireAuth, async (req: any, res) => {
    const bots = await storage.getBotRegistrationsByUserId(req.user.id);
    res.json(bots);
  });

  app.post("/api/bots/register", requireAuth, async (req: any, res) => {
    try {
      const { botId, botName, serverId } = req.body;

      // Validate inputs
      if (!botId || !botName || !serverId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Check if bot already registered
      const existing = await storage.getBotRegistrationByBotId(botId);
      if (existing) {
        return res.status(400).json({ error: "Bot already registered" });
      }

      // Generate HMAC secret
      const secret = randomBytes(32).toString("hex");
      const secretHash = createHash("sha256").update(secret).digest("hex");

      // Create bot registration
      const bot = await storage.createBotRegistration({
        botId,
        botName,
        serverId,
        ownerUserId: req.user.id,
        webhookUrl: null,
        secretHash,
        status: "pending",
      });

      res.json({
        ...bot,
        secret, // Send secret only once
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Registration failed" });
    }
  });

  app.delete("/api/bots/:id", requireAuth, async (req: any, res) => {
    const bot = await storage.getBotRegistration(req.params.id);
    
    if (!bot || bot.ownerUserId !== req.user.id) {
      return res.status(404).json({ error: "Bot not found" });
    }
    
    await storage.deleteBotRegistration(req.params.id);
    res.json({ success: true });
  });

  // ===== API KEY ROUTES =====
  
  app.get("/api/api-keys", requireAuth, async (req: any, res) => {
    const servers = await storage.getServersByUserId(req.user.id);
    const allKeys = [];
    
    for (const server of servers) {
      const keys = await storage.getApiKeysByServerId(server.id);
      allKeys.push(...keys);
    }
    
    res.json(allKeys);
  });

  app.post("/api/api-keys", requireAuth, async (req: any, res) => {
    try {
      const { name, serverId, scopes } = req.body;

      // Validate inputs
      if (!name || !serverId || !scopes || scopes.length === 0) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Check server ownership
      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Generate API key
      const apiKey = `blox_${randomBytes(32).toString("hex")}`;
      const keyHash = createHash("sha256").update(apiKey).digest("hex");
      const keyPreview = apiKey.substring(0, 12);

      // Create API key record (note: permissions and createdBy are not in the schema)
      const key = await storage.createApiKey({
        serverId,
        name,
        keyHash,
        keyPreview,
        scopes,
        lastUsedAt: null,
      });

      res.json({
        ...key,
        apiKey, // Send full key only once
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create API key" });
    }
  });

  app.delete("/api/api-keys/:id", requireAuth, async (req: any, res) => {
    const key = await storage.getApiKey(req.params.id);
    
    if (!key) {
      return res.status(404).json({ error: "API key not found" });
    }
    
    // Check ownership via server
    const server = await storage.getServer(key.serverId);
    if (!server || server.ownerId !== req.user.id) {
      return res.status(403).json({ error: "Not authorized" });
    }
    
    await storage.deleteApiKey(req.params.id);
    res.json({ success: true });
  });

  // ===== BLOXLINK INTEGRATION =====
  
  app.post("/api/bloxlink/lookup", requireAuth, async (req: any, res) => {
    try {
      const { query, queryType, serverId } = req.body;

      if (!query) {
        return res.status(400).json({ error: "Query is required" });
      }

      let robloxId: string;
      let robloxUsername: string;

      // Get Roblox user info
      if (queryType === "username") {
        // Look up by username
        const robloxUserResponse = await fetch(
          `https://users.roblox.com/v1/usernames/users`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              usernames: [query],
              excludeBannedUsers: false,
            }),
          }
        );

        const robloxData = await robloxUserResponse.json();

        if (!robloxData.data || robloxData.data.length === 0) {
          return res.status(404).json({ error: "Roblox user not found" });
        }

        robloxId = robloxData.data[0].id.toString();
        robloxUsername = robloxData.data[0].name;
      } else {
        // Look up by ID
        robloxId = query;
        const robloxUserResponse = await fetch(
          `https://users.roblox.com/v1/users/${robloxId}`
        );

        if (!robloxUserResponse.ok) {
          return res.status(404).json({ error: "Roblox user not found" });
        }

        const robloxData = await robloxUserResponse.json();
        robloxUsername = robloxData.name;
      }

      // Get avatar
      const avatarResponse = await fetch(
        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxId}&size=150x150&format=Png&isCircular=false`
      );
      const avatarData = await avatarResponse.json();
      const avatar = avatarData.data?.[0]?.imageUrl || null;

      // Check if user is banned in the selected server
      let banInfo = null;
      if (serverId) {
        banInfo = await storage.getBanByRobloxUserId(serverId, robloxId);
      }

      // Return comprehensive result
      res.json({
        robloxId,
        robloxUsername,
        avatar,
        verified: false,
        discordId: null,
        isBanned: !!banInfo,
        banInfo: banInfo || undefined,
        groups: [],
        flags: [],
      });
    } catch (error: any) {
      console.error("Bloxlink lookup error:", error);
      res.status(500).json({ error: error.message || "Lookup failed" });
    }
  });

  // ===== ANALYTICS ENDPOINTS =====
  
  app.get("/api/analytics/:serverId", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.params;
      
      // Verify server ownership
      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Get statistics
      const [allBans, appeals, tickets] = await Promise.all([
        storage.getBansByServerId(serverId),
        storage.getAppealsByServerId(serverId),
        storage.getTicketsByServerId(serverId),
      ]);
      
      // Filter active bans manually
      const activeBans = allBans.filter(b => b.isActive);

      const pendingAppeals = appeals.filter(a => a.status === "pending");
      const openTickets = tickets.filter(t => t.status === "open");

      // Calculate trends (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentBans = allBans.filter(b => new Date(b.createdAt) > thirtyDaysAgo);
      const recentAppeals = appeals.filter(a => new Date(a.createdAt) > thirtyDaysAgo);
      const recentTickets = tickets.filter(t => new Date(t.createdAt) > thirtyDaysAgo);

      res.json({
        totalBans: allBans.length,
        activeBans: activeBans.length,
        totalAppeals: appeals.length,
        pendingAppeals: pendingAppeals.length,
        totalTickets: tickets.length,
        openTickets: openTickets.length,
        trends: {
          bansLast30Days: recentBans.length,
          appealsLast30Days: recentAppeals.length,
          ticketsLast30Days: recentTickets.length,
        },
      });
    } catch (error: any) {
      console.error("Analytics error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch analytics" });
    }
  });

  // ===== IN-GAME MODERATION API (for Roblox game servers) =====
  
  // Validate API key middleware
  async function validateApiKey(req: any, res: any, next: any) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid API key" });
    }

    const apiKey = authHeader.substring(7);
    const keyHash = createHash("sha256").update(apiKey).digest("hex");
    
    const key = await storage.getApiKeyByHash(keyHash);
    
    if (!key) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    // Update last used timestamp
    await storage.updateApiKeyLastUsed(key.id);

    // Attach server info to request
    req.apiKey = key;
    req.serverId = key.serverId;
    
    next();
  }

  // Check if a Roblox user is banned (for in-game use)
  app.get("/api/game/check-ban/:robloxUserId", validateApiKey, async (req: any, res) => {
    try {
      const { robloxUserId } = req.params;
      const { serverId } = req;

      const ban = await storage.getBanByRobloxUserId(serverId, robloxUserId);

      if (!ban) {
        return res.json({ isBanned: false });
      }

      // Check if ban is still active (not expired)
      if (ban.expiresAt && new Date(ban.expiresAt) < new Date()) {
        // Ban expired, mark as inactive
        await storage.updateBan(ban.id, { isActive: false });
        return res.json({ isBanned: false });
      }

      res.json({
        isBanned: true,
        banId: ban.id,
        reason: ban.reason,
        bannedAt: ban.createdAt,
        expiresAt: ban.expiresAt,
      });

      // Broadcast ban check to WebSocket clients
      broadcastToClients({
        type: 'ban_check',
        serverId,
        robloxUserId,
        result: 'banned',
      });
    } catch (error: any) {
      console.error("Ban check error:", error);
      res.status(500).json({ error: error.message || "Failed to check ban status" });
    }
  });

  // Get all active bans for a server (for in-game use)
  app.get("/api/game/bans", validateApiKey, async (req: any, res) => {
    try {
      const { serverId } = req;
      const bans = await storage.getBansByServerId(serverId, true);

      res.json({
        bans: bans.map(ban => ({
          robloxUserId: ban.robloxUserId,
          robloxUsername: ban.robloxUsername,
          reason: ban.reason,
          bannedAt: ban.createdAt,
          expiresAt: ban.expiresAt,
        })),
      });
    } catch (error: any) {
      console.error("Get bans error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch bans" });
    }
  });

  // ===== MODERATION PANEL ROUTES =====
  
  // Roblox player lookup
  app.get("/api/roblox/player/:usernameOrId", async (req, res) => {
    try {
      const { usernameOrId } = req.params;
      
      // Check if it's a user ID (numeric) or username
      const isNumeric = /^\d+$/.test(usernameOrId);
      
      let robloxUserId: string;
      let robloxUsername: string;
      
      if (isNumeric) {
        // Lookup by user ID
        robloxUserId = usernameOrId;
        const response = await fetch(`https://users.roblox.com/v1/users/${robloxUserId}`);
        if (!response.ok) {
          return res.status(404).json({ error: "Player not found" });
        }
        const userData = await response.json();
        robloxUsername = userData.name;
      } else {
        // Lookup by username
        const response = await fetch("https://users.roblox.com/v1/usernames/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ usernames: [usernameOrId], excludeBannedUsers: false }),
        });
        
        if (!response.ok) {
          return res.status(404).json({ error: "Player not found" });
        }
        
        const data = await response.json();
        if (!data.data || data.data.length === 0) {
          return res.status(404).json({ error: "Player not found" });
        }
        
        robloxUserId = data.data[0].id.toString();
        robloxUsername = data.data[0].name;
      }
      
      // Get additional player info
      const userResponse = await fetch(`https://users.roblox.com/v1/users/${robloxUserId}`);
      const userData = await userResponse.json();
      
      // Get player avatar (headshot)
      let avatarUrl = `https://www.roblox.com/headshot-thumbnail/image?userId=${robloxUserId}&width=150&height=150&format=png`;
      let avatarFetchFailed = false;
      try {
        const avatarResponse = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxUserId}&size=150x150&format=Png&isCircular=false`);
        if (avatarResponse.ok) {
          const avatarData = await avatarResponse.json();
          if (avatarData.data && avatarData.data[0] && avatarData.data[0].imageUrl) {
            avatarUrl = avatarData.data[0].imageUrl;
          } else {
            avatarFetchFailed = true;
          }
        } else {
          avatarFetchFailed = true;
        }
      } catch (err) {
        console.error('Failed to fetch avatar:', err);
        avatarFetchFailed = true;
      }
      
      // Calculate account age
      const createdDate = new Date(userData.created);
      const accountAge = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Check if player has any bans in our system
      const token = req.cookies.session;
      const user = await getUserFromSession(token);
      let totalReports = 0;
      let lastReportDate = null;
      let banned = false;
      
      if (user) {
        // Check across all servers the user manages
        const servers = await storage.getServersByUserId(user.id);
        for (const server of servers) {
          const ban = await storage.getBanByRobloxUserId(server.id, robloxUserId);
          if (ban && ban.isActive) {
            banned = true;
            totalReports++;
            if (!lastReportDate || new Date(ban.createdAt) > new Date(lastReportDate)) {
              lastReportDate = ban.createdAt;
            }
          }
        }
      }
      
      res.json({
        id: robloxUserId,
        username: robloxUsername,
        displayName: userData.displayName || userData.name,
        joinDate: userData.created,
        accountAge,
        verified: userData.hasVerifiedBadge || false,
        banned,
        totalReports,
        lastReportDate,
        description: userData.description || null,
        avatarUrl,
        avatarFetchFailed,
      });
    } catch (error: any) {
      console.error("Roblox player lookup error:", error);
      res.status(500).json({ error: error.message || "Failed to lookup player" });
    }
  });
  
  // Execute moderation action
  app.post("/api/moderation/action", async (req, res) => {
    try {
      const token = req.cookies.session;
      const user = await getUserFromSession(token);
      
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const {
        serverId,
        robloxUserId,
        robloxUsername,
        actionType,
        reason,
        duration,
        evidence,
      } = req.body;
      
      // Verify user owns or is a member of this server
      const server = await storage.getServer(serverId);
      if (!server) {
        return res.status(404).json({ error: "Server not found" });
      }
      
      const isOwner = server.ownerId === user.id;
      const isMember = await storage.getServerMemberByUserAndServer(user.id, serverId);
      
      if (!isOwner && !isMember) {
        return res.status(403).json({ error: "Not authorized for this server" });
      }
      
      let result: any;
      
      switch (actionType) {
        case "ban":
        case "tempban":
          // Create or update ban
          const existingBan = await storage.getBanByRobloxUserId(serverId, robloxUserId);
          
          const banData: any = {
            serverId,
            robloxUserId,
            robloxUsername,
            reason,
            bannedBy: user.id,
            isActive: true,
            metadata: {
              evidence: evidence || [],
            },
          };
          
          if (actionType === "tempban" && duration) {
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + parseInt(duration));
            banData.expiresAt = expiresAt;
          }
          
          // Perform alt detection
          const altDetection = await robloxCloud.performAltDetection(
            robloxUserId,
            serverId
          );
          
          banData.metadata.altDetection = {
            isLikelyAlt: altDetection.isLikelyAlt,
            confidence: altDetection.confidence,
            reasons: altDetection.reasons,
            accountAge: altDetection.metadata.accountAge,
          };
          
          // Try to enforce ban in Roblox if API key is configured
          const serverSettings = server.settings as any;
          const robloxApiKey = serverSettings?.robloxApiKey;
          const robloxUniverseId = serverSettings?.robloxUniverseId;
          
          if (robloxApiKey && robloxUniverseId) {
            const robloxBanResult = await robloxCloud.banUser({
              universeId: robloxUniverseId,
              userId: robloxUserId,
              apiKey: robloxApiKey,
              privateReason: reason,
              displayReason: reason,
              duration: actionType === "tempban" ? parseInt(duration) : undefined,
              excludeAltAccounts: true,
            });
            
            banData.metadata.robloxEnforced = robloxBanResult.success;
            banData.metadata.robloxResponse = {
              success: robloxBanResult.success,
              statusCode: robloxBanResult.statusCode,
              error: robloxBanResult.error,
              altAccountsRestricted: robloxBanResult.altAccountsRestricted,
              timestamp: new Date().toISOString(),
            };
            
            if (!robloxBanResult.success) {
              console.warn(`[Roblox API] Failed to enforce ban for ${robloxUsername}:`, robloxBanResult.error);
            } else {
              console.log(`[Roblox API] Successfully enforced ban for ${robloxUsername}`);
            }
          }
          
          if (existingBan) {
            result = await storage.updateBan(existingBan.id, banData);
          } else {
            result = await storage.createBan(banData);
          }
          
          // Broadcast ban action to WebSocket clients
          broadcastToClients({
            type: 'ban_created',
            serverId,
            robloxUserId,
            robloxUsername,
            action: actionType,
            robloxEnforced: banData.metadata.robloxEnforced || false,
          });
          break;
          
        case "warn":
          // Create a ban record with a warning flag
          result = await storage.createBan({
            serverId,
            robloxUserId,
            robloxUsername,
            discordUserId: null,
            reason,
            bannedBy: user.id,
            expiresAt: null,
            isActive: false,
            metadata: {
              notes: "warning",
              evidence: evidence || [],
            },
          });
          
          broadcastToClients({
            type: 'warning_issued',
            serverId,
            robloxUserId,
            robloxUsername,
          });
          break;
          
        case "unban":
          // Find and deactivate ban
          const banToRemove = await storage.getBanByRobloxUserId(serverId, robloxUserId);
          if (banToRemove) {
            // Try to lift ban in Roblox if API key is configured
            const serverSettings = server.settings as any;
            const robloxApiKey = serverSettings?.robloxApiKey;
            const robloxUniverseId = serverSettings?.robloxUniverseId;
            
            let robloxUnbanSuccess = false;
            if (robloxApiKey && robloxUniverseId) {
              const robloxUnbanResult = await robloxCloud.unbanUser({
                universeId: robloxUniverseId,
                userId: robloxUserId,
                apiKey: robloxApiKey,
              });
              
              robloxUnbanSuccess = robloxUnbanResult.success;
              
              if (!robloxUnbanResult.success) {
                console.warn(`[Roblox API] Failed to lift ban for ${robloxUsername}:`, robloxUnbanResult.error);
              } else {
                console.log(`[Roblox API] Successfully lifted ban for ${robloxUsername}`);
              }
            }
            
            result = await storage.updateBan(banToRemove.id, { 
              isActive: false,
              metadata: {
                ...banToRemove.metadata,
                robloxUnbanSuccess,
                unbannedAt: new Date().toISOString(),
              },
            });
            
            broadcastToClients({
              type: 'ban_removed',
              serverId,
              robloxUserId,
              robloxUsername,
              robloxEnforced: robloxUnbanSuccess,
            });
          } else {
            return res.status(404).json({ error: "No active ban found for this player" });
          }
          break;
          
        default:
          return res.status(400).json({ error: "Invalid action type" });
      }
      
      res.json({
        success: true,
        action: actionType,
        result,
      });
    } catch (error: any) {
      console.error("Moderation action error:", error);
      res.status(500).json({ error: error.message || "Failed to execute moderation action" });
    }
  });

  // ===== SERVER MEMBERS (TEAM MANAGEMENT) ROUTES =====
  
  app.get("/api/servers/:serverId/members", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.params;
      const server = await storage.getServer(serverId);
      
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const members = await storage.getServerMembersByServerId(serverId);
      
      const membersWithUserData = await Promise.all(
        members.map(async (member) => {
          const user = await storage.getUser(member.userId);
          return {
            ...member,
            user: user ? {
              id: user.id,
              username: user.username,
              avatar: user.avatar,
              discriminator: user.discriminator,
            } : null,
          };
        })
      );
      
      res.json(membersWithUserData);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch server members" });
    }
  });

  app.post("/api/servers/:serverId/members", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.params;
      const { userId, role, permissions } = req.body;

      if (!userId || !role) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Check if user exists in our database by Discord ID (userId is actually discordId)
      let user = await storage.getUserByDiscordId(userId);
      
      // If user doesn't exist, they need to log in first
      if (!user) {
        return res.status(400).json({ 
          error: "This Discord user hasn't logged in to the application yet. They must log in at least once before being added as a team member. Share this URL with them to log in: " + (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : req.get('origin') || 'https://your-app-url.com')
        });
      }

      const existingMember = await storage.getServerMemberByUserAndServer(user.id, serverId);
      if (existingMember) {
        return res.status(400).json({ error: "User is already a member" });
      }

      const member = await storage.createServerMember({
        serverId,
        userId: user.id,
        role,
        permissions: permissions || [],
        invitedBy: req.user?.id || undefined,
      });

      res.json(member);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to add server member" });
    }
  });

  app.patch("/api/servers/:serverId/members/:memberId", requireAuth, async (req: any, res) => {
    try {
      const { serverId, memberId } = req.params;
      const { role, permissions } = req.body;

      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const member = await storage.updateServerMember(memberId, {
        role,
        permissions,
      });

      if (!member) {
        return res.status(404).json({ error: "Member not found" });
      }

      res.json(member);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update server member" });
    }
  });

  app.delete("/api/servers/:serverId/members/:memberId", requireAuth, async (req: any, res) => {
    try {
      const { serverId, memberId } = req.params;

      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      await storage.deleteServerMember(memberId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to remove server member" });
    }
  });

  // ===== INVITE CODE ROUTES =====
  
  // Get all invite codes for a server
  app.get("/api/servers/:serverId/invites", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.params;
      const server = await storage.getServer(serverId);
      
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const invites = await storage.getInviteCodesByServerId(serverId);
      res.json(invites);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch invites" });
    }
  });

  // Create a new invite code
  app.post("/api/servers/:serverId/invites", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.params;
      const { role, permissions, maxUses, expiresIn } = req.body;

      if (!role) {
        return res.status(400).json({ error: "Role is required" });
      }

      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Generate a unique invite code
      const code = randomBytes(16).toString("hex");
      
      // Calculate expiration date if provided
      let expiresAt = null;
      if (expiresIn) {
        const hours = parseInt(expiresIn);
        expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
      }

      const invite = await storage.createInviteCode({
        code,
        serverId,
        createdBy: req.user.id,
        role,
        permissions: permissions || [],
        maxUses: maxUses || null,
        currentUses: 0,
        expiresAt,
      });

      res.json(invite);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create invite" });
    }
  });

  // Delete an invite code
  app.delete("/api/servers/:serverId/invites/:inviteId", requireAuth, async (req: any, res) => {
    try {
      const { serverId, inviteId } = req.params;

      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      await storage.deleteInviteCode(inviteId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to delete invite" });
    }
  });

  // ===== DISCORD USER LOOKUP ROUTE =====
  
  // Look up Discord user by ID for invitation system
  app.get("/api/discord/user/:userId", requireAuth, async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      // Get user's access token for Discord API
      const user = req.user;
      
      if (!user.accessToken) {
        return res.status(401).json({ error: "Discord authentication required" });
      }

      // Fetch Discord user info using bot token or user token
      // For production, you'd want to use your bot's token instead
      // For now, we'll return basic user info
      try {
        const response = await fetch(`https://discord.com/api/v10/users/${userId}`, {
          headers: {
            Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN || ''}`
          }
        });

        if (!response.ok) {
          return res.status(404).json({ error: "Discord user not found" });
        }

        const discordUser = await response.json();

        res.json({
          id: discordUser.id,
          username: discordUser.username,
          discriminator: discordUser.discriminator || '0',
          avatar: discordUser.avatar,
          globalName: discordUser.global_name,
        });
      } catch (error) {
        // Fallback: Check if user exists in our database
        const existingUser = await storage.getUserByDiscordId(userId);
        
        if (existingUser) {
          res.json({
            id: existingUser.discordId,
            username: existingUser.username,
            discriminator: existingUser.discriminator || '0',
            avatar: existingUser.avatar,
            globalName: existingUser.username,
          });
        } else {
          res.json({
            id: userId,
            username: `User ${userId}`,
            discriminator: '0',
            avatar: null,
            globalName: `User ${userId}`,
          });
        }
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to lookup Discord user" });
    }
  });

  // ===== AUTO ACTIONS ROUTES =====
  
  app.get("/api/servers/:serverId/auto-actions", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.params;
      const server = await storage.getServer(serverId);
      
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const actions = await storage.getAutoActionsByServerId(serverId);
      res.json(actions);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch auto actions" });
    }
  });

  app.post("/api/servers/:serverId/auto-actions", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.params;
      const { name, trigger, conditions, action, actionParams, isActive } = req.body;

      if (!name || !trigger || !conditions || !action) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const autoAction = await storage.createAutoAction({
        serverId,
        name,
        trigger,
        conditions,
        action,
        actionParams: actionParams || null,
        isActive: isActive !== undefined ? isActive : true,
        config: null,
      } as any);

      res.json(autoAction);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create auto action" });
    }
  });

  app.patch("/api/servers/:serverId/auto-actions/:actionId", requireAuth, async (req: any, res) => {
    try {
      const { serverId, actionId } = req.params;
      const updates = req.body;

      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const autoAction = await storage.updateAutoAction(actionId, updates);
      
      if (!autoAction) {
        return res.status(404).json({ error: "Auto action not found" });
      }

      res.json(autoAction);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update auto action" });
    }
  });

  app.delete("/api/servers/:serverId/auto-actions/:actionId", requireAuth, async (req: any, res) => {
    try {
      const { serverId, actionId } = req.params;

      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      await storage.deleteAutoAction(actionId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to delete auto action" });
    }
  });

  // ===== MODERATOR NOTES ROUTES =====
  
  app.get("/api/servers/:serverId/notes", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.params;
      const { robloxUserId } = req.query;
      
      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const notes = await storage.getModeratorNotesByServerId(
        serverId, 
        robloxUserId as string | undefined
      );
      
      res.json(notes);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch notes" });
    }
  });

  app.post("/api/servers/:serverId/notes", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.params;
      const { robloxUserId, note, isImportant } = req.body;

      if (!robloxUserId || !note) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const moderatorNote = await storage.createModeratorNote({
        serverId,
        robloxUserId,
        authorId: req.user.id,
        createdBy: req.user.id,
        note,
        isImportant: isImportant || false,
      } as any);

      res.json(moderatorNote);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create note" });
    }
  });

  app.delete("/api/servers/:serverId/notes/:noteId", requireAuth, async (req: any, res) => {
    try {
      const { serverId, noteId } = req.params;

      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      await storage.deleteModeratorNote(noteId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to delete note" });
    }
  });

  // ===== ROBLOX API KEYS ROUTES =====
  
  app.get("/api/servers/:serverId/roblox-api-keys", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.params;
      const server = await storage.getServer(serverId);
      
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const keys = await storage.getRobloxApiKeysByServerId(serverId);
      
      const safeKeys = keys.map(key => ({
        ...key,
        apiKeyEncrypted: undefined,
      }));
      
      res.json(safeKeys);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch API keys" });
    }
  });

  app.post("/api/servers/:serverId/roblox-api-keys", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.params;
      const { name, apiKey, universeId, scopes } = req.body;

      if (!name || !apiKey) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const encrypted = createHash('sha256').update(apiKey).digest('hex');

      const robloxKey = await storage.createRobloxApiKey({
        serverId,
        name,
        apiKeyEncrypted: encrypted,
        universeId: universeId || null,
        scopes: scopes || [],
        isActive: true,
      });

      const safeKey = {
        ...robloxKey,
        apiKeyEncrypted: undefined,
      };

      res.json(safeKey);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create API key" });
    }
  });

  app.delete("/api/servers/:serverId/roblox-api-keys/:keyId", requireAuth, async (req: any, res) => {
    try {
      const { serverId, keyId } = req.params;

      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      await storage.deleteRobloxApiKey(keyId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to delete API key" });
    }
  });

  // ===== SHIFT TRACKING ROUTES =====

  app.get("/api/servers/:serverId/shifts", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.params;
      const { status, userId, limit = 50 } = req.query;

      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const shifts = await storage.getShiftsByServerId(serverId, {
        status: status as string,
        userId: userId as string,
        limit: parseInt(limit as string),
      });

      res.json(shifts);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch shifts" });
    }
  });

  app.post("/api/servers/:serverId/shifts/start", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.params;

      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const activeShift = await storage.getActiveShiftByUserId(req.user.id, serverId);
      if (activeShift) {
        return res.status(400).json({ error: "You already have an active shift" });
      }

      const shift = await storage.createShift({
        serverId,
        userId: req.user.id,
        startTime: new Date(),
        endTime: null,
        status: "active",
        metrics: {},
      });

      res.json(shift);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to start shift" });
    }
  });

  app.post("/api/servers/:serverId/shifts/:shiftId/end", requireAuth, async (req: any, res) => {
    try {
      const { serverId, shiftId } = req.params;

      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const shift = await storage.getShift(shiftId);
      if (!shift || shift.serverId !== serverId) {
        return res.status(404).json({ error: "Shift not found" });
      }

      if (shift.status !== "active") {
        return res.status(400).json({ error: "Shift is not active" });
      }

      const endTime = new Date();
      const metrics = await storage.getShiftMetrics(shiftId, shift.startTime, endTime);

      const updatedShift = await storage.updateShift(shiftId, {
        endTime,
        status: "completed",
        metrics,
      });

      res.json(updatedShift);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to end shift" });
    }
  });

  app.get("/api/servers/:serverId/shifts/active", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.params;

      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const activeShift = await storage.getActiveShiftByUserId(req.user.id, serverId);
      res.json(activeShift || null);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch active shift" });
    }
  });

  // ===== MODERATION LOGS & DASHBOARD ROUTES =====

  app.get("/api/servers/:serverId/moderation-logs", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.params;
      const { limit = 100, action, moderatorId } = req.query;

      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const logs = await storage.getModerationLogsByServerId(serverId, {
        limit: parseInt(limit as string),
        action: action as string,
        moderatorId: moderatorId as string,
      });

      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch moderation logs" });
    }
  });

  app.get("/api/servers/:serverId/moderation-stats", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.params;
      const { period = "30" } = req.query;

      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const days = parseInt(period as string);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const logs = await storage.getModerationLogsByServerId(serverId, {
        startDate,
      });

      const shifts = await storage.getShiftsByServerId(serverId, {
        startDate,
      });

      const bans = await storage.getBansByServerId(serverId);
      const appeals = await storage.getAppealsByServerId(serverId);
      const tickets = await storage.getTicketsByServerId(serverId);

      const recentBans = bans.filter(b => new Date(b.createdAt) >= startDate);
      const recentAppeals = appeals.filter(a => new Date(a.createdAt) >= startDate);
      const recentTickets = tickets.filter(t => new Date(t.createdAt) >= startDate);

      const actionsByType = logs.reduce((acc: Record<string, number>, log) => {
        acc[log.action] = (acc[log.action] || 0) + 1;
        return acc;
      }, {});

      const totalShiftHours = shifts.reduce((total, shift) => {
        if (shift.endTime) {
          const duration = new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime();
          return total + (duration / (1000 * 60 * 60));
        }
        return total;
      }, 0);

      res.json({
        period: days,
        totalActions: logs.length,
        actionsByType,
        totalBans: recentBans.length,
        activeBans: bans.filter(b => b.isActive).length,
        totalAppeals: recentAppeals.length,
        pendingAppeals: appeals.filter(a => a.status === "pending").length,
        totalTickets: recentTickets.length,
        openTickets: tickets.filter(t => t.status === "open").length,
        totalShifts: shifts.length,
        totalShiftHours: Math.round(totalShiftHours * 10) / 10,
        activeShifts: shifts.filter(s => s.status === "active").length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch moderation stats" });
    }
  });


  // ===== SERVER SETUP ROUTES =====
  
  app.patch("/api/servers/:serverId/setup", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.params;
      const { 
        botToken, 
        reportsChannel, 
        reportLogsChannel, 
        appealsCategory, 
        appealLogsChannel,
        moderatorChatEnabled 
      } = req.body;

      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const updates: any = {
        settings: {
          ...server.settings,
          setupCompleted: true,
        },
      };

      if (reportsChannel) {
        updates.settings.reportsChannel = reportsChannel;
      }
      if (reportLogsChannel) {
        updates.settings.reportLogsChannel = reportLogsChannel;
      }
      if (appealsCategory) {
        updates.settings.appealsCategory = appealsCategory;
      }
      if (appealLogsChannel) {
        updates.settings.appealLogsChannel = appealLogsChannel;
      }
      if (moderatorChatEnabled !== undefined) {
        updates.settings.moderatorChatEnabled = moderatorChatEnabled;
      }

      if (botToken) {
        console.log(`[Setup] Bot token provided for server ${serverId}`);
        const existingBot = await storage.getDiscordBotByServerId(serverId);
        console.log(`[Setup] Existing bot check:`, existingBot ? `Found: ${existingBot.botName}` : 'None');
        
        console.log(`[Setup] Verifying bot token with Discord API...`);
        const verifyResponse = await fetch("https://discord.com/api/v10/users/@me", {
          headers: {
            Authorization: `Bot ${botToken}`,
          },
        });
        
        if (!verifyResponse.ok) {
          console.error(`[Setup] Bot token verification failed: ${verifyResponse.status}`);
          return res.status(400).json({ error: "Invalid bot token. Please check your bot token and try again." });
        }
        
        const botData = await verifyResponse.json();
        console.log(`[Setup] Bot verified: ${botData.username} (ID: ${botData.id})`);
        
        const encryptedToken = encryptToken(botToken);
        
        if (existingBot) {
          console.log(`[Setup] Updating existing bot...`);
          await storage.updateDiscordBot(existingBot.id, {
            botTokenEncrypted: encryptedToken,
            botName: botData.username,
            status: "active",
            lastOnline: new Date(),
          });
          console.log(`[Setup] Bot updated successfully`);
        } else {
          console.log(`[Setup] Creating new bot in database...`);
          const createdBot = await storage.createDiscordBot({
            serverId,
            botTokenEncrypted: encryptedToken,
            botId: botData.id,
            botName: botData.username,
            status: "active",
            features: [],
            lastOnline: new Date(),
          });
          console.log(`[Setup] Bot created successfully:`, createdBot);
        }
        
        console.log(`[Setup] Starting Discord bot...`);
        const botStarted = await botManager.startBot(serverId, botToken, server.discordServerId);
        if (!botStarted) {
          console.error(`[Setup] Failed to start bot`);
          return res.status(500).json({ error: "Bot token is valid but failed to start the bot. Please try again." });
        }
        
        console.log(`[Discord Bot] Successfully started bot for server ${serverId} - Bot is now ONLINE`);
        
        // Verify bot was actually saved
        const verifyBot = await storage.getDiscordBotByServerId(serverId);
        console.log(`[Setup] Bot save verification:`, verifyBot ? `✓ Found: ${verifyBot.botName}` : '✗ NOT FOUND!');
      }

      const updatedServer = await storage.updateServer(serverId, updates);
      res.json(updatedServer);
    } catch (error: any) {
      console.error("Server setup error:", error);
      res.status(500).json({ error: error.message || "Failed to update server setup" });
    }
  });

  // Update server settings (for all settings including game profile, API keys, etc.)
  app.patch("/api/servers/:serverId/settings", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.params;

      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Deep merge helper for nested settings
      const deepMerge = (target: any, source: any): any => {
        const output = { ...target };
        for (const key in source) {
          if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            output[key] = deepMerge(target[key] || {}, source[key]);
          } else {
            output[key] = source[key];
          }
        }
        return output;
      };

      // Deep merge all incoming settings with existing settings
      const updates: any = {
        settings: deepMerge(server.settings || {}, req.body),
      };

      console.log(`[Settings Update] Updating server ${serverId} with:`, Object.keys(req.body));

      const updatedServer = await storage.updateServer(serverId, updates);
      res.json(updatedServer);
    } catch (error: any) {
      console.error("Server settings update error:", error);
      res.status(500).json({ error: error.message || "Failed to update server settings" });
    }
  });

  // ===== NOTIFICATION ROUTES =====
  
  app.get("/api/notifications", requireAuth, async (req: any, res) => {
    try {
      const notifications = await storage.getNotificationsByUserId(req.user.id);
      res.json(notifications);
    } catch (error: any) {
      console.error("Notifications fetch error:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.patch("/api/notifications/:id/read", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const notifications = await storage.getNotificationsByUserId(req.user.id);
      const notification = notifications.find(n => n.id === id);
      
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      
      await storage.markNotificationAsRead(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Mark notification read error:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  app.post("/api/notifications/mark-all-read", requireAuth, async (req: any, res) => {
    try {
      await storage.markAllNotificationsAsRead(req.user.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Mark all notifications read error:", error);
      res.status(500).json({ error: "Failed to mark all notifications as read" });
    }
  });

  // ===== DISCORD CHANNEL ROUTES =====
  
  app.get("/api/servers/:serverId/channels", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.params;
      
      console.log(`[Channels] Fetching channels for server ${serverId}`);
      
      const server = await storage.getServer(serverId);
      if (!server) {
        console.error(`[Channels] Server ${serverId} not found`);
        return res.status(404).json({ error: "Server not found" });
      }

      console.log(`[Channels] Server found: ${server.name} (Discord ID: ${server.discordServerId})`);

      // Use centralized bot instead of per-server bot
      const centralizedBot = botManager.getCentralizedBot();
      if (!centralizedBot || !botManager.isCentralizedBotOnline()) {
        console.error(`[Channels] Centralized bot is not online`);
        return res.json([]);
      }

      console.log(`[Channels] Using centralized bot: ${centralizedBot.user?.tag}`);

      // Check if bot is in the guild
      const guild = centralizedBot.guilds.cache.get(server.discordServerId);
      if (!guild) {
        console.error(`[Channels] Bot is not in server ${server.discordServerId}. User needs to invite the bot first.`);
        return res.json([]);
      }

      console.log(`[Channels] Bot is in guild: ${guild.name}, fetching channels...`);
      
      const botToken = process.env.DISCORD_BOT_TOKEN;
      const channelsResponse = await fetch(
        `https://discord.com/api/v10/guilds/${server.discordServerId}/channels`,
        {
          headers: {
            Authorization: `Bot ${botToken}`,
          },
        }
      );

      if (!channelsResponse.ok) {
        const errorText = await channelsResponse.text();
        console.error(`[Channels] Discord API error (${channelsResponse.status}):`, errorText);
        return res.json([]);
      }

      const channels = await channelsResponse.json();
      console.log(`[Channels] Successfully fetched ${channels.length} channels`);
      res.json(channels);
    } catch (error: any) {
      console.error("[Channels] Error fetching channels:", error);
      res.status(500).json({ error: "Failed to fetch Discord channels" });
    }
  });

  // ===== DISCORD ROLES ROUTE =====
  
  app.get("/api/servers/:serverId/roles", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.params;
      
      console.log(`[Roles] Fetching roles for server ${serverId}`);
      
      const server = await storage.getServer(serverId);
      if (!server) {
        console.error(`[Roles] Server ${serverId} not found`);
        return res.status(404).json({ error: "Server not found" });
      }

      console.log(`[Roles] Server found: ${server.name} (Discord ID: ${server.discordServerId})`);

      // Use centralized bot
      const centralizedBot = botManager.getCentralizedBot();
      if (!centralizedBot || !botManager.isCentralizedBotOnline()) {
        console.error(`[Roles] Centralized bot is not online`);
        return res.json([]);
      }

      console.log(`[Roles] Using centralized bot: ${centralizedBot.user?.tag}`);

      // Check if bot is in the guild
      const guild = centralizedBot.guilds.cache.get(server.discordServerId);
      if (!guild) {
        console.error(`[Roles] Bot is not in server ${server.discordServerId}`);
        return res.json([]);
      }

      console.log(`[Roles] Bot is in guild: ${guild.name}, fetching roles...`);
      
      const botToken = process.env.DISCORD_BOT_TOKEN;
      const rolesResponse = await fetch(
        `https://discord.com/api/v10/guilds/${server.discordServerId}/roles`,
        {
          headers: {
            Authorization: `Bot ${botToken}`,
          },
        }
      );

      if (!rolesResponse.ok) {
        const errorText = await rolesResponse.text();
        console.error(`[Roles] Discord API error (${rolesResponse.status}):`, errorText);
        return res.json([]);
      }

      const roles = await rolesResponse.json();
      console.log(`[Roles] Successfully fetched ${roles.length} roles`);
      res.json(roles);
    } catch (error: any) {
      console.error("[Roles] Error fetching roles:", error);
      res.status(500).json({ error: "Failed to fetch Discord roles" });
    }
  });

  // ===== DISCORD USER AVATAR ROUTE =====
  
  app.get("/api/discord/user/:userId/avatar", requireAuth, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { serverId } = req.query;
      
      let botToken: string | null = null;
      
      if (serverId && typeof serverId === 'string') {
        const discordBot = await storage.getDiscordBotByServerId(serverId);
        if (discordBot) {
          botToken = decryptToken(discordBot.botTokenEncrypted);
        }
      }
      
      if (!botToken) {
        const defaultAvatarUrl = `https://cdn.discordapp.com/embed/avatars/${parseInt(userId) % 6}.png`;
        return res.json({ avatarUrl: defaultAvatarUrl, username: null });
      }

      const userResponse = await fetch(`https://discord.com/api/v10/users/${userId}`, {
        headers: {
          Authorization: `Bot ${botToken}`,
        },
      });

      if (!userResponse.ok) {
        const defaultAvatarUrl = `https://cdn.discordapp.com/embed/avatars/${parseInt(userId) % 6}.png`;
        return res.json({ avatarUrl: defaultAvatarUrl, username: null });
      }

      const userData = await userResponse.json();
      const avatarUrl = userData.avatar 
        ? `https://cdn.discordapp.com/avatars/${userId}/${userData.avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/${parseInt(userId) % 6}.png`;

      res.json({ avatarUrl, username: userData.username });
    } catch (error: any) {
      console.error("Discord user avatar fetch error:", error);
      const fallbackUserId = req.params.userId || '0';
      const defaultAvatarUrl = `https://cdn.discordapp.com/embed/avatars/${parseInt(fallbackUserId) % 6}.png`;
      res.json({ avatarUrl: defaultAvatarUrl, username: null });
    }
  });

  // ===== SERVER BRANDING ROUTES =====

  app.get("/api/servers/:serverId/branding", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.params;
      
      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const branding = await storage.getServerBranding(serverId);
      res.json(branding || {
        serverId,
        logoUrl: null,
        bannerUrl: null,
        customDescription: null,
        primaryColor: "#6B21A8",
        secondaryColor: null,
        customDomain: null,
        publicProfileEnabled: false,
        showStatistics: true,
        showTeamMembers: false,
        socialLinks: {},
      });
    } catch (error: any) {
      console.error("Get server branding error:", error);
      res.status(500).json({ error: "Failed to fetch server branding" });
    }
  });

  app.put("/api/servers/:serverId/branding", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.params;
      
      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const { logoUrl, bannerUrl, customDescription, primaryColor, secondaryColor, customDomain, publicProfileEnabled, showStatistics, showTeamMembers, socialLinks } = req.body;

      const branding = await storage.createOrUpdateServerBranding(serverId, {
        logoUrl,
        bannerUrl,
        customDescription,
        primaryColor,
        secondaryColor,
        customDomain,
        publicProfileEnabled,
        showStatistics,
        showTeamMembers,
        socialLinks,
      });
      res.json(branding);
    } catch (error: any) {
      console.error("Update server branding error:", error);
      res.status(500).json({ error: "Failed to update server branding" });
    }
  });

  // ===== PREMIUM SUBSCRIPTION ROUTES =====

  app.get("/api/servers/:serverId/premium", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.params;
      
      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const subscription = await storage.getPremiumSubscription(serverId);
      res.json(subscription || {
        serverId,
        tier: "free",
        status: "active",
        features: ["basic_moderation", "ticket_system"],
      });
    } catch (error: any) {
      console.error("Get premium subscription error:", error);
      res.status(500).json({ error: "Failed to fetch premium subscription" });
    }
  });

  // ===== ACTIVITY EXPORT ROUTES =====

  app.post("/api/servers/:serverId/exports", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.params;
      const { exportType, dateRange, filters } = req.body;
      
      if (!exportType || !dateRange || !dateRange.startDate || !dateRange.endDate) {
        return res.status(400).json({ error: "exportType and valid dateRange required" });
      }
      
      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const exportRecord = await storage.createActivityExport({
        serverId,
        requestedBy: req.user.id,
        exportType,
        dateRange,
        filters: filters || {},
        status: "pending",
      });

      res.json(exportRecord);
    } catch (error: any) {
      console.error("Create activity export error:", error);
      res.status(500).json({ error: "Failed to create activity export" });
    }
  });

  app.get("/api/servers/:serverId/exports", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.params;
      const { limit = 50 } = req.query;
      
      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const exports = await storage.getActivityExportsByServerId(serverId, parseInt(limit as string));
      res.json(exports);
    } catch (error: any) {
      console.error("Get activity exports error:", error);
      res.status(500).json({ error: "Failed to fetch activity exports" });
    }
  });

  // ===== ENHANCED ANALYTICS ROUTES WITH SNAPSHOTS =====

  app.get("/api/servers/:serverId/analytics/detailed", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.params;
      const { days = 30 } = req.query;
      
      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days as string));

      const snapshots = await storage.getAnalyticsSnapshots(serverId, startDate, endDate);
      const latest = await storage.getLatestAnalyticsSnapshot(serverId);
      
      const bans = await storage.getBansByServerId(serverId);
      const appeals = await storage.getAppealsByServerId(serverId);
      const tickets = await storage.getTicketsByServerId(serverId);
      const reports = await storage.getReportsByServerId(serverId);

      res.json({
        latest: latest || {
          totalBans: bans.length,
          activeBans: bans.filter(b => b.isActive).length,
          totalAppeals: appeals.length,
          pendingAppeals: appeals.filter(a => a.status === "pending").length,
          approvedAppeals: appeals.filter(a => a.status === "approved").length,
          rejectedAppeals: appeals.filter(a => a.status === "rejected").length,
          totalTickets: tickets.length,
          openTickets: tickets.filter(t => t.status === "open").length,
          closedTickets: tickets.filter(t => t.status === "closed").length,
          totalReports: reports.length,
          pendingReports: reports.filter(r => r.status === "pending").length,
        },
        snapshots,
        trends: {
          bans: bans.filter(b => new Date(b.createdAt) >= startDate).length,
          appeals: appeals.filter(a => new Date(a.createdAt) >= startDate).length,
          tickets: tickets.filter(t => new Date(t.createdAt) >= startDate).length,
          reports: reports.filter(r => new Date(r.createdAt) >= startDate).length,
        },
      });
    } catch (error: any) {
      console.error("Get detailed analytics error:", error);
      res.status(500).json({ error: "Failed to fetch detailed analytics" });
    }
  });

  // ===== ENHANCED BAN/APPEAL/TICKET ROUTES WITH FILTERS =====

  app.get("/api/servers/:serverId/bans/filtered", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.params;
      const { status, search, bannedBy, startDate, endDate, limit } = req.query;
      
      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const filters: any = { status: status as any, search, bannedBy };
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      if (limit) filters.limit = parseInt(limit as string);

      const bans = await storage.getBansWithFilters(serverId, filters);
      res.json(bans);
    } catch (error: any) {
      console.error("Get filtered bans error:", error);
      res.status(500).json({ error: "Failed to fetch filtered bans" });
    }
  });

  app.get("/api/servers/:serverId/appeals/filtered", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.params;
      const { status, reviewedBy, startDate, endDate, limit } = req.query;
      
      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const filters: any = { status, reviewedBy };
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      if (limit) filters.limit = parseInt(limit as string);

      const appeals = await storage.getAppealsWithFilters(serverId, filters);
      res.json(appeals);
    } catch (error: any) {
      console.error("Get filtered appeals error:", error);
      res.status(500).json({ error: "Failed to fetch filtered appeals" });
    }
  });

  app.get("/api/servers/:serverId/tickets/filtered", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.params;
      const { status, category, priority, assignedTo, search, limit } = req.query;
      
      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const filters: any = { status, category, priority, assignedTo, search };
      if (limit) filters.limit = parseInt(limit as string);

      const tickets = await storage.getTicketsWithFilters(serverId, filters);
      res.json(tickets);
    } catch (error: any) {
      console.error("Get filtered tickets error:", error);
      res.status(500).json({ error: "Failed to fetch filtered tickets" });
    }
  });

  // ===== MARKETPLACE ROUTES =====

  // Get all listings with filters
  app.get("/api/marketplace/listings", async (req, res) => {
    try {
      const { sellerId, serverId, category, status, search, limit } = req.query;
      const listings = await storage.getListings({
        sellerId: sellerId as string,
        serverId: serverId as string,
        category: category as string,
        status: status as string,
        search: search as string,
        limit: limit ? parseInt(limit as string) : 100,
      });
      
      // Attach seller information
      const listingsWithSellers = await Promise.all(listings.map(async (listing: any) => {
        const seller = await storage.getUser(listing.sellerId);
        return {
          ...listing,
          seller: seller ? {
            id: seller.id,
            username: seller.username,
            avatar: seller.avatar,
            discriminator: seller.discriminator
          } : null
        };
      }));
      
      res.json(listingsWithSellers);
    } catch (error: any) {
      console.error("Get listings error:", error);
      res.status(500).json({ error: "Failed to fetch listings" });
    }
  });

  // Get single listing
  app.get("/api/marketplace/listings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const listing = await storage.getListing(id);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      
      // Attach seller information
      const seller = await storage.getUser(listing.sellerId);
      const listingWithSeller = {
        ...listing,
        seller: seller ? {
          id: seller.id,
          username: seller.username,
          avatar: seller.avatar,
          discriminator: seller.discriminator
        } : null
      };
      
      res.json(listingWithSeller);
    } catch (error: any) {
      console.error("Get listing error:", error);
      res.status(500).json({ error: "Failed to fetch listing" });
    }
  });

  // Create listing
  app.post("/api/marketplace/listings", requireAuth, async (req: any, res) => {
    try {
      const listing = await storage.createListing({
        ...req.body,
        sellerId: req.user.id,
      });
      res.json(listing);
    } catch (error: any) {
      console.error("Create listing error:", error);
      res.status(500).json({ error: "Failed to create listing" });
    }
  });

  // Update listing
  app.patch("/api/marketplace/listings/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const listing = await storage.getListing(id);
      
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      
      if (listing.sellerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      const updated = await storage.updateListing(id, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error("Update listing error:", error);
      res.status(500).json({ error: "Failed to update listing" });
    }
  });

  // Delete listing
  app.delete("/api/marketplace/listings/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const listing = await storage.getListing(id);
      
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      
      if (listing.sellerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      await storage.deleteListing(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete listing error:", error);
      res.status(500).json({ error: "Failed to delete listing" });
    }
  });

  // Get offers for a listing
  app.get("/api/marketplace/listings/:listingId/offers", requireAuth, async (req: any, res) => {
    try {
      const { listingId } = req.params;
      const listing = await storage.getListing(listingId);
      
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      
      if (listing.sellerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      const offers = await storage.getOffersByListing(listingId);
      res.json(offers);
    } catch (error: any) {
      console.error("Get offers error:", error);
      res.status(500).json({ error: "Failed to fetch offers" });
    }
  });

  // Create offer
  app.post("/api/marketplace/offers", requireAuth, async (req: any, res) => {
    try {
      const offer = await storage.createOffer({
        ...req.body,
        buyerId: req.user.id,
      });
      res.json(offer);
    } catch (error: any) {
      console.error("Create offer error:", error);
      res.status(500).json({ error: "Failed to create offer" });
    }
  });

  // Update offer (accept/reject)
  app.patch("/api/marketplace/offers/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const offer = await storage.getOffer(id);
      
      if (!offer) {
        return res.status(404).json({ error: "Offer not found" });
      }
      
      const listing = await storage.getListing(offer.listingId);
      if (!listing || (listing.sellerId !== req.user.id && offer.buyerId !== req.user.id)) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      const updated = await storage.updateOffer(id, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error("Update offer error:", error);
      res.status(500).json({ error: "Failed to update offer" });
    }
  });

  // Get transactions
  app.get("/api/marketplace/transactions", requireAuth, async (req: any, res) => {
    try {
      const { listingId, status, limit } = req.query;
      const transactions = await storage.getTransactions({
        userId: req.user.id,
        listingId: listingId as string,
        status: status as string,
        limit: limit ? parseInt(limit as string) : 100,
      });
      res.json(transactions);
    } catch (error: any) {
      console.error("Get transactions error:", error);
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  // Get single transaction
  app.get("/api/marketplace/transactions/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const transaction = await storage.getTransaction(id);
      
      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }
      
      if (transaction.sellerId !== req.user.id && transaction.buyerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      res.json(transaction);
    } catch (error: any) {
      console.error("Get transaction error:", error);
      res.status(500).json({ error: "Failed to fetch transaction" });
    }
  });

  // Create transaction
  app.post("/api/marketplace/transactions", requireAuth, async (req: any, res) => {
    try {
      const transaction = await storage.createTransaction(req.body);
      
      // Create escrow automatically
      await storage.createEscrow({
        transactionId: transaction.id,
        amount: transaction.amount,
        currency: transaction.currency,
      });
      
      // Log transaction creation
      await storage.createTransactionLog({
        transactionId: transaction.id,
        action: "created",
        performedBy: req.user.id,
        details: { transactionData: req.body },
      });
      
      res.json(transaction);
    } catch (error: any) {
      console.error("Create transaction error:", error);
      res.status(500).json({ error: "Failed to create transaction" });
    }
  });

  // Update transaction
  app.patch("/api/marketplace/transactions/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const transaction = await storage.getTransaction(id);
      
      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }
      
      if (transaction.sellerId !== req.user.id && transaction.buyerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      const updated = await storage.updateTransaction(id, req.body);
      
      // Log transaction update
      await storage.createTransactionLog({
        transactionId: id,
        action: "updated",
        performedBy: req.user.id,
        details: { changes: req.body },
      });
      
      res.json(updated);
    } catch (error: any) {
      console.error("Update transaction error:", error);
      res.status(500).json({ error: "Failed to update transaction" });
    }
  });

  // Get escrow for transaction
  app.get("/api/marketplace/transactions/:transactionId/escrow", requireAuth, async (req: any, res) => {
    try {
      const { transactionId } = req.params;
      const transaction = await storage.getTransaction(transactionId);
      
      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }
      
      if (transaction.sellerId !== req.user.id && transaction.buyerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      const escrow = await storage.getEscrowByTransaction(transactionId);
      res.json(escrow);
    } catch (error: any) {
      console.error("Get escrow error:", error);
      res.status(500).json({ error: "Failed to fetch escrow" });
    }
  });

  // Update escrow (confirm, dispute, release)
  app.patch("/api/marketplace/escrow/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const escrow = await storage.getEscrow(id);
      
      if (!escrow) {
        return res.status(404).json({ error: "Escrow not found" });
      }
      
      const transaction = await storage.getTransaction(escrow.transactionId);
      if (!transaction || (transaction.sellerId !== req.user.id && transaction.buyerId !== req.user.id)) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      const updated = await storage.updateEscrow(id, req.body);
      
      // Log escrow update
      await storage.createTransactionLog({
        transactionId: escrow.transactionId,
        action: "escrow_updated",
        performedBy: req.user.id,
        details: { changes: req.body },
      });
      
      res.json(updated);
    } catch (error: any) {
      console.error("Update escrow error:", error);
      res.status(500).json({ error: "Failed to update escrow" });
    }
  });

  // Get user reviews
  app.get("/api/marketplace/users/:userId/reviews", async (req, res) => {
    try {
      const { userId } = req.params;
      const reviews = await storage.getReviewsByUser(userId);
      res.json(reviews);
    } catch (error: any) {
      console.error("Get reviews error:", error);
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });

  // Create review
  app.post("/api/marketplace/reviews", requireAuth, async (req: any, res) => {
    try {
      const review = await storage.createReview({
        ...req.body,
        reviewerId: req.user.id,
      });
      
      // Update reputation
      const reputation = await storage.getOrCreateReputation(req.body.reviewedUserId);
      const reviews = await storage.getReviewsByUser(req.body.reviewedUserId);
      const avgRating = reviews.reduce((sum, r: any) => sum + r.rating, 0) / reviews.length;
      
      await storage.updateReputation(req.body.reviewedUserId, {
        averageRating: avgRating,
        totalReviews: reviews.length,
      });
      
      res.json(review);
    } catch (error: any) {
      console.error("Create review error:", error);
      res.status(500).json({ error: "Failed to create review" });
    }
  });

  // Get user reputation
  app.get("/api/marketplace/users/:userId/reputation", async (req, res) => {
    try {
      const { userId } = req.params;
      const reputation = await storage.getOrCreateReputation(userId);
      res.json(reputation);
    } catch (error: any) {
      console.error("Get reputation error:", error);
      res.status(500).json({ error: "Failed to fetch reputation" });
    }
  });

  // Get seller verification
  app.get("/api/marketplace/users/:userId/verification", requireAuth, async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      if (userId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      const verification = await storage.getOrCreateSellerVerification(userId);
      res.json(verification);
    } catch (error: any) {
      console.error("Get verification error:", error);
      res.status(500).json({ error: "Failed to fetch verification" });
    }
  });

  // Update seller verification
  app.patch("/api/marketplace/users/:userId/verification", requireAuth, async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      if (userId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      const updated = await storage.updateSellerVerification(userId, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error("Update verification error:", error);
      res.status(500).json({ error: "Failed to update verification" });
    }
  });

  // Get transaction logs
  app.get("/api/marketplace/transactions/:transactionId/logs", requireAuth, async (req: any, res) => {
    try {
      const { transactionId } = req.params;
      const transaction = await storage.getTransaction(transactionId);
      
      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }
      
      if (transaction.sellerId !== req.user.id && transaction.buyerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      const logs = await storage.getTransactionLogs(transactionId);
      res.json(logs);
    } catch (error: any) {
      console.error("Get transaction logs error:", error);
      res.status(500).json({ error: "Failed to fetch transaction logs" });
    }
  });

  // ===== CHANGELOG ROUTES =====
  
  app.get("/api/changelogs", requireAuth, async (req: any, res) => {
    try {
      const { serverId } = req.query;
      
      // If serverId is provided, filter by it (and check ownership)
      if (serverId) {
        const server = await storage.getServer(serverId);
        if (!server || server.ownerId !== req.user.id) {
          return res.status(403).json({ error: "Not authorized" });
        }
        
        const result = await pool.query(
          "SELECT * FROM changelogs WHERE server_id = $1 ORDER BY published_at DESC LIMIT 50",
          [serverId]
        );
        return res.json(result.rows);
      }
      
      // Otherwise, return changelogs for all servers owned by the user
      const servers = await storage.getServersByUserId(req.user.id);
      const serverIds = servers.map(s => s.id);
      
      if (serverIds.length === 0) {
        return res.json([]);
      }
      
      const result = await pool.query(
        `SELECT * FROM changelogs WHERE server_id = ANY($1) ORDER BY published_at DESC LIMIT 50`,
        [serverIds]
      );
      res.json(result.rows);
    } catch (error: any) {
      console.error("Get changelogs error:", error);
      res.status(500).json({ error: "Failed to fetch changelogs" });
    }
  });

  app.post("/api/changelogs", requireAuth, async (req: any, res) => {
    try {
      const { serverId, title, version, content, category, emoji } = req.body;
      
      // Validate required fields
      if (!serverId || !title || !version || !content) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Check if user owns the server
      const server = await storage.getServer(serverId);
      if (!server || server.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized - you must be the server owner to post changelogs" });
      }

      // Insert changelog into database
      const result = await pool.query(
        `INSERT INTO changelogs (server_id, title, version, content, category, emoji, author_id, posted_to_discord)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [serverId, title, version, content, category || "general", emoji, req.user.id, false]
      );

      const changelog = result.rows[0];

      // Post to Discord webhook if configured
      const webhookUrl = process.env.DISCORD_CHANGELOG_WEBHOOK;
      if (webhookUrl) {
        try {
          const embed = {
            title: `**Changelog – ${version}**`,
            description: content,
            color: 0x6B21A8, // Purple color
            footer: {
              text: "Questions or feedback? Post in #feedback"
            },
            timestamp: new Date().toISOString()
          };

          // Add emoji to description if provided
          if (emoji) {
            embed.description = `${emoji} ${embed.description}`;
          }

          const webhookPayload = {
            embeds: [embed],
            username: "RoModerate Updates",
            avatar_url: "https://i.imgur.com/AfFp7pu.png" // Optional: Add your bot avatar URL
          };

          const response = await fetch(webhookUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(webhookPayload),
          });

          if (response.ok) {
            // Update changelog to mark as posted to Discord
            await pool.query(
              "UPDATE changelogs SET posted_to_discord = $1 WHERE id = $2",
              [true, changelog.id]
            );
            changelog.posted_to_discord = true;
          } else {
            console.error("Discord webhook failed:", await response.text());
          }
        } catch (webhookError) {
          console.error("Discord webhook error:", webhookError);
          // Don't fail the entire request if webhook fails
        }
      }

      res.json(changelog);
    } catch (error: any) {
      console.error("Create changelog error:", error);
      res.status(500).json({ error: "Failed to create changelog" });
    }
  });

  // ===== VANITY URL REDIRECT =====
  
  // Vanity URL redirect under /v/ prefix to avoid conflicts
  app.get("/v/:vanityUrl", async (req, res, next) => {
    try {
      const { vanityUrl } = req.params;
      
      // Find server with matching vanity URL
      const servers = await storage.getAllServers();
      const server = servers.find((s: any) => {
        const settings = s.settings || {};
        return settings.vanityUrl === vanityUrl;
      });
      
      if (server) {
        // Redirect to the server's dashboard
        return res.redirect(`/servers/${server.id}`);
      }
      
      // No match found, return 404
      res.status(404).json({ error: "Vanity URL not found" });
    } catch (error) {
      console.error("[Vanity URL] Error:", error);
      res.status(500).json({ error: "Failed to resolve vanity URL" });
    }
  });

  return httpServer;
}
