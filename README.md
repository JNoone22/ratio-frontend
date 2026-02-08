# Ratio Frontend

Terminal-inspired React frontend for asset strength rankings.

## Features

- 🏆 Big Board with tournament rankings
- 🔍 Real-time search
- 📊 Asset detail modal
- 📱 Mobile responsive
- ⚡ PWA-ready
- 🎨 Bold terminal aesthetic

## Tech Stack

- React 18
- Vite
- CSS (no frameworks - pure custom design)

## Local Development

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Deploy to Vercel

### Method 1: GitHub (Recommended)

1. Push this code to GitHub
2. Go to vercel.com
3. Click "New Project"
4. Import your GitHub repo
5. Vercel auto-detects Vite
6. Click "Deploy"

Done! Live in 30 seconds.

### Method 2: Vercel CLI

```bash
npm install -g vercel
vercel
```

## Environment

The frontend connects to:
```
API_BASE = 'https://web-production-d425.up.railway.app/api'
```

## PWA Setup (Coming Next)

After deploy, we'll add:
- manifest.json
- service-worker.js
- Offline support
- Install prompts

## Project Structure

```
ratio-frontend/
├── src/
│   ├── App.jsx       # Main component
│   ├── App.css       # Terminal styling
│   ├── main.jsx      # React entry
│   └── index.css     # Global styles
├── index.html
├── package.json
├── vite.config.js
└── vercel.json       # Vercel config
```

## Design Philosophy

**Terminal-Inspired Financial UI**
- Monospace fonts (JetBrains Mono)
- Dark theme with green/red accents
- High information density
- Fast, functional, focused
- No unnecessary animations
- Professional trader aesthetic

## Next Steps

1. Deploy to Vercel
2. Add PWA manifest
3. Set up service worker
4. Add install prompts
5. Custom domain
6. Analytics
