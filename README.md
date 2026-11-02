# Centralized Dairy Collection & Farmer Payment Management System
> Built with MySQL 8.0, Node.js Express, and a Modern Glassmorphic Web Dashboard

## Overview
A comprehensive, database-driven enterprise solution designed for dairy organizations managing milk collection across multiple centres, real-time quality testing (Fat % & SNF %), effective-dated pricing policies, automated loan & input deduction recovery, trigger-based audit trails, and atomic batch payment settlements.

---

## Key Modules & Features
1. **📊 Executive Dashboard:** Live procurement totals, morning vs. evening session comparison, regional BMC capacity gauges.
2. **🥛 Milk Intake Terminal:** Instant real-time rate calculator (Fat × SNF interpolation & slabs), duplicate collection prevention, printable receipt slip generator.
3. **🧑‍🌾 Farmer Ledger & Passbook:** Directory of registered farmers, bank account details, interactive passbooks with daily lot delivery records.
4. **📈 Rate Master & 2D Slabs:** Effective-dated Cow and Buffalo rate policies preserving historical transactions.
5. **💳 Settlement & Billing:** Automated periodic batch settlement procedure (`sp_generate_farmer_payments`) recovering cattle feed and cash advances up to an authorized 50% limit.
6. **📜 Immutable Audit Trail:** Database triggers capturing prior and updated values, user credentials, timestamps, and mandatory business reasons.
7. **🔬 Relational Query Lab:** Interactive runner for 10 formal Relational Algebra, Calculus (TRC/DRC), and complex SQL queries.
8. **⚡ Empirical Indexing Benchmarks:** `EXPLAIN ANALYZE` benchmarks on 20,300+ records achieving up to **+97.5% speedup** and **5,075x row reduction**.
9. **🔄 ACID & Concurrency Visualizer:** Live interactive test bench demonstrating transaction rollback, savepoint recovery, and lost update prevention via `SELECT ... FOR UPDATE`.
10. **🎭 Role-Based Access Control (RBAC):** Dynamic role switcher simulating Dairy Manager, Collection Operator, Quality Tester, Accounts Staff, and Farmer Self-Service.

---

## 📁 Clean Decoupled Directory Structure

The project is arranged into two clean folders, ready for deployment to **Vercel** and **Render**:

```
c:/Users/gaikw/Downloads/MYSQL/
├── frontend/                                    # 🌐 VERCEL PRODUCTION DEPLOYMENT
│   ├── index.html                               # Responsive Glassmorphic SPA
│   ├── app.css                                  # High-performance CSS design system
│   ├── app.js                                   # RBAC logic, dynamic rates, and API handler
│   ├── logo.png                                 # High-res emblem
│   ├── package.json                             # Frontend package configuration
│   ├── README.md                                # Frontend & Vercel deployment guide
│   └── vercel.json                              # Vercel proxy rewrites to Render backend
│
├── backend/                                     # ⚙️ RENDER WEB SERVICE DEPLOYMENT
│   ├── server.js                                # Express REST API backend
│   ├── db.js                                    # mysql2/promise connection pool
│   ├── package.json                             # Backend dependencies & scripts
│   ├── render.yaml                              # Render Blueprint configuration
│   ├── .env.example                             # Environment variable template
│   ├── README.md                                # Backend & Render deployment guide
│   ├── sql/                                     # MySQL 8.0 Database Scripts
│   │   ├── 01_schema_ddl.sql                    # 13 tables, PKs, FKs, CHECK, UNIQUE, indexes
│   │   ├── 02_views_triggers_stored_procs.sql   # Audit triggers, reporting views, stored procs
│   │   ├── 03_seed_data.sql                     # Realistic seed data (4 centres & 20 farmers)
│   │   ├── 04_relational_algebra_calculus_queries.sql # Formal queries (Algebra, Calculus, SQL)
│   │   ├── 06_transactions_concurrency_recovery.sql # ACID, savepoints, concurrency tests
│   │   └── 07_rbac_security.sql                 # MySQL 8 roles, permissions, security views
│   ├── benchmarks/                              # Database Indexing Benchmarks
│   │   ├── generate_large_dataset.js            # High-volume synthetic generator (50,000+ rows)
│   │   ├── run_performance_evaluation.js        # EXPLAIN ANALYZE comparison runner
│   │   └── BENCHMARK_RESULTS.md                 # Empirical benchmark report
│   └── docs/                                    # Academic & Technical Documentation
│       └── PROJECT_REPORT.md                    # Exhaustive academic report
│
├── .gitignore                                   # Standard git ignore rules (node_modules, .env)
├── DEPLOYMENT.md                                # Step-by-step Vercel & Render hosting guide
├── package.json                                 # Root workspace scripts (npm start, npm run frontend)
├── render.yaml                                  # Root Render Blueprint specification
└── vercel.json                                  # Root Vercel configuration fallback
```

---

## Getting Started

### 1. Database Setup in MySQL 8.0
Execute the scripts in order:
```powershell
cmd.exe /c "mysql -u root -proot123 dairy_db -e ""source backend/sql/01_schema_ddl.sql;"""
cmd.exe /c "mysql -u root -proot123 dairy_db -e ""source backend/sql/02_views_triggers_stored_procs.sql;"""
cmd.exe /c "mysql -u root -proot123 dairy_db -e ""source backend/sql/03_seed_data.sql;"""
```

### 2. High-Volume Index Benchmarks (Optional)
```powershell
cd backend
node benchmarks/generate_large_dataset.js 50000
node benchmarks/run_performance_evaluation.js
```

### 3. Launch Locally
```powershell
npm start
```
Open **[http://localhost:4000](http://localhost:4000)** in your browser!

For cloud deployment on **Vercel** and **Render**, refer to [DEPLOYMENT.md](file:///c:/Users/gaikw/Downloads/MYSQL/DEPLOYMENT.md).
