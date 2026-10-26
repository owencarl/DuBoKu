# StreamPulse - Mobile-First HLS Video Streaming PWA

StreamPulse is a private, ad-free, mobile-first Progressive Web App (PWA) designed for Android/Pixel devices to browse, search, and stream custom HLS (`.m3u8`) playlists with a touch-optimized interface.

---

## 🚀 Key Features

- **Mobile-First Touch Controls**:
  - Double-tap left/right (±10s) with animated visual feedback.
  - Native Android Picture-in-Picture (PiP) support.
  - Full HTML5 MediaSession API integration for Android lock screen & notification shade playback controls.
  - Playback speed controls (0.75x - 2.0x).
  - Quick episode drawer within the player.
  - Auto-advance to the next episode upon completion.
- **Resilient HLS Streaming & Reverse CORS Proxy (`/api/proxy`)**:
  - Dynamically fetches M3U8 playlists and media segments.
  - Automatically parses and rewrites chunk and sub-manifest URIs in M3U8 playlists so all chunk requests route securely through the proxy.
  - Injects `Access-Control-Allow-Origin: *` to prevent CORS issues.
- **Provider Architecture**:
  - Modular Adapter Pattern (`/lib/providers/baseProvider.ts`) allows plugging in any backend or scraper data source cleanly.
  - Built-in `MockMediaProvider` with sample Chinese Dramas, Korean Dramas, Movies, and Anime using public test HLS streams.
- **Local Persistence**:
  - Tracks watch history and exact resume timestamps in `localStorage`.
  - Favorites and bookmarks saved locally with zero external database dependencies.
- **PWA Ready**:
  - `manifest.json` configured for `standalone` display with `#0a0a0a` OLED dark background.
  - Safe-area inset protection for notches and Android gesture navigation bars.

---

## 🛠️ Getting Started

### 1. Local Development
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your mobile browser or Android Chrome.

### 2. Production Build
```bash
npm run build
npm start
```

### 3. Vercel Cloud Deployment (Free Tier)
1. Push this repository to GitHub or GitLab.
2. Import the project in your [Vercel Dashboard](https://vercel.com).
3. In **Settings -> Environment Variables**, add:
   - `FAMILY_PIN`: Your custom 4-digit family access code (e.g. `1234`).
4. Click **Deploy**. Vercel will build and serve the app with Edge routing and global CDN caching.

### 4. Docker Deployment
```bash
docker compose up -d --build
```
The app will be available on port `3000`.

---

## 🧩 Adding a Custom Provider

Implement the `BaseMediaProvider` interface located in `/lib/providers/baseProvider.ts`:

```typescript
export interface BaseMediaProvider {
  search(query: string): Promise<MediaItem[]>;
  getFeatured(): Promise<MediaCategory[]>;
  getDetails(id: string): Promise<MediaDetail>;
  resolveStreamUrl(episodeId: string): Promise<StreamResolution>;
}
```

Then plug your provider into `/lib/providers/index.ts` or export it to the API route handlers under `/app/api/media/*`.
