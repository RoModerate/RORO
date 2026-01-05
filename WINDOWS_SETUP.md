# Windows Compatibility Setup Guide

This document provides guidance for setting up and running the project on Windows.

## Overview

The project uses `cross-env` to ensure npm scripts are compatible with both Unix and Windows environments. This allows environment variables to be set correctly regardless of your operating system.

## Prerequisites

- **Node.js** v18+ (includes npm)
- **Git** for Windows (or WSL2 for better compatibility)
- **PowerShell 5.1+** or Command Prompt

## Installation

### Step 1: Clone and Install Dependencies

```bash
git clone <repository-url>
cd yaya
npm install
```

### Step 2: Setup Environment Variables

Use the cross-platform setup script:

```bash
npm run setup:env
```

Or manually create a `.env` file in the root directory with the following variables:

```env
# Discord OAuth Configuration
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
REDIRECT_URI=http://localhost:5000/api/auth/callback/discord

# Database Configuration
DATABASE_URL=your_neon_database_url

# Session Secret (any random string)
SESSION_SECRET=your_session_secret_here

# Encryption Key (exactly 32 characters)
ENCRYPTION_KEY=your32characterencryptionkey!

# API Keys
BLOXLINK_API_KEY=your_bloxlink_api_key_optional

# Client-side Environment Variables (must be prefixed with VITE_)
VITE_DISCORD_CLIENT_ID=your_discord_client_id
```

## Available npm Scripts

All scripts use `cross-env` for Windows compatibility:

### Development
```bash
npm run dev
```
Starts the development server with `NODE_ENV=development`.

### Building
```bash
npm run build
```
Builds both the client (Vite) and server (esbuild) with `NODE_ENV=production`.

### Production Server
```bash
npm run start
```
Runs the built production server with `NODE_ENV=production`.

### Type Checking
```bash
npm run check
```
Runs TypeScript compiler to check for type errors.

### Database Operations
```bash
npm run db:push
```
Pushes schema changes to the database using Drizzle Kit.

```bash
npm run db:migrate
```
Runs database migration scripts.

```bash
npm run db:init
```
Initializes the database with initial tables.

## Windows-Specific Notes

### PowerShell Execution Policy

If you encounter execution policy issues with PowerShell, you may need to:

1. **Temporary bypass** (current session only):
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
   ```

2. **Permanent change** (all sessions):
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

### Git Autocrlf

To avoid line-ending issues on Windows:

```bash
git config --global core.autocrlf true
```

### Using WSL2 (Recommended Alternative)

For better compatibility with Unix tools, consider using Windows Subsystem for Linux 2 (WSL2):

1. Install WSL2
2. Install Ubuntu or another Linux distribution
3. Follow the Linux setup instructions in the main README

## Troubleshooting

### Scripts fail to run

**Issue:** `npm scripts don't work in Command Prompt`

**Solution:** Use PowerShell instead, or ensure `cross-env` is properly installed:
```bash
npm install --save-dev cross-env
```

### Environment variables not recognized

**Issue:** `.env` file isn't being loaded

**Solution:** Ensure the `.env` file is in the root directory and:
- For development: Variables are automatically loaded
- For production: Set variables manually or use a `.env.production` file

### Port already in use

**Issue:** Port 5000 is already in use

**Solution:** Change the port in `vite.config.ts`:
```typescript
server: {
  port: 3000, // Change this number
  // ... rest of config
}
```

### CORS errors

**Issue:** CORS errors when accessing from different origins

**Solution:** Check that `REDIRECT_URI` and `VITE_DISCORD_CLIENT_ID` match your Discord OAuth settings.

## Additional Resources

- [cross-env Documentation](https://www.npmjs.com/package/cross-env)
- [Node.js on Windows](https://nodejs.org/en/learn/getting-started/nodejs-on-windows)
- [WSL2 Setup Guide](https://docs.microsoft.com/en-us/windows/wsl/install)
- [Vite Documentation](https://vitejs.dev/)

## Support

For additional help, refer to the main project documentation or open an issue on the repository.
