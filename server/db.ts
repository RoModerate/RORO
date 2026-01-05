// Database connection setup for PostgreSQL with Drizzle ORM
import "./env";
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure Neon to use WebSocket for connections
neonConfig.webSocketConstructor = ws;

const DATABASE_URL = process.env.DATABASE_URL;

let poolInstance: Pool | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;

// Initialize database connection if DATABASE_URL is available
if (DATABASE_URL) {
  console.log("[Database] Connecting to PostgreSQL database");
  try {
    poolInstance = new Pool({ connectionString: DATABASE_URL });
    dbInstance = drizzle(poolInstance, { schema });
    console.log("[Database] ✓ Database connection established");
  } catch (error: any) {
    console.error("[Database] ✗ Failed to connect to database:", error.message);
    console.error("[Database] Please check your DATABASE_URL configuration");
  }
} else {
  console.warn("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.warn("[Database] ⚠️  DATABASE_URL environment variable not found");
  console.warn("[Database] ");
  console.warn("[Database] Database features are DISABLED. The server will use");
  console.warn("[Database] in-memory storage, which means:");
  console.warn("[Database]   • All data will be lost when the server restarts");
  console.warn("[Database]   • Bot configurations won't persist");
  console.warn("[Database]   • User data won't be saved");
  console.warn("[Database] ");
  console.warn("[Database] To enable database features:");
  console.warn("[Database]   1. Go to Replit Secrets (lock icon in sidebar)");
  console.warn("[Database]   2. Add DATABASE_URL with your database connection string");
  console.warn("[Database]   3. Restart the application");
  console.warn("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

// Export pool that can be null
export const pool = poolInstance;

// Export db with runtime check to prevent null usage
export const db: ReturnType<typeof drizzle> = new Proxy({} as any, {
  get(_target, prop) {
    if (!dbInstance) {
      throw new Error(
        '[Database] Database not initialized. DATABASE_URL environment variable must be configured. ' +
        'Please add DATABASE_URL to your environment variables (Replit Secrets) and restart the application.'
      );
    }
    const value = (dbInstance as any)[prop];
    return typeof value === 'function' ? value.bind(dbInstance) : value;
  }
});

// Helper to check if database is available
export function isDatabaseAvailable(): boolean {
  return dbInstance !== null && poolInstance !== null;
}

// Initialize database tables  
export async function initializeDatabase() {
  if (!poolInstance || !dbInstance) {
    console.log('[Database] In-memory storage mode - no database initialization needed');
    return;
  }

  const createTablesSQL = `
    -- Enable UUID extension
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      discord_id VARCHAR(255) NOT NULL UNIQUE,
      username VARCHAR(255) NOT NULL,
      discriminator VARCHAR(10),
      avatar VARCHAR(255),
      email VARCHAR(255),
      access_token TEXT,
      refresh_token TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Servers table
    CREATE TABLE IF NOT EXISTS servers (
      id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
      discord_server_id VARCHAR(255) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      icon VARCHAR(255),
      owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      settings JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Bot registrations table
    CREATE TABLE IF NOT EXISTS bot_registrations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      server_id VARCHAR(255) NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      bot_id VARCHAR(255) NOT NULL UNIQUE,
      secret_hash TEXT NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      webhook_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- API keys table
    CREATE TABLE IF NOT EXISTS api_keys (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key_hash TEXT NOT NULL UNIQUE,
      server_id VARCHAR(255) NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      scopes JSONB DEFAULT '[]'::jsonb,
      last_used TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Bans table
    CREATE TABLE IF NOT EXISTS bans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      server_id VARCHAR(255) NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      roblox_user_id VARCHAR(255) NOT NULL,
      roblox_username VARCHAR(255),
      discord_user_id VARCHAR(255),
      ban_type VARCHAR(50) NOT NULL,
      reason TEXT NOT NULL,
      evidence JSONB DEFAULT '[]'::jsonb,
      banned_by_id UUID NOT NULL REFERENCES users(id),
      expires_at TIMESTAMP,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS bans_server_roblox_user_unique ON bans(server_id, roblox_user_id);

    -- Appeals table
    CREATE TABLE IF NOT EXISTS appeals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ban_id UUID NOT NULL REFERENCES bans(id) ON DELETE CASCADE,
      server_id VARCHAR(255) NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      reviewed_by_id UUID REFERENCES users(id),
      response TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Tickets table
    CREATE TABLE IF NOT EXISTS tickets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      server_id VARCHAR(255) NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id),
      subject VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      status VARCHAR(50) DEFAULT 'open',
      priority VARCHAR(50) DEFAULT 'normal',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Discord bots table
    CREATE TABLE IF NOT EXISTS discord_bots (
      id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
      server_id VARCHAR(255) NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      bot_token_encrypted TEXT NOT NULL,
      bot_id VARCHAR(255) NOT NULL UNIQUE,
      bot_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'inactive',
      features TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      last_online TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    -- Roblox API keys table
    CREATE TABLE IF NOT EXISTS roblox_api_keys (
      id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
      server_id VARCHAR(255) NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      api_key_encrypted TEXT NOT NULL,
      universe_id VARCHAR(255),
      scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      last_used_at TIMESTAMP,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    -- Notifications table
    CREATE TABLE IF NOT EXISTS notifications (
      id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      server_id VARCHAR(255) REFERENCES servers(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata JSON,
      is_read BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    -- Create indexes for better query performance
    CREATE INDEX IF NOT EXISTS idx_servers_owner_id ON servers(owner_id);
    CREATE INDEX IF NOT EXISTS idx_bans_server_id ON bans(server_id);
    CREATE INDEX IF NOT EXISTS idx_bans_roblox_user_id ON bans(roblox_user_id);
    CREATE INDEX IF NOT EXISTS idx_appeals_ban_id ON appeals(ban_id);
    CREATE INDEX IF NOT EXISTS idx_appeals_server_id ON appeals(server_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_server_id ON tickets(server_id);
    CREATE INDEX IF NOT EXISTS idx_bot_registrations_server_id ON bot_registrations(server_id);
    CREATE INDEX IF NOT EXISTS idx_api_keys_server_id ON api_keys(server_id);
    CREATE INDEX IF NOT EXISTS idx_discord_bots_server_id ON discord_bots(server_id);
    CREATE INDEX IF NOT EXISTS idx_roblox_api_keys_server_id ON roblox_api_keys(server_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_server_id ON notifications(server_id);
  `;

  try {
    console.log('[Database] Initializing tables...');
    await poolInstance!.query(createTablesSQL);
    console.log('[Database] ✓ Tables initialized successfully');
  } catch (error: any) {
    console.error('[Database] Error initializing tables:', error.message);
    throw error;
  }
}
