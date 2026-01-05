import { config } from "dotenv";
import { resolve } from "path";

// Preserve non-empty Replit Secrets and remove empty ones
const replitSecrets: Record<string, string> = {};
const secretKeys = ['DATABASE_URL', 'ENCRYPTION_KEY', 'PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'];

console.log('[ENV] Checking for Replit Secrets...');
secretKeys.forEach(key => {
  const value = process.env[key];
  console.log(`[ENV] ${key}: ${value ? `exists (${value.substring(0, 20)}...)` : 'not found'}`);
  if (value !== undefined && value !== '') {
    replitSecrets[key] = value;
  } else if (value === '') {
    // Remove empty environment variables so .env can populate them
    delete process.env[key];
  }
});

if (Object.keys(replitSecrets).length > 0) {
  console.log(`[ENV] Preserved ${Object.keys(replitSecrets).length} Replit Secrets:`, Object.keys(replitSecrets).join(', '));
} else {
  console.log('[ENV] No Replit Secrets found in process.env');
}

// Load .env file (override: true to allow .env to populate empty Replit Secrets)
const result = config({ 
  path: resolve(process.cwd(), '.env'),
  override: true 
});

if (result.error) {
  console.warn('[ENV] Could not load .env file:', result.error.message);
} else {
  console.log('[ENV] Loaded .env file successfully');
}

// Restore Replit Secrets (they take precedence over .env)
Object.entries(replitSecrets).forEach(([key, value]) => {
  process.env[key] = value;
});

if (Object.keys(replitSecrets).length > 0) {
  console.log(`[ENV] Restored ${Object.keys(replitSecrets).length} Replit Secrets`);
}

// Verify critical environment variables
const criticalVars = ['DISCORD_BOT_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET'];
const missing = criticalVars.filter(varName => !process.env[varName]);

if (missing.length > 0) {
  console.error('[ENV] ⚠️  Missing critical environment variables:', missing.join(', '));
}

export {};
