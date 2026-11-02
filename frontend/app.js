// =====================================================================
// SAHYADRI DAIRY MANAGER - WEB APP INTERACTION LOGIC
// Role-Based Access Control (RBAC) Specification
// Ready for Vercel (Frontend) & Render (Backend)
// =====================================================================

// Base API URL:
// 1. Explicit window override (e.g. window.SAHYADRI_BACKEND_URL)
// 2. Saved preference in localStorage ('sahyadri_backend_url')
// 3. Local dev server (port != 4000) defaults to http://localhost:4000
// 4. Default: relative '' (relies on Vercel rewrites to Render backend, or same-origin Express server)
const API_BASE = (() => {
    if (typeof window === 'undefined') return '';
    if (window.SAHYADRI_BACKEND_URL) return window.SAHYADRI_BACKEND_URL;
    const stored = localStorage.getItem('sahyadri_backend_url');
    if (stored) return stored;
    if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
        window.location.port !== '4000' && window.location.port !== '') {
        return 'http://localhost:4000';
    }
    return '';
})();

// =====================================================================
// SAMPLE SEED DATASETS (Always visible as instant fallback)
// Matches MySQL 8.0 Seed Data across 4 Collection Centres
// =====================================================================
const SAMPLE_FARMERS = [
    { farmer_id: 1, farmer_code: 'FRM-1001', full_name: 'Ramesh Vitthal Gaikwad', village_name: 'Sangamner Khurd', phone: '+91 94231 55001', bank_name: 'State Bank of India', bank_account_number: '30981245671', ifsc_code: 'SBIN0000473', outstanding_loan: '2500.00' },
    { farmer_id: 2, farmer_code: 'FRM-1002', full_name: 'Babasaheb Eknath Dighe', village_name: 'Sangamner Khurd', phone: '+91 94231 55002', bank_name: 'Bank of Maharashtra', bank_account_number: '60124578912', ifsc_code: 'MAHB0000128', outstanding_loan: '1200.00' },
    { farmer_id: 3, farmer_code: 'FRM-1003', full_name: 'Eknath Dashrath Kute', village_name: 'Sangamner Khurd', phone: '+91 94231 55003', bank_name: 'State Bank of India', bank_account_number: '30981245673', ifsc_code: 'SBIN0000473', outstanding_loan: '0.00' },
    { farmer_id: 4, farmer_code: 'FRM-1004', full_name: 'Dnyaneshwar Bhikaji Navale', village_name: 'Chandanapuri', phone: '+91 94231 55004', bank_name: 'Union Bank of India', bank_account_number: '40561238901', ifsc_code: 'UBIN0540561', outstanding_loan: '2800.00' },
    { farmer_id: 5, farmer_code: 'FRM-1005', full_name: 'Tukaram Sopan Gunjal', village_name: 'Chandanapuri', phone: '+91 94231 55005', bank_name: 'Bank of Maharashtra', bank_account_number: '60124578915', ifsc_code: 'MAHB0000128', outstanding_loan: '0.00' },
    { farmer_id: 6, farmer_code: 'FRM-1006', full_name: 'Sanjay Kashinath Tambe', village_name: 'Chandanapuri', phone: '+91 94231 55006', bank_name: 'State Bank of India', bank_account_number: '30981245676', ifsc_code: 'SBIN0000473', outstanding_loan: '0.00' },
    { farmer_id: 7, farmer_code: 'FRM-1007', full_name: 'Pandurang Ganpat Aher', village_name: 'Ghulewadi', phone: '+91 94231 55007', bank_name: 'HDFC Bank', bank_account_number: '50100245890123', ifsc_code: 'HDFC0000240', outstanding_loan: '4000.00' },
    { farmer_id: 8, farmer_code: 'FRM-1008', full_name: 'Vishnu Ramchandra Rahane', village_name: 'Ghulewadi', phone: '+91 94231 55008', bank_name: 'Bank of Baroda', bank_account_number: '1245010003456', ifsc_code: 'BARB0SANGAM', outstanding_loan: '0.00' },
    { farmer_id: 9, farmer_code: 'FRM-1009', full_name: 'Nivritti Bhaurao Bhandari', village_name: 'Ghulewadi', phone: '+91 94231 55009', bank_name: 'State Bank of India', bank_account_number: '30981245679', ifsc_code: 'SBIN0000473', outstanding_loan: '0.00' },
    { farmer_id: 10, farmer_code: 'FRM-1010', full_name: 'Sharad Shankar Thorat', village_name: 'Loni Budruk', phone: '+91 94231 55010', bank_name: 'State Bank of India', bank_account_number: '30981245680', ifsc_code: 'SBIN0001234', outstanding_loan: '0.00' },
    { farmer_id: 11, farmer_code: 'FRM-1011', full_name: 'Sunil Raosaheb Jadhav', village_name: 'Loni Budruk', phone: '+91 94231 55011', bank_name: 'Bank of Maharashtra', bank_account_number: '60124578921', ifsc_code: 'MAHB0000456', outstanding_loan: '1500.00' },
    { farmer_id: 12, farmer_code: 'FRM-1012', full_name: 'Ashok Laxman Kadam', village_name: 'Loni Budruk', phone: '+91 94231 55012', bank_name: 'Union Bank of India', bank_account_number: '40561238912', ifsc_code: 'UBIN0540561', outstanding_loan: '0.00' },
    { farmer_id: 13, farmer_code: 'FRM-1013', full_name: 'Bhausaheb Namdeo Wakchaure', village_name: 'Sangamner Khurd', phone: '+91 94231 55013', bank_name: 'State Bank of India', bank_account_number: '30981245683', ifsc_code: 'SBIN0000473', outstanding_loan: '0.00' },
    { farmer_id: 14, farmer_code: 'FRM-1014', full_name: 'Kalyan Tryambak Shinde', village_name: 'Chandanapuri', phone: '+91 94231 55014', bank_name: 'Bank of Baroda', bank_account_number: '1245010003460', ifsc_code: 'BARB0SANGAM', outstanding_loan: '0.00' },
    { farmer_id: 15, farmer_code: 'FRM-1015', full_name: 'Kailas Sakharam Pawar', village_name: 'Sakur', phone: '+91 94231 55015', bank_name: 'State Bank of India', bank_account_number: '30981245685', ifsc_code: 'SBIN0000473', outstanding_loan: '900.00' }
];

let SAMPLE_COLLECTIONS = [
    { collection_id: 101, farmer_name: 'Ramesh Vitthal Gaikwad', farmer_code: 'FRM-1001', session: 'MORNING', milk_type_name: 'COW', quantity_litres: '14.50', fat_percentage: '4.2', snf_percentage: '8.8', rate_per_litre: '41.20', net_payable_amount: '597.40', collection_date: 'Today', payment_status: 'ACCEPTED' },
    { collection_id: 102, farmer_name: 'Babasaheb Eknath Dighe', farmer_code: 'FRM-1002', session: 'MORNING', milk_type_name: 'BUFFALO', quantity_litres: '18.00', fat_percentage: '6.8', snf_percentage: '9.1', rate_per_litre: '61.50', net_payable_amount: '1107.00', collection_date: 'Today', payment_status: 'ACCEPTED' },
    { collection_id: 103, farmer_name: 'Dnyaneshwar Bhikaji Navale', farmer_code: 'FRM-1004', session: 'MORNING', milk_type_name: 'COW', quantity_litres: '22.00', fat_percentage: '3.9', snf_percentage: '8.6', rate_per_litre: '39.50', net_payable_amount: '869.00', collection_date: 'Today', payment_status: 'ACCEPTED' },
    { collection_id: 104, farmer_name: 'Tukaram Sopan Gunjal', farmer_code: 'FRM-1005', session: 'MORNING', milk_type_name: 'COW', quantity_litres: '16.20', fat_percentage: '4.0', snf_percentage: '8.7', rate_per_litre: '40.10', net_payable_amount: '649.62', collection_date: 'Today', payment_status: 'ACCEPTED' },
    { collection_id: 105, farmer_name: 'Pandurang Ganpat Aher', farmer_code: 'FRM-1007', session: 'MORNING', milk_type_name: 'BUFFALO', quantity_litres: '25.00', fat_percentage: '7.2', snf_percentage: '9.3', rate_per_litre: '64.50', net_payable_amount: '1612.50', collection_date: 'Today', payment_status: 'ACCEPTED' },
    { collection_id: 106, farmer_name: 'Vishnu Ramchandra Rahane', farmer_code: 'FRM-1008', session: 'MORNING', milk_type_name: 'COW', quantity_litres: '19.50', fat_percentage: '3.8', snf_percentage: '8.5', rate_per_litre: '38.60', net_payable_amount: '752.70', collection_date: 'Today', payment_status: 'ACCEPTED' },
    { collection_id: 107, farmer_name: 'Sunil Raosaheb Jadhav', farmer_code: 'FRM-1011', session: 'MORNING', milk_type_name: 'COW', quantity_litres: '12.80', fat_percentage: '4.1', snf_percentage: '8.7', rate_per_litre: '40.40', net_payable_amount: '517.12', collection_date: 'Today', payment_status: 'ACCEPTED' },
    { collection_id: 108, farmer_name: 'Ashok Laxman Kadam', farmer_code: 'FRM-1012', session: 'MORNING', milk_type_name: 'COW', quantity_litres: '15.40', fat_percentage: '3.7', snf_percentage: '8.5', rate_per_litre: '38.10', net_payable_amount: '586.74', collection_date: 'Today', payment_status: 'ACCEPTED' },
    { collection_id: 109, farmer_name: 'Bhausaheb Namdeo Wakchaure', farmer_code: 'FRM-1013', session: 'EVENING', milk_type_name: 'COW', quantity_litres: '13.00', fat_percentage: '3.9', snf_percentage: '8.6', rate_per_litre: '39.50', net_payable_amount: '513.50', collection_date: 'Yesterday', payment_status: 'PAID' },
    { collection_id: 110, farmer_name: 'Kalyan Tryambak Shinde', farmer_code: 'FRM-1014', session: 'EVENING', milk_type_name: 'BUFFALO', quantity_litres: '20.50', fat_percentage: '6.9', snf_percentage: '9.2', rate_per_litre: '62.00', net_payable_amount: '1271.00', collection_date: 'Yesterday', payment_status: 'PAID' }
];

const SAMPLE_FARMER_PASSBOOK = {
    farmer: SAMPLE_FARMERS[0],
    summary: {
        total_milk_supplied: '142.5',
        total_earnings: '5890',
        weighted_avg_fat: '4.2',
        total_outstanding_loan: '2500'
    },
    collections: [
        { collection_id: 201, collection_date: '2026-10-20', session: 'MORNING', quantity_litres: 15.0, fat_percentage: 4.2, snf_percentage: 8.8, rate_per_litre: 41.20, net_payable_amount: 618.00, payment_status: 'ACCEPTED' },
        { collection_id: 202, collection_date: '2026-10-20', session: 'EVENING', quantity_litres: 13.5, fat_percentage: 4.1, snf_percentage: 8.7, rate_per_litre: 40.80, net_payable_amount: 550.80, payment_status: 'ACCEPTED' },
        { collection_id: 203, collection_date: '2026-10-19', session: 'MORNING', quantity_litres: 14.8, fat_percentage: 4.3, snf_percentage: 8.9, rate_per_litre: 41.90, net_payable_amount: 620.12, payment_status: 'ACCEPTED' },
        { collection_id: 204, collection_date: '2026-10-19', session: 'EVENING', quantity_litres: 14.0, fat_percentage: 4.0, snf_percentage: 8.6, rate_per_litre: 40.20, net_payable_amount: 562.80, payment_status: 'ACCEPTED' },
        { collection_id: 205, collection_date: '2026-10-18', session: 'MORNING', quantity_litres: 15.2, fat_percentage: 4.2, snf_percentage: 8.8, rate_per_litre: 41.20, net_payable_amount: 626.24, payment_status: 'ACCEPTED' },
        { collection_id: 206, collection_date: '2026-10-18', session: 'EVENING', quantity_litres: 13.8, fat_percentage: 4.1, snf_percentage: 8.7, rate_per_litre: 40.80, net_payable_amount: 563.04, payment_status: 'ACCEPTED' },
        { collection_id: 207, collection_date: '2026-10-17', session: 'MORNING', quantity_litres: 14.5, fat_percentage: 4.1, snf_percentage: 8.8, rate_per_litre: 41.00, net_payable_amount: 594.50, payment_status: 'PAID' },
        { collection_id: 208, collection_date: '2026-10-17', session: 'EVENING', quantity_litres: 13.2, fat_percentage: 4.0, snf_percentage: 8.6, rate_per_litre: 40.20, net_payable_amount: 530.64, payment_status: 'PAID' },
        { collection_id: 209, collection_date: '2026-10-16', session: 'MORNING', quantity_litres: 15.0, fat_percentage: 4.2, snf_percentage: 8.8, rate_per_litre: 41.20, net_payable_amount: 618.00, payment_status: 'PAID' },
        { collection_id: 210, collection_date: '2026-10-16', session: 'EVENING', quantity_litres: 13.5, fat_percentage: 4.1, snf_percentage: 8.7, rate_per_litre: 40.80, net_payable_amount: 550.80, payment_status: 'PAID' }
    ]
};

const ROLE_PERMISSIONS = {
    MAIN_MANAGER: {
        roleName: 'Main Sangh Manager',
        title: 'Sahyadri Dairy (Main Sangh)',
        subtitle: 'Sahyadri Sahakari Dudh Sangh · Head Office (All Centers)',
        allowedPages: ['home', 'farmers', 'rates', 'ledger'],
        navLabels: {
            home: 'Home',
            farmers: 'Farmers',
            rates: 'Rates',
            ledger: 'Muster'
        },
        pillText: 'Allowed: Home • Farmers • Rates • Muster',
        toastText: 'Logged in as Sahyadri Main Sangh Manager (Consolidated Sangh View)'
    },
    CENTER_MANAGER: {
        roleName: 'Center Manager / Operator',
        title: 'Sahyadri Dairy',
        subtitle: 'Sahyadri Sahakari Dudh Sangh · Collection Center 04',
        allowedPages: ['home', 'collect', 'farmers', 'ledger'],
        navLabels: {
            home: 'Home',
            collect: 'Collect',
            farmers: 'Farmers',
            ledger: 'Muster'
        },
        pillText: 'Allowed: Home • Collect • Farmers • Muster',
        toastText: 'Logged in as Center Manager (Center 04 Operations)'
    },
    FARMER: {
        roleName: 'Milk Producer Farmer',
        title: 'Sahyadri Farmer Passbook & Muster',
        subtitle: 'Ramesh Gaikwad · FRM-1001 (Center 01)',
        allowedPages: ['home', 'farmers', 'ledger'],
        navLabels: {
            home: 'My Supply',
            farmers: 'My Profile',
            ledger: 'My Muster'
        },
        pillText: 'Allowed: My Supply • My Profile • My Muster',
        toastText: 'Logged in as Farmer (10-Day Muster & Passbook Access)'
    }
};

let activeRole = 'CENTER_MANAGER'; // default initial role
let activeSession = 'MORNING';
let activeMilkType = 1; // 1: Cow, 2: Buffalo
let globalFarmers = [...SAMPLE_FARMERS]; // Initialized immediately with sample farmers
let loggedInFarmerId = 1; // Default farmer: Ramesh Gaikwad

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    applyRolePermissions(activeRole, false);
    populateFarmerSelect();
    loadHomeData();
    calculateRatePreview();
    // Fetch live database updates asynchronously if backend is reachable
    await loadFarmersList();
}

// ---------------------------------------------------------------------
// 1. ROLE-BASED NAVIGATION GUARD
// ---------------------------------------------------------------------
function navTo(pageKey) {
    const config = ROLE_PERMISSIONS[activeRole];
    if (!config || !config.allowedPages.includes(pageKey)) {
        showToast(`⛔ Access Denied: '${pageKey.toUpperCase()}' is restricted for ${config ? config.roleName : 'this role'}`);
        return false;
    }

    // Hide all pages
    document.querySelectorAll('.page-view').forEach(view => view.classList.remove('active'));
    document.querySelectorAll('.nav-item-btn').forEach(btn => btn.classList.remove('active'));

    // Show target page
    const targetView = document.getElementById(`view-${pageKey}`);
    const targetBtn = document.getElementById(`nav-btn-${pageKey}`);

    if (targetView) targetView.classList.add('active');
    if (targetBtn) targetBtn.classList.add('active');

    if (pageKey === 'home') loadHomeData();
    if (pageKey === 'farmers') renderFarmersPage();
    if (pageKey === 'ledger') renderLedgerPage();
    return true;
}

// ---------------------------------------------------------------------
// 2. 3-LOGIN ROLE SWITCHER (Applies Page Access by Work/Responsibility)
// ---------------------------------------------------------------------
function applyRolePermissions(role, triggerNav = true) {
    activeRole = role;
    const config = ROLE_PERMISSIONS[role];
    if (!config) return;

    // A. Update Top Header Texts & Security Access Pill
    document.getElementById('appTitle').innerText = config.title;
    document.getElementById('appSubtitle').innerText = config.subtitle;
    document.getElementById('roleAccessBadge').innerText = config.pillText;

    // B. Re-configure Bottom Navigation Buttons
    const allButtons = ['home', 'collect', 'farmers', 'rates', 'ledger'];
    allButtons.forEach(key => {
        const btn = document.getElementById(`nav-btn-${key}`);
        if (!btn) return;

        if (config.allowedPages.includes(key)) {
            btn.style.display = 'flex';
            const labelSpan = btn.querySelector('.nav-label');
            if (labelSpan && config.navLabels[key]) {
                labelSpan.innerText = config.navLabels[key];
            }
        } else {
            btn.style.display = 'none';
        }
    });

    // C. Navigate to currently active or default allowed page
    const currentActiveView = document.querySelector('.page-view.active');
    const currentKey = currentActiveView ? currentActiveView.id.replace('view-', '') : 'home';

    if (triggerNav || !config.allowedPages.includes(currentKey)) {
        navTo('home');
    } else {
        navTo(currentKey);
    }
}

function switchRole(role) {
    applyRolePermissions(role, true);
    const config = ROLE_PERMISSIONS[role];
    if (config) {
        showToast(config.toastText);
    }
}

// ---------------------------------------------------------------------
// 3. HOME PAGE DATA LOADING
// ---------------------------------------------------------------------
async function loadHomeData() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase();
    const heroDate = document.getElementById('heroDateText');
    if (heroDate) heroDate.innerText = dateStr;

    if (activeRole === 'FARMER') {
        try {
            const farmerRes = await fetch(`${API_BASE}/api/farmers/${loggedInFarmerId}/passbook`);
            const farmerData = await farmerRes.json();
            if (farmerData && farmerData.success) {
                renderFarmerHomeView(farmerData);
                return;
            }
        } catch (e) {
            // fallback to sample passbook data
        }
        renderFarmerHomeView({ success: true, ...SAMPLE_FARMER_PASSBOOK });
        return;
    }

    // Default sample stats for managers
    document.getElementById('heroLitresNumber').innerText = '146.4';
    document.getElementById('heroFarmersCount').innerText = '8';
    document.getElementById('heroMorningLitres').innerText = '85.2 L';
    document.getElementById('heroEveningLitres').innerText = '61.2 L';
    document.getElementById('cycleTileLabel').innerText = 'MUSTER 1–10 OCT';
    document.getElementById('cycleLitresVal').innerText = '2,198';
    document.getElementById('payableSoFarVal').innerText = '₹74,915';
    document.getElementById('avgFatTodayVal').innerText = '4.6';
    document.getElementById('avgSnfTodayVal').innerText = '8.5';
    renderLatestEntries(SAMPLE_COLLECTIONS);

    // Try fetching live stats if backend database is connected
    try {
        const [sumRes, colRes] = await Promise.all([
            fetch(`${API_BASE}/api/summary`),
            fetch(`${API_BASE}/api/collections?limit=15`)
        ]);
        const sumData = await sumRes.json();
        const colData = await colRes.json();

        if (sumData && sumData.success) {
            const today = sumData.today || {};
            const overall = sumData.overall || {};

            if (today.total_litres_today) {
                document.getElementById('heroLitresNumber').innerText = parseFloat(today.total_litres_today).toFixed(1);
            }
            if (today.active_farmers_today) {
                document.getElementById('heroFarmersCount').innerText = today.active_farmers_today;
            }

            if (sumData.sessionBreakdown) {
                let morningL = 0;
                let eveningL = 0;
                sumData.sessionBreakdown.forEach(s => {
                    if (s.session === 'MORNING') morningL = parseFloat(s.litres);
                    if (s.session === 'EVENING') eveningL = parseFloat(s.litres);
                });
                document.getElementById('heroMorningLitres').innerText = `${morningL.toFixed(1)} L`;
                document.getElementById('heroEveningLitres').innerText = `${eveningL.toFixed(1)} L`;
            }

            if (overall.total_milk_lifetime_litres) {
                document.getElementById('cycleLitresVal').innerText = parseFloat(overall.total_milk_lifetime_litres).toLocaleString();
            }
            if (overall.pending_settlement_inr) {
                document.getElementById('payableSoFarVal').innerText = `₹${parseFloat(overall.pending_settlement_inr).toLocaleString('en-IN')}`;
            }
            if (today.avg_fat_today) document.getElementById('avgFatTodayVal').innerText = today.avg_fat_today;
            if (today.avg_snf_today) document.getElementById('avgSnfTodayVal').innerText = today.avg_snf_today;
        }

        if (colData && colData.success && colData.collections && colData.collections.length > 0) {
            renderLatestEntries(colData.collections);
        }
    } catch (err) {
        // Backend offline / starting up - sample fallback remains cleanly displayed
    }
}

function renderLatestEntries(collections) {
    const list = document.getElementById('latestEntriesList');
    if (!list) return;
    if (!collections || collections.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:0.85rem;">No collection entries yet today.</div>`;
        return;
    }

    const avatarColors = ['', 'green', 'teal', 'blue'];

    list.innerHTML = collections.slice(0, 8).map((c, idx) => {
        const initials = c.farmer_name ? c.farmer_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'FR';
        const colorClass = avatarColors[idx % avatarColors.length];

        return `
            <div class="entry-card">
                <div class="entry-left">
                    <div class="farmer-avatar ${colorClass}">${initials}</div>
                    <div class="farmer-info-col">
                        <h4>${c.farmer_name}</h4>
                        <div class="farmer-meta-row">
                            <span>${parseFloat(c.quantity_litres).toFixed(1)} L</span>
                            <span>•</span>
                            <span>Fat ${parseFloat(c.fat_percentage).toFixed(1)}%</span>
                            <span>•</span>
                            <span>SNF ${parseFloat(c.snf_percentage).toFixed(1)}%</span>
                            <span class="session-pill">${c.session}</span>
                        </div>
                    </div>
                </div>
                <div class="entry-right">
                    <div class="entry-amount">₹${parseFloat(c.net_payable_amount).toFixed(2)}</div>
                    <div class="entry-rate">@ ₹${parseFloat(c.rate_per_litre).toFixed(2)}/L</div>
                </div>
            </div>
        `;
    }).join('');
}

function renderFarmerHomeView(farmerData) {
    if (!farmerData.success) return;
    const { summary, collections } = farmerData;

    document.getElementById('heroDateText').innerText = 'MY SUPPLY TODAY';
    document.getElementById('heroLitresNumber').innerText = summary ? parseFloat(summary.total_milk_supplied || 16.5).toFixed(1) : '16.5';
    document.getElementById('heroFarmersCount').innerText = '1';
    document.getElementById('heroMorningLitres').innerText = '15.0 L';
    document.getElementById('heroEveningLitres').innerText = '13.5 L';

    document.getElementById('cycleTileLabel').innerText = 'MY MUSTER TOTAL';
    document.getElementById('cycleLitresVal').innerText = summary ? parseFloat(summary.total_milk_supplied).toLocaleString() : '142.5';
    document.getElementById('payableSoFarVal').innerText = summary ? `₹${parseFloat(summary.total_earnings).toLocaleString('en-IN')}` : '₹5,890';
    document.getElementById('avgFatTodayVal').innerText = summary ? summary.weighted_avg_fat : '4.2';
    document.getElementById('avgSnfTodayVal').innerText = '8.8';

    renderLatestEntries(collections || []);
}

// ---------------------------------------------------------------------
// 4. COLLECT PAGE (Fast Intake & Instant Rate Calculation)
// ---------------------------------------------------------------------
function populateFarmerSelect() {
    const select = document.getElementById('collectFarmerSelect');
    if (!select) return;
    select.innerHTML = `<option value="">-- Choose Registered Farmer --</option>` +
        globalFarmers.map(f => `<option value="${f.farmer_id}">${f.farmer_code} · ${f.full_name} (${f.village_name})</option>`).join('');
}

async function loadFarmersList() {
    try {
        const res = await fetch(`${API_BASE}/api/farmers`);
        const data = await res.json();
        if (data && data.success && data.farmers && data.farmers.length > 0) {
            globalFarmers = data.farmers;
            populateFarmerSelect();
            if (activeRole === 'FARMER' || document.getElementById('view-farmers').classList.contains('active')) {
                renderFarmersPage();
            }
        }
    } catch (err) {
        // Keeps sample farmers active
    }
}

function setSession(session) {
    activeSession = session;
    document.getElementById('btnSessionMorning').classList.toggle('active', session === 'MORNING');
    document.getElementById('btnSessionEvening').classList.toggle('active', session === 'EVENING');
}

function setMilkType(typeId) {
    activeMilkType = typeId;
    document.getElementById('btnTypeCow').classList.toggle('active', typeId === 1);
    document.getElementById('btnTypeBuffalo').classList.toggle('active', typeId === 2);
    calculateRatePreview();
}

function updateFarmerInfo() {
    calculateRatePreview();
}

let calcTimer = null;
async function calculateRatePreview() {
    clearTimeout(calcTimer);
    calcTimer = setTimeout(async () => {
        const fat = parseFloat(document.getElementById('collectFat').value) || 4.2;
        const snf = parseFloat(document.getElementById('collectSnf').value) || 8.6;
        const qty = parseFloat(document.getElementById('collectQty').value) || 15.0;

        try {
            const res = await fetch(`${API_BASE}/api/rates/calculate?milk_type_id=${activeMilkType}&fat=${fat}&snf=${snf}`);
            const data = await res.json();
            if (data && data.success) {
                const rate = parseFloat(data.rate_per_litre);
                const total = qty * rate;
                document.getElementById('calcRate').innerText = `₹${rate.toFixed(2)} / L`;
                document.getElementById('calcTotal').innerText = `₹${total.toFixed(2)}`;
                return;
            }
        } catch (e) {
            // fallback rate formula
        }
        const rate = activeMilkType === 1 ? (37.5 + (fat - 3.5) * 3.0 + (snf - 8.5) * 2.0) : (56.0 + (fat - 6.5) * 4.5 + (snf - 9.0) * 2.5);
        document.getElementById('calcRate').innerText = `₹${rate.toFixed(2)} / L`;
        document.getElementById('calcTotal').innerText = `₹${(qty * rate).toFixed(2)}`;
    }, 100);
}

async function handleCollectSubmit(e) {
    e.preventDefault();
    const farmerId = parseInt(document.getElementById('collectFarmerSelect').value);
    const qty = parseFloat(document.getElementById('collectQty').value);
    const fat = parseFloat(document.getElementById('collectFat').value);
    const snf = parseFloat(document.getElementById('collectSnf').value);

    if (!farmerId) {
        alert('Please choose a registered farmer from the dropdown.');
        return;
    }

    const selectedFarmer = globalFarmers.find(f => f.farmer_id === farmerId) || globalFarmers[0];
    const estimatedRate = activeMilkType === 1 ? (37.5 + (fat - 3.5) * 3.0 + (snf - 8.5) * 2.0) : (56.0 + (fat - 6.5) * 4.5 + (snf - 9.0) * 2.5);
    const netAmount = qty * estimatedRate;

    try {
        const res = await fetch(`${API_BASE}/api/collections`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                farmer_id: farmerId,
                centre_id: 1,
                collection_date: new Date().toISOString().split('T')[0],
                session: activeSession,
                milk_type_id: activeMilkType,
                quantity_litres: qty,
                fat_percentage: fat,
                snf_percentage: snf,
                user_id: 3
            })
        });

        const data = await res.json();
        if (data && data.success) {
            showToast(`✅ Collection recorded: ${qty} L @ ₹${data.data.net_payable_amount}`);
            document.getElementById('collectQty').value = '';
            loadHomeData();
            navTo('home');
            return;
        }
    } catch (err) {
        // Backend API offline or database connecting: record locally into sample state
    }

    // Add entry to client collections list
    SAMPLE_COLLECTIONS.unshift({
        collection_id: Date.now(),
        farmer_name: selectedFarmer.full_name,
        farmer_code: selectedFarmer.farmer_code,
        session: activeSession,
        milk_type_name: activeMilkType === 1 ? 'COW' : 'BUFFALO',
        quantity_litres: qty.toFixed(2),
        fat_percentage: fat.toFixed(1),
        snf_percentage: snf.toFixed(1),
        rate_per_litre: estimatedRate.toFixed(2),
        net_payable_amount: netAmount.toFixed(2),
        collection_date: 'Today',
        payment_status: 'ACCEPTED'
    });

    showToast(`🥛 Milk collection recorded: ${qty} L for ${selectedFarmer.full_name}`);
    document.getElementById('collectQty').value = '';
    loadHomeData();
    navTo('home');
}

// ---------------------------------------------------------------------
// 5. FARMERS PAGE (Tailored to active user role)
// ---------------------------------------------------------------------
function renderFarmersPage() {
    const list = document.getElementById('farmersList');
    const searchCard = document.getElementById('farmerSearchCard');
    if (!list) return;

    if (activeRole === 'FARMER') {
        // Strict Privacy: Hide global search bar from individual farmers
        if (searchCard) searchCard.style.display = 'none';

        const f = globalFarmers.find(x => x.farmer_id === loggedInFarmerId) || globalFarmers[0];
        if (!f) return;

        list.innerHTML = `
            <div class="form-card" style="box-shadow:var(--shadow-card);">
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
                    <div class="farmer-avatar" style="width:50px; height:50px; font-size:1.15rem; background:var(--primary-green);">${f.full_name.substring(0, 2).toUpperCase()}</div>
                    <div>
                        <h3 style="font-size:1.05rem; font-weight:800; color:var(--text-primary);">${f.full_name}</h3>
                        <p style="font-size:0.75rem; color:var(--primary-green); font-weight:700;">Code: ${f.farmer_code} · ${f.village_name}</p>
                    </div>
                </div>
                <div style="font-size:0.83rem; color:var(--text-muted); line-height:1.8; border-top:1px solid var(--border-light); padding-top:10px;">
                    <div>📱 Registered Mobile: <strong style="color:var(--text-primary);">${f.phone}</strong></div>
                    <div>🏦 Bank Name: <strong style="color:var(--text-primary);">${f.bank_name}</strong></div>
                    <div>💳 Account Number: <strong style="color:var(--text-primary); font-family:monospace;">${f.bank_account_number}</strong></div>
                    <div>🏢 IFSC Code: <code style="background:#f1f5f9; padding:1px 6px; border-radius:4px;">${f.ifsc_code}</code></div>
                    <div>📍 Assigned Center: <strong style="color:var(--text-primary);">Collection Center 01 (Sangamner)</strong></div>
                    <div>🌾 Active Cattle Feed / Advance Loan: <strong style="color:var(--accent-rose); font-size:0.95rem;">₹${f.outstanding_loan || '0.00'}</strong></div>
                </div>
            </div>
        `;
        return;
    }

    // Main Manager & Center Manager views: Show full directory search
    if (searchCard) searchCard.style.display = 'block';
    filterFarmerList();
}

function filterFarmerList() {
    const term = (document.getElementById('farmerSearchBox').value || '').toLowerCase().trim();
    const list = document.getElementById('farmersList');
    if (!list) return;

    const filtered = globalFarmers.filter(f =>
        f.full_name.toLowerCase().includes(term) ||
        f.farmer_code.toLowerCase().includes(term) ||
        (f.phone && f.phone.includes(term)) ||
        (f.village_name && f.village_name.toLowerCase().includes(term))
    );

    if (filtered.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:0.85rem;">No farmers match your search.</div>`;
        return;
    }

    list.innerHTML = filtered.map(f => `
        <div class="entry-card">
            <div class="entry-left">
                <div class="farmer-avatar">${f.full_name.substring(0, 2).toUpperCase()}</div>
                <div class="farmer-info-col">
                    <h4>${f.full_name}</h4>
                    <div class="farmer-meta-row">
                        <span>${f.farmer_code}</span>
                        <span>•</span>
                        <span>${f.village_name}</span>
                        <span>•</span>
                        <span>${f.phone}</span>
                    </div>
                </div>
            </div>
            <div class="entry-right">
                <div class="entry-amount" style="font-size:0.82rem; color:var(--text-muted);">
                    ${parseFloat(f.outstanding_loan) > 0 ? `<span style="color:var(--accent-rose); font-weight:700;">Loan: ₹${f.outstanding_loan}</span>` : '<span style="color:var(--primary-green); font-weight:600;">No Dues</span>'}
                </div>
            </div>
        </div>
    `).join('');
}

// ---------------------------------------------------------------------
// 6. LEDGER PAGE (Customized for each user's job)
// ---------------------------------------------------------------------
async function renderLedgerPage() {
    const list = document.getElementById('ledgerEntriesList');
    const ledgerCycleBadge = document.getElementById('ledgerCycleBadge');
    const ledgerTotalNet = document.getElementById('ledgerTotalNet');
    const ledgerGross = document.getElementById('ledgerGross');
    const ledgerDeductions = document.getElementById('ledgerDeductions');
    const ledgerSectionTitle = document.getElementById('ledgerSectionTitle');

    if (activeRole === 'FARMER') {
        if (ledgerCycleBadge) ledgerCycleBadge.innerText = 'MY 10-DAY MUSTER BILL (1–10 OCT)';
        if (ledgerTotalNet) ledgerTotalNet.innerText = '₹5,890';
        if (ledgerGross) ledgerGross.innerText = '142.5 L Supplied';
        if (ledgerDeductions) ledgerDeductions.innerText = '₹2,500';
        if (ledgerSectionTitle) ledgerSectionTitle.innerText = 'MY MUSTER COLLECTION SLIPS';

        let colls = SAMPLE_FARMER_PASSBOOK.collections;
        try {
            const res = await fetch(`${API_BASE}/api/farmers/${loggedInFarmerId}/passbook`);
            const data = await res.json();
            if (data && data.success) {
                const s = data.summary || {};
                if (ledgerTotalNet) ledgerTotalNet.innerText = `₹${parseFloat(s.total_earnings || 5890).toLocaleString('en-IN')}`;
                if (ledgerGross) ledgerGross.innerText = `${parseFloat(s.total_milk_supplied || 142.5).toFixed(1)} L Supplied`;
                if (ledgerDeductions) ledgerDeductions.innerText = `₹${parseFloat(s.total_outstanding_loan || 2500).toLocaleString('en-IN')}`;
                if (data.collections && data.collections.length > 0) colls = data.collections;
            }
        } catch (e) {
            // Uses fallback
        }

        if (list) {
            list.innerHTML = colls.map(c => `
                <div class="entry-card">
                    <div class="entry-left">
                        <div class="farmer-avatar green">${c.session ? c.session[0] : 'M'}</div>
                        <div class="farmer-info-col">
                            <h4>${c.collection_date} · ${c.session}</h4>
                            <div class="farmer-meta-row">
                                <span>${parseFloat(c.quantity_litres).toFixed(1)} L</span>
                                <span>•</span>
                                <span>Fat ${parseFloat(c.fat_percentage).toFixed(1)}%</span>
                                <span>•</span>
                                <span>SNF ${parseFloat(c.snf_percentage).toFixed(1)}%</span>
                                <span>•</span>
                                <span>₹${parseFloat(c.rate_per_litre).toFixed(2)}/L</span>
                            </div>
                        </div>
                    </div>
                    <div class="entry-right">
                        <div class="entry-amount">₹${parseFloat(c.net_payable_amount).toFixed(2)}</div>
                        <div class="session-pill" style="display:inline-block; margin-top:2px;">${c.payment_status}</div>
                    </div>
                </div>
            `).join('');
        }
        return;
    }

    // Managers: Center / Sangh collections
    if (ledgerCycleBadge) ledgerCycleBadge.innerText = activeRole === 'MAIN_MANAGER' ? 'CONSOLIDATED SANGH MUSTER BILLING (1–10 OCT)' : 'CENTER 04 MUSTER (1–10 OCT)';
    if (ledgerTotalNet) ledgerTotalNet.innerText = '₹74,915';
    if (ledgerGross) ledgerGross.innerText = '₹78,415';
    if (ledgerDeductions) ledgerDeductions.innerText = '₹3,500';
    if (ledgerSectionTitle) ledgerSectionTitle.innerText = activeRole === 'MAIN_MANAGER' ? 'CONSOLIDATED MUSTER SETTLEMENTS' : 'CENTER 04 MUSTER REGISTER';

    let colls = SAMPLE_COLLECTIONS;
    try {
        const res = await fetch(`${API_BASE}/api/collections?limit=20`);
        const data = await res.json();
        if (data && data.success && data.collections && data.collections.length > 0) {
            colls = data.collections;
        }
    } catch (e) {
        // Uses fallback
    }

    if (list) {
        list.innerHTML = colls.map(c => `
            <div class="entry-card">
                <div class="entry-left">
                    <div class="farmer-avatar green">${c.session ? c.session[0] : 'M'}</div>
                    <div class="farmer-info-col">
                        <h4>${c.farmer_name}</h4>
                        <div class="farmer-meta-row">
                            <span>${c.collection_date}</span>
                            <span>•</span>
                            <span>${parseFloat(c.quantity_litres).toFixed(1)} L</span>
                            <span>•</span>
                            <span>Fat ${parseFloat(c.fat_percentage).toFixed(1)}% / SNF ${parseFloat(c.snf_percentage).toFixed(1)}%</span>
                        </div>
                    </div>
                </div>
                <div class="entry-right">
                    <div class="entry-amount">₹${parseFloat(c.net_payable_amount).toFixed(2)}</div>
                    <div class="session-pill" style="display:inline-block; margin-top:2px;">${c.payment_status}</div>
                </div>
            </div>
        `).join('');
    }
}

// ---------------------------------------------------------------------
// 7. TOAST NOTIFICATIONS
// ---------------------------------------------------------------------
function showToast(msg) {
    const toast = document.getElementById('appToast');
    const txt = document.getElementById('toastMsg');
    if (!toast || !txt) return;
    txt.innerText = msg;
    toast.classList.add('show');
    setTimeout(() => {
        hideToast();
    }, 3500);
}

function hideToast() {
    const toast = document.getElementById('appToast');
    if (toast) toast.classList.remove('show');
}
