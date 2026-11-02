// =====================================================================
// DAIRY SYSTEM - EXPRESS REST API BACKEND
// =====================================================================

const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Serve static frontend files if available (supports local testing directly from frontend folder)
const fs = require('fs');
const frontendStatic = path.join(__dirname, '../frontend');
if (fs.existsSync(frontendStatic)) {
    app.use(express.static(frontendStatic));
}

// Health Check for Render / Cloud Hosting
app.get('/api/health', (req, res) => {
    res.json({
        status: 'UP',
        service: 'Sahyadri Dairy Management Backend API',
        timestamp: new Date().toISOString()
    });
});

// Root API Endpoint (when frontend is deployed separately on Vercel)
app.get('/', (req, res) => {
    res.json({
        service: 'Sahyadri Dairy Management Backend API',
        status: 'UP',
        healthCheck: '/api/health',
        documentation: 'Deployed on Render. Frontend hosted on Vercel.'
    });
});

// ---------------------------------------------------------------------
// 1. DASHBOARD SUMMARY STATS
// ---------------------------------------------------------------------
app.get('/api/summary', async (req, res) => {
    try {
        const [todayStats] = await db.query(`
            SELECT
                IFNULL(ROUND(SUM(quantity_litres), 2), 0.00) AS total_litres_today,
                IFNULL(ROUND(SUM(net_payable_amount), 2), 0.00) AS total_payout_today,
                COUNT(collection_id) AS total_collections_today,
                COUNT(DISTINCT farmer_id) AS active_farmers_today,
                IFNULL(ROUND(SUM(quantity_litres * fat_percentage) / NULLIF(SUM(quantity_litres), 0), 2), 0.00) AS avg_fat_today,
                IFNULL(ROUND(SUM(quantity_litres * snf_percentage) / NULLIF(SUM(quantity_litres), 0), 2), 0.00) AS avg_snf_today
            FROM milk_collections
            WHERE collection_date = CURDATE();
        `);

        const [overallStats] = await db.query(`
            SELECT
                (SELECT COUNT(*) FROM farmers WHERE status = 'ACTIVE') AS registered_farmers,
                (SELECT COUNT(*) FROM collection_centres WHERE operating_status = 'ACTIVE') AS active_centres,
                (SELECT COUNT(*) FROM milk_collections) AS total_historical_collections,
                (SELECT IFNULL(ROUND(SUM(quantity_litres), 2), 0.00) FROM milk_collections) AS total_milk_lifetime_litres,
                (SELECT IFNULL(ROUND(SUM(net_payable_amount), 2), 0.00) FROM milk_collections WHERE payment_status = 'PENDING') AS pending_settlement_inr
        `);

        const [sessionBreakdown] = await db.query(`
            SELECT
                session,
                ROUND(SUM(quantity_litres), 2) AS litres,
                ROUND(AVG(fat_percentage), 2) AS avg_fat,
                ROUND(SUM(net_payable_amount), 2) AS payout
            FROM milk_collections
            WHERE collection_date >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
            GROUP BY session;
        `);

        const [centreBreakdown] = await db.query(`
            SELECT
                cc.centre_code,
                cc.centre_name,
                ROUND(SUM(mc.quantity_litres), 2) AS total_litres,
                ROUND(AVG(mc.fat_percentage), 2) AS avg_fat,
                COUNT(DISTINCT mc.farmer_id) AS contributing_farmers
            FROM milk_collections mc
            JOIN collection_centres cc ON mc.centre_id = cc.centre_id
            WHERE mc.collection_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY cc.centre_id, cc.centre_code, cc.centre_name
            ORDER BY total_litres DESC;
        `);

        res.json({
            success: true,
            today: todayStats[0],
            overall: overallStats[0],
            sessionBreakdown,
            centreBreakdown
        });
    } catch (err) {
        console.warn('Database query failed for /api/summary, returning sample fallback:', err.message);
        res.json({
            success: true,
            mode: 'sample_fallback',
            today: {
                total_litres_today: 146.40,
                total_payout_today: 5980.50,
                total_collections_today: 8,
                active_farmers_today: 8,
                avg_fat_today: 4.60,
                avg_snf_today: 8.50
            },
            overall: {
                registered_farmers: 20,
                active_centres: 4,
                total_historical_collections: 148,
                total_milk_lifetime_litres: 2198.00,
                pending_settlement_inr: 74915.00
            },
            sessionBreakdown: [
                { session: 'MORNING', litres: 85.20, avg_fat: 4.5, payout: 3500 },
                { session: 'EVENING', litres: 61.20, avg_fat: 4.7, payout: 2480 }
            ],
            centreBreakdown: [
                { centre_code: 'CC-SN-01', centre_name: 'Sangamner Central BMC Unit', total_litres: 1250.00, avg_fat: 4.4, contributing_farmers: 6 },
                { centre_code: 'CC-CH-02', centre_name: 'Chandanapuri Collection Centre', total_litres: 520.00, avg_fat: 4.8, contributing_farmers: 4 },
                { centre_code: 'CC-GH-03', centre_name: 'Ghulewadi Automated Dairy Point', total_litres: 428.00, avg_fat: 4.5, contributing_farmers: 4 }
            ]
        });
    }
});

// ---------------------------------------------------------------------
// 2. FARMERS API
// ---------------------------------------------------------------------
app.get('/api/farmers', async (req, res) => {
    try {
        const { centre_id, search, status } = req.query;
        let query = `
            SELECT
                f.farmer_id, f.farmer_code, f.first_name, f.last_name,
                CONCAT(f.first_name, ' ', f.last_name) AS full_name,
                f.phone, f.aadhar_number, f.bank_name, f.bank_account_number, f.ifsc_code,
                f.registration_date, f.status,
                v.village_name, v.taluka,
                cc.centre_id, cc.centre_name, cc.centre_code,
                IFNULL(d.outstanding_loan, 0.00) AS outstanding_loan
            FROM farmers f
            JOIN villages v ON f.village_id = v.village_id
            JOIN collection_centres cc ON f.assigned_centre_id = cc.centre_id
            LEFT JOIN (
                SELECT farmer_id, SUM(balance_amount) AS outstanding_loan
                FROM farmer_deductions_master
                WHERE status = 'ACTIVE'
                GROUP BY farmer_id
            ) d ON f.farmer_id = d.farmer_id
            WHERE 1=1
        `;
        const params = [];

        if (centre_id) {
            query += ` AND f.assigned_centre_id = ?`;
            params.push(centre_id);
        }
        if (status) {
            query += ` AND f.status = ?`;
            params.push(status);
        }
        if (search) {
            query += ` AND (f.farmer_code LIKE ? OR f.first_name LIKE ? OR f.last_name LIKE ? OR f.phone LIKE ?)`;
            const term = `%${search}%`;
            params.push(term, term, term, term);
        }

        query += ` ORDER BY f.farmer_id ASC LIMIT 100`;

        const [farmers] = await db.query(query, params);
        res.json({ success: true, farmers });
    } catch (err) {
        console.warn('Database query failed for /api/farmers, returning sample fallback:', err.message);
        let sampleList = [
            { farmer_id: 1, farmer_code: 'FRM-1001', first_name: 'Ramesh', last_name: 'Gaikwad', full_name: 'Ramesh Vitthal Gaikwad', village_name: 'Sangamner Khurd', phone: '+91 94231 55001', bank_name: 'State Bank of India', bank_account_number: '30981245671', ifsc_code: 'SBIN0000473', centre_id: 1, centre_name: 'Sangamner Central BMC Unit', status: 'ACTIVE', outstanding_loan: '2500.00' },
            { farmer_id: 2, farmer_code: 'FRM-1002', first_name: 'Babasaheb', last_name: 'Dighe', full_name: 'Babasaheb Eknath Dighe', village_name: 'Sangamner Khurd', phone: '+91 94231 55002', bank_name: 'Bank of Maharashtra', bank_account_number: '60124578912', ifsc_code: 'MAHB0000128', centre_id: 1, centre_name: 'Sangamner Central BMC Unit', status: 'ACTIVE', outstanding_loan: '1200.00' },
            { farmer_id: 3, farmer_code: 'FRM-1003', first_name: 'Eknath', last_name: 'Kute', full_name: 'Eknath Dashrath Kute', village_name: 'Sangamner Khurd', phone: '+91 94231 55003', bank_name: 'State Bank of India', bank_account_number: '30981245673', ifsc_code: 'SBIN0000473', centre_id: 1, centre_name: 'Sangamner Central BMC Unit', status: 'ACTIVE', outstanding_loan: '0.00' },
            { farmer_id: 4, farmer_code: 'FRM-1004', first_name: 'Dnyaneshwar', last_name: 'Navale', full_name: 'Dnyaneshwar Bhikaji Navale', village_name: 'Chandanapuri', phone: '+91 94231 55004', bank_name: 'Union Bank of India', bank_account_number: '40561238901', ifsc_code: 'UBIN0540561', centre_id: 2, centre_name: 'Chandanapuri Collection Centre', status: 'ACTIVE', outstanding_loan: '2800.00' },
            { farmer_id: 5, farmer_code: 'FRM-1005', first_name: 'Tukaram', last_name: 'Gunjal', full_name: 'Tukaram Sopan Gunjal', village_name: 'Chandanapuri', phone: '+91 94231 55005', bank_name: 'Bank of Maharashtra', bank_account_number: '60124578915', ifsc_code: 'MAHB0000128', centre_id: 2, centre_name: 'Chandanapuri Collection Centre', status: 'ACTIVE', outstanding_loan: '0.00' },
            { farmer_id: 6, farmer_code: 'FRM-1006', first_name: 'Sanjay', last_name: 'Tambe', full_name: 'Sanjay Kashinath Tambe', village_name: 'Chandanapuri', phone: '+91 94231 55006', bank_name: 'State Bank of India', bank_account_number: '30981245676', ifsc_code: 'SBIN0000473', centre_id: 2, centre_name: 'Chandanapuri Collection Centre', status: 'ACTIVE', outstanding_loan: '0.00' },
            { farmer_id: 7, farmer_code: 'FRM-1007', first_name: 'Pandurang', last_name: 'Aher', full_name: 'Pandurang Ganpat Aher', village_name: 'Ghulewadi', phone: '+91 94231 55007', bank_name: 'HDFC Bank', bank_account_number: '50100245890123', ifsc_code: 'HDFC0000240', centre_id: 3, centre_name: 'Ghulewadi Automated Dairy Point', status: 'ACTIVE', outstanding_loan: '4000.00' },
            { farmer_id: 8, farmer_code: 'FRM-1008', first_name: 'Vishnu', last_name: 'Rahane', full_name: 'Vishnu Ramchandra Rahane', village_name: 'Ghulewadi', phone: '+91 94231 55008', bank_name: 'Bank of Baroda', bank_account_number: '1245010003456', ifsc_code: 'BARB0SANGAM', centre_id: 3, centre_name: 'Ghulewadi Automated Dairy Point', status: 'ACTIVE', outstanding_loan: '0.00' },
            { farmer_id: 9, farmer_code: 'FRM-1009', first_name: 'Nivritti', last_name: 'Bhandari', full_name: 'Nivritti Bhaurao Bhandari', village_name: 'Ghulewadi', phone: '+91 94231 55009', bank_name: 'State Bank of India', bank_account_number: '30981245679', ifsc_code: 'SBIN0000473', centre_id: 3, centre_name: 'Ghulewadi Automated Dairy Point', status: 'ACTIVE', outstanding_loan: '0.00' },
            { farmer_id: 10, farmer_code: 'FRM-1010', first_name: 'Sharad', last_name: 'Thorat', full_name: 'Sharad Shankar Thorat', village_name: 'Loni Budruk', phone: '+91 94231 55010', bank_name: 'State Bank of India', bank_account_number: '30981245680', ifsc_code: 'SBIN0001234', centre_id: 4, centre_name: 'Loni Bulk Milk Cooling Centre', status: 'ACTIVE', outstanding_loan: '0.00' },
            { farmer_id: 11, farmer_code: 'FRM-1011', first_name: 'Sunil', last_name: 'Jadhav', full_name: 'Sunil Raosaheb Jadhav', village_name: 'Loni Budruk', phone: '+91 94231 55011', bank_name: 'Bank of Maharashtra', bank_account_number: '60124578921', ifsc_code: 'MAHB0000456', centre_id: 4, centre_name: 'Loni Bulk Milk Cooling Centre', status: 'ACTIVE', outstanding_loan: '1500.00' },
            { farmer_id: 12, farmer_code: 'FRM-1012', first_name: 'Ashok', last_name: 'Kadam', full_name: 'Ashok Laxman Kadam', village_name: 'Loni Budruk', phone: '+91 94231 55012', bank_name: 'Union Bank of India', bank_account_number: '40561238912', ifsc_code: 'UBIN0540561', centre_id: 4, centre_name: 'Loni Bulk Milk Cooling Centre', status: 'ACTIVE', outstanding_loan: '0.00' }
        ];
        if (req.query.search) {
            const s = req.query.search.toLowerCase();
            sampleList = sampleList.filter(f => f.full_name.toLowerCase().includes(s) || f.farmer_code.toLowerCase().includes(s) || f.phone.includes(s));
        }
        res.json({ success: true, mode: 'sample_fallback', farmers: sampleList });
    }
});

// Farmer Profile & Collection Passbook
app.get('/api/farmers/:id/passbook', async (req, res) => {
    try {
        const farmerId = req.params.id;
        const [farmerRows] = await db.query(`
            SELECT f.*, CONCAT(f.first_name, ' ', f.last_name) AS full_name, v.village_name, cc.centre_name
            FROM farmers f
            JOIN villages v ON f.village_id = v.village_id
            JOIN collection_centres cc ON f.assigned_centre_id = cc.centre_id
            WHERE f.farmer_id = ?
        `, [farmerId]);

        if (farmerRows.length === 0) {
            return res.status(404).json({ success: false, error: 'Farmer not found' });
        }

        const [collections] = await db.query(`
            SELECT
                mc.collection_id, mc.collection_date, mc.session, mc.collection_timestamp,
                mt.type_name AS milk_type, mc.quantity_litres, mc.fat_percentage, mc.snf_percentage,
                mc.rate_per_litre, mc.gross_amount, mc.incentive_amount, mc.deduction_amount,
                mc.net_payable_amount, mc.payment_status, cc.centre_name
            FROM milk_collections mc
            JOIN milk_types mt ON mc.milk_type_id = mt.milk_type_id
            JOIN collection_centres cc ON mc.centre_id = cc.centre_id
            WHERE mc.farmer_id = ?
            ORDER BY mc.collection_date DESC, mc.session DESC
            LIMIT 60;
        `, [farmerId]);

        const [deductions] = await db.query(`
            SELECT deduction_id, deduction_type, total_amount, recovered_amount, balance_amount, status, description, created_at
            FROM farmer_deductions_master
            WHERE farmer_id = ?
            ORDER BY created_at DESC;
        `, [farmerId]);

        const [payments] = await db.query(`
            SELECT fp.*, pp.period_code, pp.start_date, pp.end_date
            FROM farmer_payments fp
            JOIN payment_periods pp ON fp.period_id = pp.period_id
            WHERE fp.farmer_id = ?
            ORDER BY fp.created_at DESC;
        `, [farmerId]);

        const [summaryRows] = await db.query(`
            SELECT
                IFNULL(ROUND(SUM(mc.quantity_litres), 2), 0.00) AS total_milk_supplied,
                IFNULL(ROUND(SUM(mc.net_payable_amount), 2), 0.00) AS total_earnings,
                IFNULL(ROUND(SUM(mc.quantity_litres * mc.fat_percentage) / NULLIF(SUM(mc.quantity_litres), 0), 2), 0.00) AS weighted_avg_fat,
                IFNULL(ROUND(SUM(CASE WHEN mc.payment_status = 'PENDING' THEN mc.net_payable_amount ELSE 0 END), 2), 0.00) AS unbilled_milk_amount
            FROM milk_collections mc
            WHERE mc.farmer_id = ?
        `, [farmerId]);

        const [loanRows] = await db.query(`
            SELECT IFNULL(ROUND(SUM(balance_amount), 2), 0.00) AS total_outstanding_loan
            FROM farmer_deductions_master
            WHERE farmer_id = ? AND status = 'ACTIVE'
        `, [farmerId]);

        res.json({
            success: true,
            farmer: farmerRows[0],
            summary: {
                ...summaryRows[0],
                ...loanRows[0]
            },
            collections,
            deductions,
            payments
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Register New Farmer
app.post('/api/farmers', async (req, res) => {
    try {
        const {
            farmer_code, first_name, last_name, village_id, assigned_centre_id,
            phone, aadhar_number, bank_name, bank_account_number, ifsc_code
        } = req.body;

        const regDate = new Date().toISOString().split('T')[0];

        const [result] = await db.query(`
            INSERT INTO farmers (
                farmer_code, first_name, last_name, village_id, assigned_centre_id,
                phone, aadhar_number, bank_name, bank_account_number, ifsc_code,
                registration_date, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
        `, [farmer_code, first_name, last_name, village_id, assigned_centre_id, phone, aadhar_number, bank_name, bank_account_number, ifsc_code, regDate]);

        res.json({ success: true, farmer_id: result.insertId, message: 'Farmer registered successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ---------------------------------------------------------------------
// 3. CENTRES & VILLAGES
// ---------------------------------------------------------------------
app.get('/api/centres', async (req, res) => {
    try {
        const [centres] = await db.query(`
            SELECT cc.*, v.village_name, v.taluka,
                (SELECT COUNT(*) FROM farmers f WHERE f.assigned_centre_id = cc.centre_id) AS registered_farmers
            FROM collection_centres cc
            JOIN villages v ON cc.village_id = v.village_id
            ORDER BY cc.centre_id ASC
        `);
        res.json({ success: true, centres });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/villages', async (req, res) => {
    try {
        const [villages] = await db.query('SELECT * FROM villages ORDER BY village_name ASC');
        res.json({ success: true, villages });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ---------------------------------------------------------------------
// 4. RATE ENGINE & RATE CHARTS
// ---------------------------------------------------------------------
app.get('/api/rates', async (req, res) => {
    try {
        const [charts] = await db.query(`
            SELECT r.*, m.type_name AS milk_type_name
            FROM rate_chart_master r
            JOIN milk_types m ON r.milk_type_id = m.milk_type_id
            ORDER BY r.chart_id DESC
        `);

        const [slabs] = await db.query(`
            SELECT s.*, r.chart_name, m.type_name AS milk_type_name
            FROM rate_slabs s
            JOIN rate_chart_master r ON s.chart_id = r.chart_id
            JOIN milk_types m ON r.milk_type_id = m.milk_type_id
            ORDER BY s.chart_id, s.min_fat ASC
        `);

        res.json({ success: true, charts, slabs });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Instant Rate Calculation Simulator API
app.get('/api/rates/calculate', async (req, res) => {
    try {
        const milk_type_id = parseInt(req.query.milk_type_id || 1, 10);
        const fat = parseFloat(req.query.fat || 3.5);
        const snf = parseFloat(req.query.snf || 8.5);
        const date = req.query.date || new Date().toISOString().split('T')[0];

        const [result] = await db.query(`
            CALL sp_calculate_rate(?, ?, ?, ?, @chart_id, @rate, @incentive);
            SELECT @chart_id AS chart_id, @rate AS rate_per_litre, @incentive AS incentive_per_litre;
        `, [milk_type_id, fat, snf, date]);

        const out = result[1][0];
        res.json({ success: true, ...out });
    } catch (err) {
        console.warn('Database query failed for /api/rates/calculate, calculating mathematically:', err.message);
        const milk_type_id = parseInt(req.query.milk_type_id || 1, 10);
        const fat = parseFloat(req.query.fat || 3.5);
        const snf = parseFloat(req.query.snf || 8.5);
        const rate = milk_type_id === 1 ? (37.5 + (fat - 3.5) * 3.0 + (snf - 8.5) * 2.0) : (56.0 + (fat - 6.5) * 4.5 + (snf - 9.0) * 2.5);
        res.json({
            success: true,
            mode: 'calculated_formula',
            chart_id: milk_type_id === 1 ? 2 : 3,
            rate_per_litre: rate.toFixed(2),
            incentive_per_litre: '0.00'
        });
    }
});

// ---------------------------------------------------------------------
// 5. MILK COLLECTION TRANSACTIONS
// ---------------------------------------------------------------------
app.get('/api/collections', async (req, res) => {
    try {
        const { date, session, centre_id, limit = 50 } = req.query;
        let query = `
            SELECT
                mc.collection_id, mc.collection_date, mc.session, mc.collection_timestamp,
                f.farmer_id, f.farmer_code, CONCAT(f.first_name, ' ', f.last_name) AS farmer_name,
                cc.centre_code, cc.centre_name,
                mt.type_name AS milk_type,
                mc.quantity_litres, mc.fat_percentage, mc.snf_percentage, mc.clr_reading,
                mc.rate_per_litre, mc.gross_amount, mc.incentive_amount, mc.deduction_amount,
                mc.net_payable_amount, mc.payment_status, mc.is_inter_centre_collection
            FROM milk_collections mc
            JOIN farmers f ON mc.farmer_id = f.farmer_id
            JOIN collection_centres cc ON mc.centre_id = cc.centre_id
            JOIN milk_types mt ON mc.milk_type_id = mt.milk_type_id
            WHERE 1=1
        `;
        const params = [];

        if (date) {
            query += ` AND mc.collection_date = ?`;
            params.push(date);
        }
        if (session) {
            query += ` AND mc.session = ?`;
            params.push(session);
        }
        if (centre_id) {
            query += ` AND mc.centre_id = ?`;
            params.push(centre_id);
        }

        query += ` ORDER BY mc.collection_id DESC LIMIT ?`;
        params.push(parseInt(limit, 10));

        const [collections] = await db.query(query, params);
        res.json({ success: true, collections });
    } catch (err) {
        console.warn('Database query failed for /api/collections, returning sample fallback:', err.message);
        const sampleColls = [
            { collection_id: 101, farmer_name: 'Ramesh Vitthal Gaikwad', farmer_code: 'FRM-1001', session: 'MORNING', milk_type: 'COW', quantity_litres: 14.50, fat_percentage: 4.2, snf_percentage: 8.8, rate_per_litre: 41.20, net_payable_amount: 597.40, collection_date: '2026-10-20', payment_status: 'ACCEPTED', centre_name: 'Sangamner Central BMC Unit' },
            { collection_id: 102, farmer_name: 'Babasaheb Eknath Dighe', farmer_code: 'FRM-1002', session: 'MORNING', milk_type: 'BUFFALO', quantity_litres: 18.00, fat_percentage: 6.8, snf_percentage: 9.1, rate_per_litre: 61.50, net_payable_amount: 1107.00, collection_date: '2026-10-20', payment_status: 'ACCEPTED', centre_name: 'Sangamner Central BMC Unit' },
            { collection_id: 103, farmer_name: 'Dnyaneshwar Bhikaji Navale', farmer_code: 'FRM-1004', session: 'MORNING', milk_type: 'COW', quantity_litres: 22.00, fat_percentage: 3.9, snf_percentage: 8.6, rate_per_litre: 39.50, net_payable_amount: 869.00, collection_date: '2026-10-20', payment_status: 'ACCEPTED', centre_name: 'Chandanapuri Collection Centre' },
            { collection_id: 104, farmer_name: 'Tukaram Sopan Gunjal', farmer_code: 'FRM-1005', session: 'MORNING', milk_type: 'COW', quantity_litres: 16.20, fat_percentage: 4.0, snf_percentage: 8.7, rate_per_litre: 40.10, net_payable_amount: 649.62, collection_date: '2026-10-20', payment_status: 'ACCEPTED', centre_name: 'Chandanapuri Collection Centre' },
            { collection_id: 105, farmer_name: 'Pandurang Ganpat Aher', farmer_code: 'FRM-1007', session: 'MORNING', milk_type: 'BUFFALO', quantity_litres: 25.00, fat_percentage: 7.2, snf_percentage: 9.3, rate_per_litre: 64.50, net_payable_amount: 1612.50, collection_date: '2026-10-20', payment_status: 'ACCEPTED', centre_name: 'Ghulewadi Automated Dairy Point' },
            { collection_id: 106, farmer_name: 'Vishnu Ramchandra Rahane', farmer_code: 'FRM-1008', session: 'MORNING', milk_type: 'COW', quantity_litres: 19.50, fat_percentage: 3.8, snf_percentage: 8.5, rate_per_litre: 38.60, net_payable_amount: 752.70, collection_date: '2026-10-20', payment_status: 'ACCEPTED', centre_name: 'Ghulewadi Automated Dairy Point' },
            { collection_id: 107, farmer_name: 'Sunil Raosaheb Jadhav', farmer_code: 'FRM-1011', session: 'MORNING', milk_type: 'COW', quantity_litres: 12.80, fat_percentage: 4.1, snf_percentage: 8.7, rate_per_litre: 40.40, net_payable_amount: 517.12, collection_date: '2026-10-20', payment_status: 'ACCEPTED', centre_name: 'Loni Bulk Milk Cooling Centre' },
            { collection_id: 108, farmer_name: 'Ashok Laxman Kadam', farmer_code: 'FRM-1012', session: 'MORNING', milk_type: 'COW', quantity_litres: 15.40, fat_percentage: 3.7, snf_percentage: 8.5, rate_per_litre: 38.10, net_payable_amount: 586.74, collection_date: '2026-10-20', payment_status: 'ACCEPTED', centre_name: 'Loni Bulk Milk Cooling Centre' }
        ];
        res.json({ success: true, mode: 'sample_fallback', collections: sampleColls });
    }
});

// Record Milk Collection (Atomic Stored Procedure)
app.post('/api/collections', async (req, res) => {
    try {
        const {
            farmer_id, centre_id, collection_date, session,
            milk_type_id, quantity_litres, fat_percentage, snf_percentage,
            clr_reading = 28.0, temperature_celsius = 27.0, user_id = 3
        } = req.body;

        const date = collection_date || new Date().toISOString().split('T')[0];

        const [results] = await db.query(`
            CALL sp_record_milk_collection(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, @col_id, @rate, @gross, @net);
            SELECT @col_id AS collection_id, @rate AS rate_per_litre, @gross AS gross_amount, @net AS net_payable_amount;
        `, [farmer_id, centre_id, date, session, milk_type_id, quantity_litres, fat_percentage, snf_percentage, clr_reading, temperature_celsius, user_id]);

        const out = results[1][0];
        res.json({
            success: true,
            message: 'Milk collection successfully recorded with atomic consistency!',
            data: out
        });
    } catch (err) {
        console.error('Error recording collection:', err);
        res.status(400).json({ success: false, error: err.message });
    }
});

// Correct Milk Collection with Mandatory Audit Reason
app.put('/api/collections/:id', async (req, res) => {
    try {
        const collection_id = req.params.id;
        const { quantity_litres, fat_percentage, snf_percentage, reason, user_id = 2 } = req.body;

        if (!reason || reason.trim().length < 5) {
            return res.status(400).json({ success: false, error: 'A valid audit reason (minimum 5 characters) is required for data corrections.' });
        }

        await db.query(`
            CALL sp_correct_milk_collection(?, ?, ?, ?, ?, ?);
        `, [collection_id, quantity_litres, fat_percentage, snf_percentage, reason, user_id]);

        res.json({ success: true, message: 'Collection corrected and audit trail logged successfully.' });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// ---------------------------------------------------------------------
// 6. SETTLEMENT & PAYMENT PROCESSING
// ---------------------------------------------------------------------
app.get('/api/periods', async (req, res) => {
    try {
        const [periods] = await db.query(`
            SELECT pp.*,
                (SELECT COUNT(*) FROM farmer_payments fp WHERE fp.period_id = pp.period_id) AS total_settlements,
                (SELECT IFNULL(SUM(amount_paid), 0.00) FROM farmer_payments fp WHERE fp.period_id = pp.period_id) AS total_amount_disbursed
            FROM payment_periods pp
            ORDER BY pp.period_id DESC;
        `);
        res.json({ success: true, periods });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Preview unbilled supply totals for an open period
app.get('/api/periods/:id/preview', async (req, res) => {
    try {
        const periodId = req.params.id;
        const [periodRows] = await db.query('SELECT * FROM payment_periods WHERE period_id = ?', [periodId]);
        if (periodRows.length === 0) return res.status(404).json({ success: false, error: 'Period not found' });

        const period = periodRows[0];

        const [farmersDue] = await db.query(`
            SELECT
                f.farmer_id, f.farmer_code, CONCAT(f.first_name, ' ', f.last_name) AS farmer_name,
                cc.centre_name, f.bank_name, f.bank_account_number,
                COUNT(mc.collection_id) AS supply_records,
                ROUND(SUM(mc.quantity_litres), 2) AS total_litres,
                ROUND(SUM(mc.quantity_litres * mc.fat_percentage) / SUM(mc.quantity_litres), 2) AS weighted_fat,
                ROUND(SUM(mc.quantity_litres * mc.snf_percentage) / SUM(mc.quantity_litres), 2) AS weighted_snf,
                ROUND(SUM(mc.gross_amount), 2) AS gross_total,
                ROUND(SUM(mc.incentive_amount), 2) AS incentives_total,
                IFNULL(d.loan_balance, 0.00) AS total_loan_balance,
                ROUND(LEAST(IFNULL(d.loan_balance, 0), (SUM(mc.gross_amount) + SUM(mc.incentive_amount)) * 0.50), 2) AS deductible_recovery,
                ROUND((SUM(mc.gross_amount) + SUM(mc.incentive_amount)) - LEAST(IFNULL(d.loan_balance, 0), (SUM(mc.gross_amount) + SUM(mc.incentive_amount)) * 0.50), 2) AS estimated_net_payout
            FROM milk_collections mc
            JOIN farmers f ON mc.farmer_id = f.farmer_id
            JOIN collection_centres cc ON f.assigned_centre_id = cc.centre_id
            LEFT JOIN (
                SELECT farmer_id, SUM(balance_amount) AS loan_balance
                FROM farmer_deductions_master
                WHERE status = 'ACTIVE'
                GROUP BY farmer_id
            ) d ON f.farmer_id = d.farmer_id
            WHERE mc.collection_date BETWEEN ? AND ?
              AND mc.payment_status = 'PENDING'
            GROUP BY f.farmer_id, f.farmer_code, f.first_name, f.last_name, cc.centre_name, f.bank_name, f.bank_account_number, d.loan_balance
            ORDER BY total_litres DESC;
        `, [period.start_date, period.end_date]);

        res.json({ success: true, period, farmersDue });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Run Batch Payment Settlement Engine (Stored Procedure)
app.post('/api/periods/:id/settle', async (req, res) => {
    try {
        const periodId = req.params.id;
        const userId = req.body.user_id || 6; // Accounts officer Sunita Thorat

        const [results] = await db.query(`
            CALL sp_generate_farmer_payments(?, ?, @processed, @disbursed);
            SELECT @processed AS farmers_processed, @disbursed AS total_disbursed;
        `, [periodId, userId]);

        const out = results[1][0];
        res.json({
            success: true,
            message: `Batch settlement finalized successfully! ${out.farmers_processed} farmers settled.`,
            data: out
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// ---------------------------------------------------------------------
// 7. AUDIT TRAIL LOGS
// ---------------------------------------------------------------------
app.get('/api/audit-logs', async (req, res) => {
    try {
        const { table_name, limit = 50 } = req.query;
        let query = `
            SELECT al.*, u.full_name AS modified_by_name, u.role AS modified_by_role
            FROM audit_logs al
            LEFT JOIN users u ON al.modified_by_user_id = u.user_id
            WHERE 1=1
        `;
        const params = [];

        if (table_name) {
            query += ` AND al.table_name = ?`;
            params.push(table_name);
        }

        query += ` ORDER BY al.log_id DESC LIMIT ?`;
        params.push(parseInt(limit, 10));

        const [logs] = await db.query(query, params);
        res.json({ success: true, logs });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ---------------------------------------------------------------------
// 8. FORMAL QUERIES (Relational Algebra & SQL Demonstration)
// ---------------------------------------------------------------------
const FORMAL_QUERIES = {
    q1: {
        title: 'Farmers whose monthly milk quantity is above the centre average',
        algebra: `TempFarmerSum(farmer_id, centre_id, total_qty) <- _{farmer_id, centre_id} G _{SUM(quantity_litres)} (milk_collections)\nTempCentreAvg(centre_id, avg_centre_qty) <- _{centre_id} G _{AVG(total_qty)} (TempFarmerSum)\nResult <- \\sigma_{total_qty > avg_centre_qty} (TempFarmerSum \\bowtie TempCentreAvg \\bowtie farmers \\bowtie collection_centres)`,
        calculus: `{ t | \\exists f \\in farmers, \\exists c \\in collection_centres ( t.farmer_id = f.farmer_id \\land t.total_qty > AVG(centre_farmers) ) }`,
        sql: `
            SELECT f.farmer_code, CONCAT(f.first_name, ' ', f.last_name) AS farmer_name, cc.centre_name,
                   ROUND(fq.monthly_total_litres, 2) AS farmer_litres, ROUND(ca.centre_avg, 2) AS centre_avg,
                   ROUND(fq.monthly_total_litres - ca.centre_avg, 2) AS excess_litres
            FROM (
                SELECT farmer_id, centre_id, SUM(quantity_litres) AS monthly_total_litres
                FROM milk_collections WHERE collection_date BETWEEN '2026-10-01' AND '2026-10-31'
                GROUP BY farmer_id, centre_id
            ) fq
            JOIN (
                SELECT sub.centre_id, AVG(sub.monthly_total_litres) AS centre_avg
                FROM (SELECT farmer_id, centre_id, SUM(quantity_litres) AS monthly_total_litres FROM milk_collections WHERE collection_date BETWEEN '2026-10-01' AND '2026-10-31' GROUP BY farmer_id, centre_id) sub
                GROUP BY sub.centre_id
            ) ca ON fq.centre_id = ca.centre_id
            JOIN farmers f ON fq.farmer_id = f.farmer_id
            JOIN collection_centres cc ON fq.centre_id = cc.centre_id
            WHERE fq.monthly_total_litres > ca.centre_avg
            ORDER BY fq.monthly_total_litres DESC LIMIT 20;
        `
    },
    q2: {
        title: 'Collection centres showing monthly collection trends & comparisons',
        algebra: `PeriodVolume <- _{centre_id, month} G _{SUM(quantity_litres)} (milk_collections)\nLagged <- Window_{centre_id} (LAG(volume)) (PeriodVolume)`,
        calculus: `{ <c, m, vol, prev_vol> | \\exists cc \\in collection_centres ... }`,
        sql: `
            WITH MonthlyCollections AS (
                SELECT cc.centre_code, cc.centre_name, DATE_FORMAT(mc.collection_date, '%Y-%m') AS month_period,
                       SUM(mc.quantity_litres) AS monthly_litres
                FROM milk_collections mc
                JOIN collection_centres cc ON mc.centre_id = cc.centre_id
                GROUP BY cc.centre_code, cc.centre_name, DATE_FORMAT(mc.collection_date, '%Y-%m')
            )
            SELECT centre_code, centre_name, month_period, ROUND(monthly_litres, 2) AS current_volume,
                   ROUND(LAG(monthly_litres, 1) OVER (PARTITION BY centre_code ORDER BY month_period), 2) AS previous_volume
            FROM MonthlyCollections
            ORDER BY month_period DESC, centre_code ASC LIMIT 25;
        `
    },
    q4: {
        title: 'Farmers whose average fat percentage exceeds premium threshold',
        algebra: `QualitySupplies <- _{farmer_id} G _{WeightedFat, TotalQty} (milk_collections)\nResult <- \\sigma_{WeightedFat > 4.00} (QualitySupplies \\bowtie farmers)`,
        calculus: `{ t | \\exists f \\in farmers, \\exists m \\in milk_collections ( AVG(m.fat) > 4.00 ) }`,
        sql: `
            SELECT f.farmer_code, CONCAT(f.first_name, ' ', f.last_name) AS farmer_name,
                   mt.type_name AS milk_type, cc.centre_name,
                   ROUND(SUM(mc.quantity_litres), 2) AS total_litres,
                   ROUND(SUM(mc.quantity_litres * mc.fat_percentage) / SUM(mc.quantity_litres), 2) AS weighted_avg_fat,
                   ROUND(SUM(mc.quantity_litres * mc.snf_percentage) / SUM(mc.quantity_litres), 2) AS weighted_avg_snf
            FROM farmers f
            JOIN milk_collections mc ON f.farmer_id = mc.farmer_id
            JOIN milk_types mt ON mc.milk_type_id = mt.milk_type_id
            JOIN collection_centres cc ON mc.centre_id = cc.centre_id
            GROUP BY f.farmer_id, f.farmer_code, f.first_name, f.last_name, mt.type_name, cc.centre_name
            HAVING (mt.type_name = 'COW' AND weighted_avg_fat >= 3.90) OR (mt.type_name = 'BUFFALO' AND weighted_avg_fat >= 6.80)
            ORDER BY weighted_avg_fat DESC LIMIT 20;
        `
    },
    q5: {
        title: 'Relational Division: Farmers supplying milk in EVERY collection session',
        algebra: `FarmerSessions \\div AllTargetSessions \\bowtie farmers`,
        calculus: `{ <f_id, name> | \\forall <d, s> \\in TargetSessions ( \\exists m \\in milk_collections ( m.farmer = f_id \\land m.date = d \\land m.session = s ) ) }`,
        sql: `
            SELECT f.farmer_id, f.farmer_code, CONCAT(f.first_name, ' ', f.last_name) AS farmer_name,
                   f.phone, cc.centre_name,
                   COUNT(DISTINCT CONCAT(mc.collection_date, '-', mc.session)) AS sessions_attended,
                   target.total_sessions
            FROM farmers f
            JOIN milk_collections mc ON f.farmer_id = mc.farmer_id
            JOIN collection_centres cc ON f.assigned_centre_id = cc.centre_id
            CROSS JOIN (
                SELECT COUNT(DISTINCT CONCAT(collection_date, '-', session)) AS total_sessions
                FROM milk_collections WHERE collection_date BETWEEN '2026-10-16' AND '2026-10-18'
            ) target
            WHERE mc.collection_date BETWEEN '2026-10-16' AND '2026-10-18'
            GROUP BY f.farmer_id, f.farmer_code, f.first_name, f.last_name, f.phone, cc.centre_name, target.total_sessions
            HAVING sessions_attended = target.total_sessions;
        `
    },
    q6: {
        title: 'Determine the highest milk supplier at each collection centre',
        algebra: `RankedSuppliers <- Window_{centre_id ORDER BY vol DESC} (DENSE_RANK()) (CentreFarmerTotals)\nResult <- \\sigma_{rank = 1} (RankedSuppliers)`,
        calculus: `{ <c, f, vol> | \\forall f2 \\in centre_farmers ( vol \\ge f2.vol ) }`,
        sql: `
            WITH RankedSuppliers AS (
                SELECT mc.centre_id, mc.farmer_id, SUM(mc.quantity_litres) AS total_quantity,
                       SUM(mc.net_payable_amount) AS total_revenue,
                       DENSE_RANK() OVER (PARTITION BY mc.centre_id ORDER BY SUM(mc.quantity_litres) DESC) AS rank_pos
                FROM milk_collections mc
                GROUP BY mc.centre_id, mc.farmer_id
            )
            SELECT cc.centre_code, cc.centre_name, f.farmer_code,
                   CONCAT(f.first_name, ' ', f.last_name) AS highest_supplying_farmer,
                   ROUND(rs.total_quantity, 2) AS total_supplied_litres,
                   ROUND(rs.total_revenue, 2) AS total_earnings_inr
            FROM RankedSuppliers rs
            JOIN collection_centres cc ON rs.centre_id = cc.centre_id
            JOIN farmers f ON rs.farmer_id = f.farmer_id
            WHERE rs.rank_pos = 1;
        `
    },
    q8: {
        title: 'Compare Morning vs Evening milk collection metrics across centres',
        algebra: `_{centre_name} G _{SumMorning, SumEvening, AvgFatMorning, AvgFatEvening} (milk_collections)`,
        calculus: `{ <c, m_vol, e_vol> | ... }`,
        sql: `
            SELECT cc.centre_name,
                   ROUND(SUM(CASE WHEN mc.session = 'MORNING' THEN mc.quantity_litres ELSE 0 END), 2) AS morning_litres,
                   ROUND(SUM(CASE WHEN mc.session = 'EVENING' THEN mc.quantity_litres ELSE 0 END), 2) AS evening_litres,
                   ROUND(AVG(CASE WHEN mc.session = 'MORNING' THEN mc.fat_percentage END), 2) AS morning_avg_fat,
                   ROUND(AVG(CASE WHEN mc.session = 'EVENING' THEN mc.fat_percentage END), 2) AS evening_avg_fat,
                   ROUND(SUM(mc.quantity_litres), 2) AS combined_litres
            FROM milk_collections mc
            JOIN collection_centres cc ON mc.centre_id = cc.centre_id
            GROUP BY cc.centre_id, cc.centre_name
            ORDER BY combined_litres DESC;
        `
    }
};

app.get('/api/reports/list', (req, res) => {
    res.json({
        success: true,
        queries: Object.entries(FORMAL_QUERIES).map(([id, q]) => ({ id, title: q.title }))
    });
});

app.post('/api/reports/run', async (req, res) => {
    try {
        const { query_id } = req.body;
        const target = FORMAL_QUERIES[query_id];
        if (!target) return res.status(404).json({ success: false, error: 'Query not found' });

        const [rows] = await db.query(target.sql);
        res.json({
            success: true,
            title: target.title,
            algebra: target.algebra,
            calculus: target.calculus,
            sql: target.sql.trim(),
            rows
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ---------------------------------------------------------------------
// 9. BENCHMARK & INDEX EVALUATION API
// ---------------------------------------------------------------------
app.get('/api/benchmarks/results', (req, res) => {
    try {
        const reportPath = path.join(__dirname, '../benchmarks/BENCHMARK_RESULTS.md');
        if (fs.existsSync(reportPath)) {
            const content = fs.readFileSync(reportPath, 'utf8');
            res.json({ success: true, markdown: content });
        } else {
            res.json({ success: false, error: 'Benchmark report not generated yet.' });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ---------------------------------------------------------------------
// 10. ACID & CONCURRENCY TRANSACTION VISUALIZER
// ---------------------------------------------------------------------
app.post('/api/acid/test-rollback', async (req, res) => {
    try {
        const simulateFailure = req.body.simulate_failure !== false;
        const [results] = await db.query(`
            CALL sp_demo_payment_rollback(?, @outcome);
            SELECT @outcome AS outcome_message;
        `, [simulateFailure]);

        res.json({
            success: true,
            simulateFailure,
            outcome: results[1][0].outcome_message
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Start Express Server
app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`Dairy Management System Backend Server is Running!`);
    console.log(`Local URL: http://localhost:${PORT}`);
    console.log(`Connected to MySQL Database: dairy_db`);
    console.log(`====================================================`);
});
