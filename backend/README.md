# ⚙️ Sahyadri Dairy - Backend (Render & MySQL Ready)

Node.js Express REST API backend connected to MySQL 8.0, featuring comprehensive ACID transactions, effective-dated rate calculations, audit triggers, and payment settlements.

## 📁 Folder Contents
- `server.js` — Express REST API with 10+ operational endpoints, CORS, static fallback, and Render health checks.
- `db.js` — `mysql2/promise` connection pool with automatic keepalive and reconnection handling.
- `package.json` — Backend dependencies (`express`, `mysql2`, `cors`, `dotenv`) and start scripts.
- `render.yaml` — Render Blueprint configuration for zero-config one-click deployment.
- `.env.example` — Template for database credentials and server port.
- `sql/` — Complete MySQL 8.0 database schema, triggers, seed data, and RBAC scripts:
  - `01_schema_ddl.sql` — 13 tables with constraints, indexes, and primary/foreign keys.
  - `02_views_triggers_stored_procs.sql` — Audit trail triggers, reporting views, and batch settlement procedure.
  - `03_seed_data.sql` — Seed data for 4 collection centres, 20 farmers, and rate matrices.
  - `04_relational_algebra_calculus_queries.sql` — Relational algebra & calculus benchmark queries.
  - `06_transactions_concurrency_recovery.sql` — ACID demonstrations, savepoints, and isolation level tests.
  - `07_rbac_security.sql` — Role-based access control setup.
- `benchmarks/` — High-volume synthetic data generator (50,000+ records) and `EXPLAIN ANALYZE` evaluation runners.
- `docs/` — Exhaustive technical report and academic documentation (`PROJECT_REPORT.md`).

---

## 🚀 Deploying to Render (Web Service)

1. Push your repository to **GitHub**.
2. Log in to [Render Dashboard](https://dashboard.render.com).
3. Click **New +** → **Web Service**.
4. Select your repository.
5. Set deployment configuration:
   - **Name**: `sahyadri-dairy-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: Free
6. Set **Environment Variables**:
   | Variable | Value | Description |
   | :--- | :--- | :--- |
   | `PORT` | `10000` | Port (Render assigns automatically) |
   | `DB_HOST` | `your-db-host.aivencloud.com` | Cloud MySQL host |
   | `DB_PORT` | `3306` | MySQL port |
   | `DB_USER` | `avnadmin` | MySQL user |
   | `DB_PASSWORD` | `your_db_password` | MySQL password |
   | `DB_NAME` | `dairy_db` | Database name |
   *(Alternatively, supply a single `DATABASE_URL=mysql://user:pass@host:port/dairy_db`)*
7. Click **Create Web Service**.
8. Verify health check at `https://<your-service>.onrender.com/api/health`.

---

## 💻 Running Backend Locally

```bash
# 1. Install dependencies
npm install

# 2. Configure .env
cp .env.example .env
# Edit .env with your MySQL root password

# 3. Start server
npm start
# API is live at http://localhost:4000
```

