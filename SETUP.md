# SpeedTest App — Setup & Development Guide

## Quick Start (Local Development)

```bash
# 1. Install dependencies
npm install

# 2. Generate speed test binary files
dd if=/dev/urandom of=public/test-files/5mb.bin bs=1048576 count=5
dd if=/dev/urandom of=public/test-files/25mb.bin bs=1048576 count=25

# 3. Copy env template and fill in your keys
cp .env.local.example .env.local
# Edit .env.local with your Supabase and Mapbox credentials

# 4. Run development server
npm run dev

# 5. Open http://localhost:3000
```

## Required Accounts & Keys

### Supabase (Database)
1. Go to supabase.com → Your project → Settings → API
2. Copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
3. Copy **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Go to SQL Editor → paste contents of `supabase-schema.sql` → Run

### Mapbox (Maps)
1. Go to mapbox.com → Sign up → Account → Tokens
2. Copy **Default public token** → `NEXT_PUBLIC_MAPBOX_TOKEN`

### Google Cloud (Places API — Week 2)
1. console.cloud.google.com → New project → Enable Places API
2. Create API key → restrict to Places API

## Cloudways Deployment

### One-time server setup (SSH):
```bash
# Set up npm path
cd ~ && echo "export PATH='$PATH:/home/master/bin/npm'" >> .bash_aliases
cd ~ && echo "export NODE_PATH='$NODE_PATH:/home/master/bin/npm/lib/node_modules'" >> .bash_aliases
npm config set prefix "/home/master/bin/npm/lib/node_modules"
source ~/.bash_aliases

# Install PM2
npm install pm2@latest -g
```

### Deploy:
```bash
cd ~/applications/<app_name>/public_html

# First time: clone repo
git clone <your-repo-url> .
npm install
npm run build

# Generate test files on server
dd if=/dev/urandom of=public/test-files/5mb.bin bs=1048576 count=5
dd if=/dev/urandom of=public/test-files/25mb.bin bs=1048576 count=25

# Start with PM2
pm2 start ecosystem.config.js
pm2 save

# Subsequent deploys:
git pull
npm install
npm run build
pm2 restart speedtest
```

### Important: Contact Cloudways support to enable `mod_proxy` on your server.
The .htaccess file in public_html proxies all traffic to the Node.js process on port 3000.

## Project Structure

```
├── src/
│   ├── app/
│   │   ├── page.tsx              ← Main page (test + map tabs)
│   │   ├── layout.tsx            ← Root layout with PWA meta
│   │   ├── globals.css           ← Tailwind + Mapbox popup styles
│   │   ├── api/
│   │   │   ├── speedtest/
│   │   │   │   ├── ping/route.ts    ← Latency measurement endpoint
│   │   │   │   ├── upload/route.ts  ← Upload speed measurement
│   │   │   │   └── results/route.ts ← Save test results to Supabase
│   │   │   └── locations/route.ts   ← Query nearby speed test locations
│   │   └── map/                     ← (future) dedicated map page
│   ├── components/
│   │   ├── SpeedTest.tsx         ← Main speed test orchestrator
│   │   ├── SpeedGauge.tsx        ← Animated gauge display
│   │   └── SpeedMap.tsx          ← Mapbox heat map component
│   ├── lib/
│   │   ├── speedtest.ts          ← Speed test measurement engine
│   │   ├── geo.ts                ← GPS, geofencing, network detection
│   │   ├── supabase.ts           ← Supabase client (lazy-init)
│   │   └── storage.ts            ← Local storage for map view tracking
│   └── types/
│       └── index.ts              ← TypeScript interfaces
├── public/
│   ├── manifest.json             ← PWA manifest
│   ├── icons/                    ← App icons
│   └── test-files/               ← Binary blobs for speed testing
├── supabase-schema.sql           ← Database schema (run in Supabase SQL Editor)
├── ecosystem.config.js           ← PM2 configuration for Cloudways
├── .htaccess                     ← Apache reverse proxy for Cloudways
└── .env.local                    ← Environment variables (not committed)
```
