# SMART-MEET OAuth2 Fix - Complete Implementation Guide

## Problem Solved
Your 401 errors were caused by using the **ID Token Verification approach** instead of the proper **OAuth2 Authorization Code flow**. The new implementation uses your working HearTogether project as a reference, implementing Passport.js with the correct OAuth2 flow.

## What Was Changed

### Backend Changes (✓ COMPLETED)

#### 1. Dependencies Added
Updated `backend/package.json` with:
- `passport` - OAuth framework
- `passport-google-oauth20` - Google OAuth Strategy
- `express-session` - Session management

Run: `cd backend && npm install`

#### 2. New Utility File Created
**File**: `backend/utils/passportAuth.js`
- Initializes Passport Google Strategy
- Creates JWT tokens for authentication
- Verifies JWT tokens from cookies/headers
- Handles user creation/linking via Google profile

#### 3. Server Configuration Updated
**File**: `backend/server.js`
- Added session middleware setup
- Initialized Passport.js
- Sets up cookie-based sessions

#### 4. Auth Routes Updated
**File**: `backend/routes/authRoutes.js`
- **GET `/auth/google`** - Initiates OAuth flow
- **GET `/auth/google/callback`** - Google redirects back here
- **GET `/auth/status`** - Check if user is authenticated (NEW)
- **GET `/auth/me`** - Get current user
- **POST `/auth/refresh`** - Extend session
- **POST `/auth/logout`** - Clear cookies

#### 5. Auth Controller Rewritten
**File**: `backend/controllers/authController.js`
- Removed Google ID token verification
- Added `googleCallback()` - handles OAuth callback
- Added `getAuthStatus()` - checks authentication status (NEW)
- JWT tokens now issued by backend (not frontend)

#### 6. Auth Middleware Updated
**File**: `backend/middleware/authMiddleware.js`
- Now verifies `auth_token` JWT from cookies
- Sets `req.user` with decoded JWT data

#### 7. Environment Variables Updated
**File**: `backend/.env.example`
- `GOOGLE_CLIENT_SECRET` - Required for Passport (NEW)
- `GOOGLE_CALLBACK_URL` - OAuth callback URL (NEW)
- `JWT_SECRET` - For signing JWT tokens (NEW)
- `SESSION_SECRET` - For session management (NEW)
- `FRONTEND_URL` - For OAuth redirects (NEW)

### Frontend Changes (✓ COMPLETED)

#### 1. AuthContext Rewritten
**File**: `frontend/src/context/AuthContext.js`
- Removed credential posting approach
- `loginWithGoogle()` now redirects to backend OAuth endpoint
- Added `checkAuthStatus()` - validates current authentication
- Handles OAuth callback token from URL
- Supports account switching with `logout({ switchAccount: true })`

#### Key changes:
- Old: `loginWithGoogle(credential)` → POST to backend
- New: `loginWithGoogle()` → Redirect to `/auth/google`
- OAuth callback URL → Stored as cookie by backend
- Frontend checks cookies for `auth_token`

#### 2. MeetingHomePage Partially Updated
**File**: `frontend/src/pages/MeetingHomePage.js`
- Removed `GoogleLogin` component import
- Replaced OAuth callback handler with redirect flow
- **STILL NEEDS**: Complete removal of GoogleLogin component JSX

## Step-by-Step Setup Instructions

### Step 1: Update Environment Variables

**Backend (.env)** - Copy from `.env.example` and fill in:
```
# Google OAuth credentials from Google Cloud Console
GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<your-client-secret>
GOOGLE_CALLBACK_URL=http://localhost:5000/auth/google/callback
FRONTEND_URL=http://localhost:3000

# Secrets (use long random strings)
JWT_SECRET=your-secure-jwt-secret-min-32-characters-for-production
SESSION_SECRET=your-secure-session-secret-min-32-characters

# Environment
NODE_ENV=development
PORT=5000
```

**Frontend (.env)** - Update/create:
```bash
REACT_APP_BACKEND_URL=http://localhost:5000
# NOTE: REACT_APP_GOOGLE_CLIENT_ID is NO LONGER NEEDED!
```

### Step 2: Install Dependencies
```bash
cd backend
npm install

cd ../frontend
npm install
```

### Step 3: Update Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project → APIs & Services → Credentials
3. Click on your OAuth 2.0 Web Application credentials
4. Under "Authorized redirect URIs", add:
   - `http://localhost:5000/auth/google/callback` (Local dev)
   - `https://your-render-backend.com/auth/google/callback` (Production)
5. Under "Authorized JavaScript origins", add:
   - `http://localhost:3000` (Local dev)
   - `https://your-vercel-frontend.com` (Production)
6. Copy Client ID and Secret to backend `.env`

### Step 4: Complete Frontend Updates

**File to update**: `frontend/src/pages/MeetingHomePage.js`

Find and remove these lines (around line 1):
```jsx
import { GoogleLogin } from '@react-oauth/google';
```

Replace the auth prompt section (search for `{showAuthPrompt &&`) with:
```jsx
{showAuthPrompt && (
  <div className="auth-prompt-popover" role="dialog" aria-label="Sign in with Google">
    <div className="auth-prompt-header">
      <strong>{pendingAction === 'switch' ? 'Switch Google account' : 'Sign in to continue'}</strong>
      <button
        type="button"
        className="auth-prompt-close"
        onClick={() => {
          setShowAuthPrompt(false);
          setPendingAction(null);
          setPendingJoinCode('');
        }}
        aria-label="Close sign-in prompt"
      >
        x
      </button>
    </div>
    <button
      type="button"
      className="auth-prompt-signin-btn"
      onClick={() => loginWithGoogle(pendingAction === 'switch' ? 'select_account' : undefined)}
      disabled={isLoading}
    >
      <i className="fab fa-google"></i>
      {pendingAction === 'switch' ? 'Switch account' : 'Sign in with Google'}
    </button>
    <p className="auth-prompt-note">Use your Google account to create or join meetings.</p>
  </div>
)}
```

Add this CSS to `App.css` if the button styling doesn't exist:
```css
.auth-prompt-signin-btn {
  width: 100%;
  padding: 12px;
  background-color: #1f2937;
  color: white;
  border: 1px solid #374151;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  transition: background-color 0.2s;
}

.auth-prompt-signin-btn:hover:not(:disabled) {
  background-color: #374151;
}

.auth-prompt-signin-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### Step 5: Test the Flow

1. **Start backend**:
```bash
cd backend
npm run dev
```
Verify output: `[express] Server listening on port 5000`

2. **Start frontend** (new terminal):
```bash
cd frontend
npm start
```
Verify output: Runs on http://localhost:3000

3. **Test login**:
   - Visit http://localhost:3000
   - Click "Sign in" button
   - You should be redirected to Google OAuth
   - After Google login, redirected back to app
   - Check DevTools → Application → Cookies
   - You should see `auth_token` cookie with your JWT

4. **Test protected endpoints**:
   - Try creating/joining a meeting
   - Should work without the 401 error

### Step 6: Production Deployment

**Backend (Render)**:
Set these env variables in Render:
```
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-client-secret>
GOOGLE_CALLBACK_URL=https://your-backend.onrender.com/auth/google/callback
FRONTEND_URL=https://your-frontend.vercel.app
JWT_SECRET=<long-random-string>
SESSION_SECRET=<long-random-string>
ALLOWED_ORIGINS=https://your-frontend.vercel.app
NODE_ENV=production
```

**Frontend (Vercel)**:
Set this env variable:
```
REACT_APP_BACKEND_URL=https://your-backend.onrender.com
```

Update Google Cloud Console (as in Step 3) with production URLs.

## Troubleshooting

### Still Getting 401 Errors?

1. **Check backend logs** for OAuth errors
2. **Verify env variables** are set correctly (especially GOOGLE_CLIENT_SECRET)
3. **Check Google Cloud Console** has correct redirect URIs
4. **Verify auth_token cookie** exists after login (DevTools → Cookies)
5. **Check CORS settings** if frontend is different origin

### Token Not Appearing in Cookie?

- Clear browser cookies
- Check backend `.env` has `GOOGLE_CALLBACK_URL` set correctly
- Verify `FRONTEND_URL` is correct (backend redirects here)
- Check browser console for redirect errors

### CORS Errors on Auth Calls?

- Ensure `ALLOWED_ORIGINS` or `FRONTEND_URL` matches frontend domain
- Check CORS middleware is properly configured in `server.js`
- Session cookie needs `SameSite=None; Secure` for cross-origin (handled automatically in production)

## Key Differences from Old Implementation

| Aspect | Old (Broken) | New (Fixed) |
|--------|--------------|------------|
| Flow Type | ID Token Verification | OAuth2 Authorization Code |
| Where tokens verified | Frontend (google-auth-library) | Backend (Passport.js) |
| How frontend logs in | POST credential to API | Redirect to OAuth endpoint |
| Token storage | localStorage | HTTP-only cookie |
| CORS issues | ✗ Cross-origin postMessage failures | ✓ Server-side redirect eliminates this |
| Client ID mismatch errors | ✗ Common frontend issue | ✓ Verified server-side only |
| Session persistence | Limited | Full with HTTP-only cookies |

## Reference

This implementation is based on HearTogether's working OAuth2 setup:
https://github.com/Nandan-k-s-27/HearTogether

The key insight is: **Don't try to verify Google tokens on the frontend**. Use Passport.js with the OAuth2 flow to have the backend handle authentication securely.
