# GRIND — AI Gym Trainer
100% free stack: React + Vercel + Google Gemini + Google Sheets + Google Calendar

---

## What's in this project

```
grind-app/
├── api/
│   ├── chat.js        ← Gemini AI proxy (keeps API key server-side)
│   ├── sheets.js      ← Google Sheets create/append/sync
│   └── calendar.js    ← Google Calendar event creation
├── src/
│   └── App.jsx        ← Full React app
├── vercel.json        ← Routing config
├── package.json
└── README.md
```

---

## One-time setup (~15 minutes)

### 1. Google Cloud project (free)

1. Go to https://console.cloud.google.com
2. Create a new project (e.g. "grind-trainer")
3. Enable these APIs (search for each):
   - **Google Sheets API**
   - **Google Calendar API**
   - **Google People API** (for user profile)
4. Go to **APIs & Services → Credentials**
5. Click **Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorised JavaScript origins: `https://your-app.vercel.app` (add localhost:5173 for dev)
   - Authorised redirect URIs: `https://your-app.vercel.app/auth/callback`
   - Copy the **Client ID** (this is public, goes in your frontend `.env`)
6. Click **Create Credentials → API Key**
   - This is your **Gemini API key** — keep this SECRET (goes in Vercel env vars)
   - Restrict it to "Generative Language API" only

### 2. Deploy to Vercel (free)

```bash
# Install Vercel CLI
npm i -g vercel

# From project root:
vercel

# Follow the prompts, then add environment variables:
vercel env add GEMINI_API_KEY
# Paste your Gemini API key when prompted
```

Or use the Vercel dashboard:
1. Push this folder to GitHub
2. Go to https://vercel.com → Import project → select your repo
3. Add environment variable: `GEMINI_API_KEY` = your key

### 3. Add your Google Client ID to the frontend

Create a `.env` file in the project root:
```
VITE_GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
```

### 4. Run locally for testing

```bash
npm install
npm run dev
# Visit http://localhost:5173
```

For local API testing with real Google/Gemini:
```bash
npm i -g vercel
vercel dev
# Runs both frontend + serverless functions locally
```

---

## Security model

| What | Where | Who can see it |
|------|-------|---------------|
| Gemini API key | Vercel env var | Nobody (server only) |
| Google Client ID | Frontend `.env` | Public (this is fine — it's just an identifier) |
| User's Google OAuth token | User's browser only | User only |
| Workout data | User's localStorage + their own Google Sheet | User only |

The Gemini key never touches the browser. The Google OAuth token stays in the user's browser and is sent only to your own `/api/sheets` and `/api/calendar` endpoints (which forward it to Google on the user's behalf).

---

## Costs

| Service | Cost |
|---------|------|
| Vercel hosting | Free (Hobby plan) |
| Vercel serverless functions | Free (100GB-hours/month) |
| Google Sheets API | Free |
| Google Calendar API | Free |
| Google OAuth | Free |
| Gemini 1.5 Flash | Free (1,500 requests/day) |

**Total: €0/month** for personal use.

---

## Adding more users

Each user signs in with their own Google account. The app creates a separate Google Sheet in *their* Google Drive (not yours). You never store any user data — it all goes directly into the user's own Google account.
