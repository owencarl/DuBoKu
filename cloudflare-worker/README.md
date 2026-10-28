# High-Bandwidth Cloudflare Worker Proxy (100% Free, Unlimited Bandwidth)

## Why is this needed?
Vercel's free tier has a **10 GB monthly limit** on Fast Origin Transfer (data transfer from serverless/edge functions). A typical 45-minute video stream is 500 MB – 1.5 GB. Watching just 10 episodes transfers ~8–10 GB through Vercel's proxy.

Cloudflare Workers provides:
- **100,000 requests per day for FREE**
- **UNLIMITED BANDWIDTH / DATA TRANSFER (Zero egress charges)**

By running this lightweight proxy on Cloudflare, **100% of the heavy video streaming traffic is offloaded to Cloudflare**, reducing your Vercel bandwidth consumption to almost 0 MB.

---

## 2-Minute Setup Guide

### Step 1: Create a Free Cloudflare Account
If you don't already have one, create a free account at [https://dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up).

### Step 2: Create a Cloudflare Worker
1. In your Cloudflare Dashboard, click **Workers & Pages** in the left sidebar.
2. Click **Create Application** (or **Create Worker**).
3. Name your worker (e.g. `streampulse-proxy` or `duboku-proxy`).
4. Click **Deploy**.

### Step 3: Paste the Proxy Code
1. On the worker page, click **Edit Code** (or Quick Edit).
2. Replace all existing code in `worker.js` with the contents of [`cloudflare-worker/worker.js`](./worker.js).
3. Click **Deploy** (or **Save and Deploy**).
4. Copy your Worker URL at the top (e.g., `https://streampulse-proxy.yourname.workers.dev`).

### Step 4: Add Environment Variable in Vercel
1. Go to your project on [Vercel Dashboard](https://vercel.com/dashboard).
2. Go to **Settings** -> **Environment Variables**.
3. Add a new variable:
   - **Key**: `STREAM_PROXY_URL`
   - **Value**: `https://streampulse-proxy.yourname.workers.dev` (your Worker URL from Step 3)
4. Add another variable:
   - **Key**: `NEXT_PUBLIC_STREAM_PROXY_URL`
   - **Value**: `https://streampulse-proxy.yourname.workers.dev`
5. Go to **Deployments**, click the `...` menu on your latest deployment, and click **Redeploy**.

---

### That's it!
All video streaming traffic will now route directly through your Cloudflare Worker. Your Vercel Fast Origin Transfer usage will drop to virtually **0 MB/month**, and you will never receive a Vercel 75% bandwidth warning again.
