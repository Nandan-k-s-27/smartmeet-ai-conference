# 🚀 SmartMeet Deployment Checklist

This file guides you through deploying SmartMeet to production.

## ✅ Pre-Deployment Checklist

### 1. Code Ready
- [ ] All features tested locally
- [ ] No console errors in browser
- [ ] Backend running without errors
- [ ] All dependencies installed

### 2. Accounts Created
- [ ] GitHub account (code repository)
- [ ] Vercel account (frontend hosting)
- [ ] Railway account (backend hosting)
- [ ] MongoDB Atlas account (database)
- [ ] Google Cloud account (Gemini AI API)

### 3. API Keys & Credentials
- [ ] MongoDB connection string obtained
- [ ] Gemini API key(s) obtained
- [ ] API keys stored securely (not in code)

---

## 📝 Step-by-Step Deployment

### Step 1: Push to GitHub

```bash
# Initialize git (if not already done)
cd "E:\project versions\Production\SMART-MEET-An_AI_Powered_Conference_App"
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: SmartMeet AI Conference App"

# Create GitHub repository (via GitHub website)
# Repository name: smartmeet-ai-conference
# Description: Use the one provided
# Public or Private: Your choice

# Add remote and push
git remote add origin https://github.com/YOUR_USERNAME/smartmeet-ai-conference.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy Backend to Railway

1. **Go to**: https://railway.app
2. **Sign in** with GitHub
3. **Create New Project** → "Deploy from GitHub repo"
4. **Select Repository**: smartmeet-ai-conference
5. **Root Directory**: Click "Configure" → Set to `backend`
6. **Add Variables** (Settings → Variables):
   ```
   NODE_ENV=production
   PORT=5000
   MONGODB_URI=<your_mongodb_atlas_uri>
   GEMINI_API_KEY=<your_gemini_api_key>
   ALLOWED_ORIGINS=<will_add_vercel_url_later>
   ```
7. **Deploy** and wait for build to complete
8. **Copy** your Railway URL (e.g., `smartmeet-backend-production.up.railway.app`)
9. **Test**: Visit `https://your-url.railway.app/health`

### Step 3: Deploy Frontend to Vercel

1. **Go to**: https://vercel.com
2. **Sign in** with GitHub
3. **Add New** → **Project**
4. **Import** your GitHub repository
5. **Configure Project**:
   - Framework Preset: **Create React App**
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `build`
6. **Add Environment Variable**:
   ```
   REACT_APP_API_URL=https://your-backend.railway.app
   ```
   ⚠️ Replace with YOUR Railway backend URL (no trailing slash)
7. **Deploy** and wait for build
8. **Copy** your Vercel URL (e.g., `smartmeet-ai-conference.vercel.app`)

### Step 4: Update Backend CORS

1. **Go back** to Railway dashboard
2. **Click** on your project → Variables
3. **Update** `ALLOWED_ORIGINS`:
   ```
   ALLOWED_ORIGINS=https://your-vercel-url.vercel.app
   ```
   ⚠️ Replace with YOUR Vercel URL
4. **Redeploy** backend (it will auto-redeploy on variable change)

### Step 5: MongoDB Atlas Setup

1. **Go to**: https://www.mongodb.com/cloud/atlas
2. **Create Account** and **Create Cluster** (FREE M0 tier)
3. **Database Access**:
   - Click "Database Access" → Add New Database User
   - Username: `smartmeet`
   - Password: Generate strong password
   - Role: Atlas admin (or Read/Write to any database)
4. **Network Access**:
   - Click "Network Access" → Add IP Address
   - Add: `0.0.0.0/0` (allow all) or specific Railway IPs
5. **Get Connection String**:
   - Click "Connect" → "Connect your application"
   - Copy connection string
   - Replace `<password>` with your password
   - Replace `<dbname>` with `smartmeet`
   - Example: `mongodb+srv://smartmeet:password123@cluster0.xxxxx.mongodb.net/smartmeet?retryWrites=true&w=majority`
6. **Add to Railway**:
   - Go back to Railway → Variables
   - Update `MONGODB_URI` with your connection string

### Step 6: Google Gemini AI API

1. **Go to**: https://makersuite.google.com/app/apikey
2. **Sign in** with Google account
3. **Create API Key**
4. **Copy** the API key
5. **Add to Railway** Variables:
   ```
   GEMINI_API_KEY=AIzaSy...your_key_here
   ```

---

## 🧪 Testing Deployment

### Test Backend
```bash
# Health check
curl https://your-backend.railway.app/health

# Expected response:
# {"status":"ok","uptime":123,"mongodb":"connected"}
```

### Test Frontend
1. Open: `https://your-app.vercel.app`
2. Click "Create Meeting"
3. Enter name and create
4. Open in another browser/device
5. Join with Meeting ID
6. Test all features:
   - [ ] Video/Audio working
   - [ ] Chat messages sending
   - [ ] Screen share working
   - [ ] Face detection active
   - [ ] AI summary generation

---

## 🔍 Troubleshooting

### Backend Issues
- Check Railway logs: Project → Deployments → View Logs
- Verify all environment variables are set
- Check MongoDB connection string format
- Verify Gemini API key is valid

### Frontend Issues
- Check Vercel logs: Deployment → Function Logs
- Verify `REACT_APP_API_URL` is correct (no trailing slash)
- Check browser console for errors (F12)
- Verify CORS is configured correctly

### Connection Issues
- Ensure both frontend and backend use HTTPS
- Check CORS `ALLOWED_ORIGINS` includes Vercel URL
- Verify WebSocket connections work (check Network tab)

---

## 📊 Post-Deployment

### Monitor Your App
- **Railway**: Monitor CPU/Memory usage, Logs
- **Vercel**: Monitor bandwidth, function invocations
- **MongoDB Atlas**: Monitor connections, storage

### Custom Domain (Optional)
1. **Vercel**: Settings → Domains → Add Domain
2. **Railway**: Settings → Public Networking → Custom Domain
3. Update CORS settings with new domain

### Backup & Security
- [ ] Regular MongoDB backups (Atlas automated backups)
- [ ] Rotate API keys periodically
- [ ] Monitor usage quotas
- [ ] Set up error tracking (Sentry, etc.)

---

## 💰 Cost Estimates

### Free Tier Limits
- **Railway**: $5 free credit/month, then pay-as-you-go
- **Vercel**: 100GB bandwidth/month, unlimited hobby projects
- **MongoDB Atlas**: 512MB storage (M0 free tier)
- **Google Gemini**: Free tier with rate limits

### When to Upgrade
- Railway: When free credit exhausted (~50-100 concurrent users)
- MongoDB: When storage > 512MB
- Gemini API: When hitting rate limits (use multiple keys)

---

## 📝 Environment Variables Summary

### Backend (Railway)
```bash
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/smartmeet
GEMINI_API_KEY=your_api_key
GEMINI_API2=backup_key_optional
GEMINI_API3=backup_key_optional
ALLOWED_ORIGINS=https://your-app.vercel.app
```

### Frontend (Vercel)
```bash
REACT_APP_API_URL=https://your-backend.railway.app
```

---

## ✅ Deployment Complete!

Your SmartMeet app is now live! 🎉

- **Frontend**: https://your-app.vercel.app
- **Backend**: https://your-backend.railway.app
- **Health**: https://your-backend.railway.app/health

Share your meeting link and start conferencing! 🚀
