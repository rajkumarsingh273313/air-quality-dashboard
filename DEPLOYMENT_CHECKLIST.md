# ✅ Vercel Deployment Checklist

## Pre-Deployment (Local Testing)

- [ ] Run `npm install` to ensure dependencies are installed
- [ ] Start local server: `npm start`
- [ ] Verify frontend loads at http://localhost:3000
- [ ] Test search/API calls (should work locally)
- [ ] Check console for any errors

## Pre-Push Checks

- [ ] Files in `/api` folder:
  - [ ] `handler.js` exists
  - [ ] `index.js` exists
  
- [ ] Files in `/public` folder:
  - [ ] `index.html` exists
  - [ ] `style.css` exists
  - [ ] `script.js` exists

- [ ] Root files:
  - [ ] `vercel.json` exists
  - [ ] `package.json` has correct dependencies
  - [ ] `.env` has local settings (for reference)

## Push to GitHub

```bash
git add .
git commit -m "Fix: Configure app for Vercel serverless deployment"
git push origin main
```

## Vercel Configuration

### Step 1: Connect Vercel to GitHub
- [ ] Go to [vercel.com](https://vercel.com)
- [ ] Sign in or create account
- [ ] Click "Add New" → "Project"
- [ ] Select your GitHub repository
- [ ] Click "Import"

### Step 2: Set Environment Variables
- [ ] In Vercel Dashboard, go to Project Settings
- [ ] Go to "Environment Variables" section
- [ ] Add variable: `MONGODB_URI` with your MongoDB Atlas connection string
  - Format: `mongodb+srv://username:password@cluster.mongodb.net/database-name?retryWrites=true`
  - Get this from MongoDB Atlas > Connect > Application
- [ ] Click "Save"

### Step 3: Deploy
- [ ] Click "Deploy" button
- [ ] Monitor deployment in "Deployments" tab
- [ ] Wait for build to complete (should say "Ready")

## Post-Deployment Testing

### Quick Tests

```bash
# Test health endpoint
curl https://your-vercel-url.vercel.app/api/health

# Should return something like:
# {"status":"healthy","timestamp":"...","mongo":"connected"}
```

### Manual Testing

1. Open your Vercel deployment URL in browser
2. You should see the AirIndex homepage
3. Try searching for a city (e.g., "Delhi")
4. Should fetch AQI data and display it
5. Data should save to MongoDB

### Common Issues

**❌ "Cannot find module"**
- [ ] Check all files are in git repository
- [ ] Run `git status` to see uncommitted files
- [ ] Commit and push missing files

**❌ "MongoDB Connection Failed"**
- [ ] Verify `MONGODB_URI` is set in Vercel Environment Variables
- [ ] Test connection string locally (copy-paste into `.env`)
- [ ] Check MongoDB Atlas IP whitelist (should include 0.0.0.0/0 or Vercel IPs)
- [ ] Verify connection string format is correct

**❌ "Not Found" for API endpoints**
- [ ] Check `vercel.json` exists in root
- [ ] Verify `/api` folder has `handler.js` and `index.js`
- [ ] Check build logs in Vercel Dashboard

**❌ Frontend not loading**
- [ ] Verify `/public` folder exists with all 3 files
- [ ] Check browser console for 404 errors
- [ ] Ensure paths in script tags are correct

## Monitoring

### View Logs
1. Vercel Dashboard → Deployments → [Your Deployment] → Logs
2. Look for "✅ MongoDB Connected" message
3. Check for any error messages

### Monitor Errors
- [ ] Set up error tracking (optional: Sentry, LogRocket)
- [ ] Monitor API response times
- [ ] Check database growth in MongoDB Atlas

## Success Indicators ✅

- [x] Vercel build succeeds
- [x] Deployment shows "Ready" status
- [x] `/api/health` endpoint responds
- [x] Frontend loads without 404 errors
- [x] Can search for cities
- [x] Data saves and displays correctly
- [x] MongoDB shows data in collection

## Reference Files

- `VERCEL_FIX.md` - Detailed explanation of changes
- `vercel.json` - Deployment configuration
- `api/handler.js` - Serverless function handler
- `.env.vercel` - Example environment variables

---

**Questions?** Check the detailed guide in `VERCEL_FIX.md`
