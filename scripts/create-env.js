#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envTemplate = `# Discord OAuth Configuration
DISCORD_CLIENT_ID=\${DISCORD_CLIENT_ID}
DISCORD_CLIENT_SECRET=\${DISCORD_CLIENT_SECRET}
REDIRECT_URI=http://localhost:5000/api/auth/callback/discord

# Database Configuration
DATABASE_URL=\${DATABASE_URL}

# Session Secret
SESSION_SECRET=\${SESSION_SECRET}

# Encryption Key (exactly 32 characters)
ENCRYPTION_KEY=\${ENCRYPTION_KEY}

# API Keys
BLOXLINK_API_KEY=\${BLOXLINK_API_KEY:-}

# Client-side Environment Variables (must be prefixed with VITE_)
VITE_DISCORD_CLIENT_ID=\${VITE_DISCORD_CLIENT_ID}
`;

const envPath = path.join(process.cwd(), '.env');

try {
  // Read environment variables from process.env
  let envContent = envTemplate;
  
  // Replace template variables with actual environment variables or empty strings
  envContent = envContent.replace(/\$\{([^}:-]+)(?::-[^}]*)?\}/g, (match, varName) => {
    return process.env[varName] || '';
  });

  fs.writeFileSync(envPath, envContent, 'utf8');
  console.log('✓ .env file created successfully!');
  
  if (!process.env.DATABASE_URL) {
    console.warn('⚠ Warning: DATABASE_URL not set. Please add your database URL to the .env file.');
  }
  if (!process.env.DISCORD_CLIENT_ID) {
    console.warn('⚠ Warning: DISCORD_CLIENT_ID not set. Please add your Discord client ID to the .env file.');
  }
  if (!process.env.SESSION_SECRET) {
    console.warn('⚠ Warning: SESSION_SECRET not set. Please add a session secret to the .env file.');
  }
  if (!process.env.ENCRYPTION_KEY) {
    console.warn('⚠ Warning: ENCRYPTION_KEY not set. Please add an encryption key (32 characters) to the .env file.');
  }
} catch (error) {
  console.error('✗ Error creating .env file:', error.message);
  process.exit(1);
}
