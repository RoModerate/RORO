# RoMarketplace - Setup & Troubleshooting Guide

## Recent Updates

### Rebranding to RoMarketplace
- Website renamed from "RoModerate" to "RoMarketplace"
- Landing page updated to show "Coming Soon" status
- Simplified landing page - removed "Powerful Features" section and complex CTAs
- Non-logged-in users now see only "Log In" button (no "Get Started" or "Browse Marketplace")
- Updated all branding to reflect marketplace focus

## Login

### Discord Login (Main)
```
Button: "Log In"
Action: Authenticates via Discord OAuth
Redirects to: Dashboard or Marketplace depending on role
```

## Accepting Terms & Policy for Marketplace

When you try to create a new marketplace listing, you'll see a modal asking you to accept the Terms & Privacy Policy.

### How to Accept TOS:
1. Click "Create Listing" or navigate to marketplace seller area
2. Read through the terms in the modal
3. **Check the checkbox** to confirm you've read and agree
4. Click **"Accept & Continue"** button

### If "Accept & Continue" Doesn't Work:
- Make sure the checkbox is checked (required)
- Check your browser console (F12) for errors
- Clear browser cache and try again
- Try in an incognito/private window
- Check that you're logged in with Discord

### Backend Endpoint:
- **Endpoint**: `POST /api/user/accept-tos`
- **Auth**: Requires Discord session cookie
- **Response**: Updates user's `tosAcceptedAt` timestamp
- **Logs saved at**: User profile in database

## Admin Panel

### Default Credentials
```
Username: admin
Password: admin (or set via ADMIN_PASSWORD env variable)
```

### How to Access Admin Panel:
1. Navigate to `/admin-login`
2. Enter username: `admin`
3. Enter password: `admin`
4. Click "Sign In"

### If Admin Login Doesn't Work:

**Issue 1: "Invalid credentials" error**
- Verify you're using the correct username and password
- Password is case-sensitive
- Check that the admin user was created (server logs should show this on startup)

**Issue 2: Can't see admin dashboard after login**
- Admin session cookie may not be set properly
- Try clearing browser cookies and logging in again
- Check browser dev tools → Application → Cookies for `adminSession` cookie
- Make sure you're using HTTPS in production

**Issue 3: Want to change admin password**
```bash
# Delete the old admin account from database
# On startup, new admin will be created with:
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_new_password
```

Then restart the server.

## Database Setup for Admin

The admin user is created automatically on server startup if it doesn't exist.

### To manually create an admin user:

```typescript
// From server/storage.ts
const passwordHash = await bcrypt.hash('your_password', 10);
await storage.createAdmin({
  username: 'admin',
  passwordHash,
  role: 'admin'
});
```

## TOS/Privacy Policy

### Where Terms & Privacy Are Stored:
- **Terms**: `/client/src/pages/terms.tsx`
- **Privacy**: `/client/src/pages/privacy.tsx`
- **Modal Component**: `/client/src/components/tos-acceptance-modal.tsx`

### Updating Terms:
Edit the respective `.tsx` files and redeploy.

### API Endpoints for TOS:
- `POST /api/user/accept-tos` - Accept marketplace terms
- `GET /terms` - View full terms page
- `GET /privacy` - View full privacy policy

## Coming Soon Features

The marketplace is currently in "Coming Soon" status on the landing page. This will be updated once the dashboard and terms/policy modules are fully completed.

### To Enable Full Marketplace Features:
1. Complete dashboard implementation
2. Test marketplace creation flow end-to-end
3. Update landing page coming soon banner
4. Set `MARKETPLACE_ENABLED=true` (if implemented) or remove the "Coming Soon" text

## Environment Variables

```env
# Admin credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin  # Change this immediately in production!

# Database
DATABASE_URL=your_database_url

# Discord OAuth
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
REDIRECT_URI=http://localhost:5000/api/auth/callback/discord

# Session
SESSION_SECRET=your_session_secret

# Encryption
ENCRYPTION_KEY=32_character_encryption_key_here!

# Optional
VITE_DISCORD_CLIENT_ID=your_client_id  # For frontend
```

## Troubleshooting Summary

| Issue | Solution |
|-------|----------|
| TOS Accept button doesn't work | Check checkbox is selected, verify logged in |
| Admin login fails | Verify credentials, check server logs for admin creation |
| Can't access admin dashboard | Check `adminSession` cookie is set |
| Marketplace creation blocked by TOS | Accept TOS modal when prompted |
| Can't see updated terms | Clear browser cache and reload |

## Support

For issues not listed here, check:
1. Browser console (F12) for JavaScript errors
2. Server logs for backend errors
3. Network tab in dev tools to see API responses
4. `.env` file to ensure all variables are set

---

Last Updated: January 5, 2026
