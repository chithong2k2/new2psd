# News2PSD

**Turn news articles into ready-to-publish designs.**

Automatically replaces the main image and caption inside a Photoshop PSD template using content extracted from any news article URL.

---

## Quick Start

### Prerequisites
- [Node.js](https://nodejs.org) v18+ (already installed)

### 1. Install Dependencies

```bash
# Backend
cd server
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Run

**Option A — Double-click `start.bat`** (easiest)

**Option B — Manual (two terminals):**

```bash
# Terminal 1 - Backend (port 3001)
cd server
node src/index.js

# Terminal 2 - Frontend (port 5173)
cd frontend
npm run dev
```

Then open **http://localhost:5173**

---

## How to Use

1. **Upload PSD** — Drag & drop your Photoshop template
2. **Paste URL** — Enter any news article URL
3. **Choose Image** — Pick from extracted article images
4. **Edit Caption** — Tweak the caption text
5. **Preview** — See the live PNG render
6. **Download** — Get the PNG and modified PSD

---

## PSD Template Requirements

Your PSD must have exactly these two layer names:

| Layer Name | Purpose |
|---|---|
| `[NEWS_IMAGE]` | The image area to replace |
| `[NEWS_CAPTION]` | The text caption layer |

**In Photoshop:** Double-click a layer name in the Layers panel → rename it.

All other layers (background, logo, borders, decorations) are preserved untouched.

---

## Project Structure

```
ProjectAI/
├── server/          Node.js + Express backend
│   ├── src/
│   │   ├── index.js            Express app
│   │   ├── store.js            In-memory project store
│   │   ├── articleExtractor.js Cheerio scraping
│   │   ├── psdProcessor.js     ag-psd + canvas PSD engine
│   │   └── routes/
│   │       └── projects.js     All REST API endpoints
│   └── package.json
│
├── frontend/        React + Vite + TypeScript + Tailwind
│   ├── src/
│   │   ├── api/        API client
│   │   ├── components/ UI components
│   │   ├── pages/      CreatePage (main app)
│   │   └── types/      TypeScript interfaces
│   └── package.json
│
├── data/projects/   Auto-created: uploaded PSDs & generated files
└── start.bat        One-click startup
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/projects` | Create new project |
| POST | `/api/projects/:id/upload-psd` | Upload PSD template |
| POST | `/api/projects/:id/analyze-article` | Scrape article URL |
| GET | `/api/projects/:id/article` | Get cached article data |
| PUT | `/api/projects/:id/content` | Set image + caption |
| POST | `/api/projects/:id/preview` | Generate PNG preview |
| GET | `/api/projects/:id/export/png` | Download final PNG |
| GET | `/api/projects/:id/export/psd` | Download modified PSD |
| GET | `/api/projects/:id/proxy-image` | Proxy external images |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| Backend | Node.js, Express |
| PSD Processing | ag-psd, @napi-rs/canvas, sharp |
| Article Scraping | axios, cheerio |

All free & open source. No API keys required.
