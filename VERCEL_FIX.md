# Vercel Deployment Fix Guide

## Problem Fixed

**Error**: `500: INTERNAL_SERVER_ERROR - FUNCTION_INVOCATION_FAILED`

**Causes**:
1. ❌ `server.js` used `app.listen()` which doesn't work on Vercel serverless functions
2. ❌ No proper handler export for Vercel
3. ❌ No `vercel.json` configuration
4. ❌ Static files (HTML, CSS, JS) not configured for serving
5. ❌ MongoDB connection issues on serverless (no connection pooling)

## Solution Implemented

### 1. **Created Serverless Handler** (`/api/handler.js`)
- ✅ Removed `app.listen()` call
- ✅ Added `connectDB()` function with timeout handling
- ✅ Checks for existing connection (connection pooling)
- ✅ Proper error handling for serverless environment
- ✅ Exports Express app as module

### 2. **API Router** (`/api/index.js`)
- ✅ Exports the handler for Vercel's function detection

### 3. **Vercel Configuration** (`vercel.json`)
- ✅ Rewrites `/api/*` routes to the handler
- ✅ Serves static files from `public/` folder
- ✅ Environment variable configuration

### 4. **Static Files Organization**
- ✅ Moved HTML, CSS, JS to `public/` folder
- ✅ Script already configured to use `/api` for production

### 5. **Local Development Server** (updated `server.js`)
- ✅ Kept for local development with `npm start`
- ✅ Serves static files from `public/` folder
- ✅ Maintains MongoDB connection

## Directory Structure

```
project-1/
├── api/
│   ├── handler.js       # Vercel serverless handler
│   └── index.js         # Router for handler
├── public/
│   ├── index.html       # Frontend
│   ├── style.css        # Styling
│   └── script.js        # Frontend logic
├── server.js            # Local development server
├── vercel.json          # Vercel configuration
├── .env                 # Local env vars
├── .env.vercel         # Production env vars (for reference)
└── package.json
```

## Environment Variables Setup (IMPORTANT)

### For Local Development
In `.env` file:
```
MONGO_URI=mongodb://127.0.0.1:27017/aqiDB
PORT=3000
```

### For Vercel Production
In Vercel Dashboard > Project Settings > Environment Variables:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/aqiDB?retryWrites=true
```

**Note**: Use `MONGODB_URI` (not `MONGO_URI`) for Vercel - the handler checks both.

## Testing

### Local Testing
```bash
npm start
# Opens http://localhost:3000
```

### Vercel Testing
```bash
npm run dev        # Uses Vercel CLI
# or
vercel dev        # If Vercel CLI installed globally
```

## Common Issues & Solutions

### Issue: "MongoDB Connection Failed"
**Solution**: 
1. Set `MONGODB_URI` in Vercel Environment Variables
2. Ensure IP whitelist includes Vercel IPs (0.0.0.0/0) in MongoDB Atlas
3. Use `mongodb+srv://` connection string

### Issue: "Cannot find module"
**Solution**: Run `npm install` in project root

### Issue: Static files not loading
**Solution**: 
1. Verify files in `/public` folder
2. Check `vercel.json` has `"public": "public"`

### Issue: CORS errors
**Solution**: CORS is already enabled in handler.js for all origins

## Next Steps

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Fix Vercel serverless deployment"
   git push
   ```

2. **Set Environment Variables** in Vercel:
   - Go to Project Settings > Environment Variables
   - Add `MONGODB_URI` with your MongoDB Atlas connection string
   - Save and redeploy

3. **Redeploy**:
   - Go to Vercel Dashboard
   - Click "Redeploy" or wait for git push to trigger auto-deploy
   - Check deployment logs for any errors

4. **Monitor Logs**:
   - Vercel Dashboard > Deployments > [Your Deployment] > Logs
   - Look for `✅ MongoDB Connected` confirmation

## Testing API Endpoints

After deployment, test these endpoints:

```bash
# Health check
curl https://your-vercel-url.vercel.app/api/health

# Save AQI data
curl -X POST https://your-vercel-url.vercel.app/api/save \
  -H "Content-Type: application/json" \
  -d '{"city":"Delhi","aqi":150,"pm25":75,"pm10":120,"o3":50}'

# Get history
curl https://your-vercel-url.vercel.app/api/history?city=Delhi
```

## Key Changes Made

| File | Change | Reason |
|------|--------|--------|
| `/api/handler.js` | New file | Vercel serverless handler |
| `/api/index.js` | New file | Route handler |
| `/public/*.js|html|css` | New folder | Static file serving |
| `vercel.json` | New file | Deployment configuration |
| `server.js` | Modified | Added static file serving |
| `.env.vercel` | New file | Reference for env vars |

## Success Indicators

✅ Vercel build succeeds  
✅ `api/handler` function detection in build logs  
✅ API endpoints respond (check `/api/health`)  
✅ Frontend loads correctly  
✅ "MongoDB Connected" in function logs  
✅ Data can be saved and retrieved  

---

**Need Help?**
1. Check Vercel Logs: Dashboard > Deployments > [Your Build] > Logs
2. Verify Environment Variables are set in Vercel
3. Test MongoDB connection string with MongoDB Compass
4. Ensure all files are in Git repository
