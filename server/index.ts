import "./env";
import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeDatabase } from "./db";
import { storage } from "./storage";

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
  limit: '50mb' // Increased limit for larger uploads
}));
app.use(express.urlencoded({ extended: false, limit: '50mb' })); // Increased limit for larger uploads
app.use(cookieParser());

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Seed default admin user
async function seedAdminUser() {
  try {
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    // Check if admin already exists
    const existingAdmin = await storage.getAdminByUsername(adminUsername);
    
    if (!existingAdmin) {
      console.log('[Admin] Seeding default admin user...');
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      
      await storage.createAdmin({
        username: adminUsername,
        passwordHash,
        role: 'admin',
      });
      
      console.log('[Admin] ✓ Default admin user created');
      console.log('[Admin] Username:', adminUsername);
      console.log('[Admin] Password:', adminPassword);
      console.log('[Admin] Please change these credentials immediately!');
    }
  } catch (error) {
    console.error('[Admin] Warning: Could not seed admin user:', error);
  }
}

(async () => {
  // Initialize database tables (non-blocking)
  initializeDatabase().catch(err => {
    console.error('[Database] Warning: Could not initialize database:', err.message);
    console.error('[Database] The server will start anyway, but database features may not work until the database is properly configured.');
  });

  // Seed admin user after database initialization
  setTimeout(() => {
    seedAdminUser().catch(err => {
      console.error('[Admin] Warning: Failed to seed admin user:', err.message);
    });
  }, 2000); // Wait 2 seconds for database to be ready

  const server = await registerRoutes(app);

  // Start centralized Discord bot (non-blocking)
  import('./discord-bot-manager').then(({ botManager }) => {
    botManager.startCentralizedBot().catch(err => {
      console.error('[Discord Bot] Warning: Failed to start centralized bot:', err.message);
      console.error('[Discord Bot] Server will continue running, but Discord features may not work.');
    });

    // Auto-start all user-configured bots
    setTimeout(() => {
      botManager.startAllBots().catch(err => {
        console.error('[Discord Bot] Warning: Failed to auto-start user bots:', err.message);
      });
    }, 2000); // Wait 2 seconds for database to be ready
  }).catch(err => {
    console.error('[Discord Bot] Warning: Failed to load bot manager:', err.message);
    console.error('[Discord Bot] Server will continue running, but Discord features may not work.');
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    // Don't throw - just log the error to prevent crash
    console.error('[Error Handler]', message);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "127.0.0.1",
  }, () => {
    log(`serving on port ${port}`);
  });
})();