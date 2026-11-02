# 🌐 Sahyadri Dairy - Frontend (Vercel Ready)

Mobile-first Glassmorphic Web App for Sahyadri Cooperative Dairy Collection & Farmer Muster.

## 📁 Folder Contents
- `index.html` — Mobile & desktop responsive single-page application (SPA).
- `app.css` — High-performance glassmorphism theme with CSS variables.
- `app.js` — Client-side interaction logic, 3-role access switcher, dynamic rate preview, and API integration.
- `logo.png` — High-res official brand emblem.
- `vercel.json` — Vercel deployment configuration with `/api/*` rewrite proxy to Render backend.
- `package.json` — Frontend package metadata and local static preview script.

---

## 🚀 Deploying to Vercel

1. Log in to your [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** → **Project**.
3. Import your GitHub repository.
4. In the **Project Configuration** screen:
   - **Framework Preset**: `Other`
   - **Root Directory**: Select **`frontend`**
   - **Build & Output Settings**: Default (static site)
5. **Configure Backend URL**:
   - Open `vercel.json` and ensure the destination points to your Render backend:
     ```json
     {
       "rewrites": [
         {
           "source": "/api/:path*",
           "destination": "https://sahyadri-dairy-backend.onrender.com/api/:path*"
         }
       ]
     }
     ```
   - Alternatively, you can define `window.SAHYADRI_BACKEND_URL = 'https://sahyadri-dairy-backend.onrender.com'` or save it in browser `localStorage.setItem('sahyadri_backend_url', 'https://your-backend.onrender.com')`.
6. Click **Deploy**.

---

## 💻 Running Frontend Locally

```bash
# From within the frontend directory:
npx serve .

# Or from project root:
npm run frontend
```
Frontend runs at `http://localhost:3000` (or `http://localhost:5000`) and automatically connects to `http://localhost:4000` for backend API calls.

