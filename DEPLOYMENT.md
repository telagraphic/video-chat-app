# Deployment Guide

## Why Not Netlify?

This application **cannot run on Netlify** because:
- ❌ Netlify doesn't support WebSockets (required for Socket.io)
- ❌ Netlify doesn't support Bun runtime
- ❌ Netlify Functions are serverless (short-lived), not persistent servers
- ❌ This app needs a long-running server process

## Recommended Deployment Options

### 1. Railway (Recommended) ⭐

**Best for:** Easy deployment with Bun support

**Steps:**
1. Sign up at [railway.app](https://railway.app)
2. Create a new project
3. Connect your GitHub repository
4. Railway will auto-detect and deploy
5. Set environment variable `PORT` (Railway provides this automatically)

**Pros:**
- ✅ Supports Bun runtime
- ✅ Supports WebSockets
- ✅ Free tier available ($5 credit/month)
- ✅ Automatic HTTPS
- ✅ Easy deployment

**Configuration:**
- Uses `railway.json` and `nixpacks.toml` (already included)

---

### 2. Render

**Best for:** Simple deployment with good free tier

**Steps:**
1. Sign up at [render.com](https://render.com)
2. Create a new "Web Service"
3. Connect your GitHub repository
4. Build command: `bun install`
5. Start command: `bun server/server.ts`
6. Set environment: `Bun`

**Pros:**
- ✅ Supports Bun runtime
- ✅ Supports WebSockets
- ✅ Free tier available
- ✅ Automatic HTTPS

**Configuration needed:**
- Build Command: `bun install`
- Start Command: `bun server/server.ts`
- Environment: `Bun`

---

### 3. Fly.io

**Best for:** Global edge deployment

**Steps:**
1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. Sign up: `fly auth signup`
3. Launch: `fly launch`
4. Deploy: `fly deploy`

**Pros:**
- ✅ Supports Bun runtime
- ✅ Supports WebSockets
- ✅ Global edge deployment
- ✅ Free tier available

**Configuration needed:**
- Create `fly.toml` (see below)

---

### 4. Vercel (with modifications)

**Note:** Vercel doesn't support WebSockets natively, but you can:
- Deploy frontend to Vercel
- Use a separate WebSocket service (like Ably, Pusher, or Railway for Socket.io)

**Not recommended** for this app as-is.

---

### 5. DigitalOcean App Platform

**Steps:**
1. Sign up at [digitalocean.com](https://digitalocean.com)
2. Create a new App
3. Connect GitHub repository
4. Configure build/start commands

**Pros:**
- ✅ Supports Bun runtime
- ✅ Supports WebSockets
- ✅ Good performance

---

## Environment Variables

Set these in your deployment platform:

```env
PORT=3000  # Usually auto-provided by platform
NODE_ENV=production
```

## Important Notes

1. **HTTPS Required:** WebRTC requires HTTPS in production (not just localhost)
2. **CORS:** Update CORS settings in `server.ts` if needed for your domain
3. **Static Files:** The `public/` directory is served by the server, so it works with all platforms above

## Quick Start: Railway

1. Push your code to GitHub
2. Go to [railway.app](https://railway.app)
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Railway will auto-detect Bun and deploy
6. Your app will be live at `https://your-app.railway.app`

That's it! Railway handles everything automatically.

