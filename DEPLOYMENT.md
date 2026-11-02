# 🚀 Sahyadri Dairy - Deployment Guide (Vercel & Render)

This application is strictly structured into two clean, self-contained directories:
- **`frontend/`** → Ready for **Vercel** (Static mobile-first web app with automated API proxy)
- **`backend/`** → Ready for **Render** (Node.js Express REST API connected to MySQL, containing all SQL scripts, benchmarks, and docs)

---

## 1. Deploy Backend on Render (Web Service)

### Method A: Blueprint (Recommended - 1-Click)
1. Push your repository to **GitHub**.
2. Go to [Render Dashboard](https://dashboard.render.com).
3. Click **New +** → **Blueprint**.
4. Select your repository. Render will automatically detect `render.yaml`.
5. Enter your MySQL environment credentials (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`).
6. Click **Apply**.

### Method B: Manual Web Service
1. In Render Dashboard, click **New +** → **Web Service**.
2. Select your GitHub repository.
3. Configure settings:
   - **Name**: `sahyadri-dairy-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: Free
4. Add **Environment Variables** (under *Environment* tab):
   | Variable | Value | Description |
   | :--- | :--- | :--- |
   | `PORT` | `10000` | Render port (or default) |
   | `DB_HOST` | `your-db-host.aivencloud.com` | Cloud MySQL host (Aiven / Railway / RDS) |
   | `DB_PORT` | `3306` | MySQL port |
   | `DB_USER` | `avnadmin` | MySQL user |
   | `DB_PASSWORD` | `your_db_password` | MySQL password |
   | `DB_NAME` | `dairy_db` | Database name |
   *(Alternatively, provide a single `DATABASE_URL=mysql://user:pass@host:port/dairy_db`)*
5. Click **Create Web Service**.
6. Render provides your live backend URL:
   `https://sahyadri-dairy-backend.onrender.com`
   Test it via: `https://sahyadri-dairy-backend.onrender.com/api/health`

---

## 2. Deploy Frontend on Vercel

### Steps:
1. Log in to [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** → **Project**.
3. Import your GitHub repository.
4. In the **Project Configuration** screen:
   - **Project Name**: `sahyadri-dairy`
   - **Framework Preset**: `Other`
   - **Root Directory**: Click *Edit* and select **`frontend`**
   - **Build and Output Settings**: Leave defaults (static site)
5. In `frontend/vercel.json`, ensure the proxy destination matches your live Render backend URL:
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
6. Click **Deploy**.
7. Vercel will instantly generate your live URL:
   `https://sahyadri-dairy.vercel.app`

---

## 3. Database Initialization (MySQL)

All SQL DDL, seed data, and stored procedures are in `backend/sql/`:
```powershell
# From the project root or backend folder:
cmd.exe /c "mysql -u root -proot123 dairy_db -e ""source backend/sql/01_schema_ddl.sql;"""
cmd.exe /c "mysql -u root -proot123 dairy_db -e ""source backend/sql/02_views_triggers_stored_procs.sql;"""
cmd.exe /c "mysql -u root -proot123 dairy_db -e ""source backend/sql/03_seed_data.sql;"""
```

---

## 4. Local Development

To run locally:
```bash
# 1. Install dependencies
npm install

# 2. Start the unified stack (Express serves both backend APIs and frontend UI)
npm start
# App is live at: http://localhost:4000
```
Or run separately:
```bash
# Terminal 1: Backend API
npm run backend       # Runs on http://localhost:4000

# Terminal 2: Frontend UI
npm run frontend      # Runs on http://localhost:3000 (auto-proxies to port 4000)
```
