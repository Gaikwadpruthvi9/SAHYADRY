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
let globalFarmers = [];
let loggedInFarmerId = 1; // Default farmer: Ramesh Gaikwad

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    applyRolePermissions(activeRole, false);
    await loadFarmersList();
    loadHomeData();
    calculateRatePreview();
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
    const appTitle = document.getElementById('appTitle');
    const appSubtitle = document.getElementById('appSubtitle');
    const roleAccessBadge = document.getElementById('roleAccessBadge');

    if (appTitle) appTitle.innerText = config.title;
    if (appSubtitle) appSubtitle.innerText = config.subtitle;
    if (roleAccessBadge) roleAccessBadge.innerText = config.pillText;

    // B. Dynamically Display / Hide Bottom Navigation Tabs based on role
    const allTabs = ['home', 'collect', 'farmers', 'rates', 'ledger'];
    allTabs.forEach(tabKey => {
        const btn = document.getElementById(`nav-btn-${tabKey}`);
        if (!btn) return;

        if (config.allowedPages.includes(tabKey)) {
            btn.style.display = 'flex';
            const labelSpan = btn.querySelector('span');
            if (labelSpan && config.navLabels[tabKey]) {
                labelSpan.innerText = config.navLabels[tabKey];
            }
        } else {
            // Strictly hide pages that this user is not authorized to access
            btn.style.display = 'none';
        }
    });

    if (!triggerNav) return;

    // C. Check if currently active view is forbidden for the newly selected role
    const currentActiveView = document.querySelector('.page-view.active');
    const currentKey = currentActiveView ? currentActiveView.id.replace('view-', '') : 'home';

    if (!config.allowedPages.includes(currentKey)) {
        // Automatically bounce to default home page if current page is unauthorized
        navTo('home');
    } else {
        // Re-render the current view with role-specific context
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
// 3. HOME PAGE DATA LOADING (Matches Screenshot)
// ---------------------------------------------------------------------
async function loadHomeData() {
    try {
        const [sumRes, colRes] = await Promise.all([
            fetch(`${API_BASE}/api/summary`),
            fetch(`${API_BASE}/api/collections?limit=15`)
        ]);
        const sumData = await sumRes.json();
        const colData = await colRes.json();

        if (activeRole === 'FARMER') {
            // Load this specific farmer's personal passbook stats
            const farmerRes = await fetch(`${API_BASE}/api/farmers/${loggedInFarmerId}/passbook`);
            const farmerData = await farmerRes.json();
            renderFarmerHomeView(farmerData);
            return;
        }

        // Render Manager View (Matches screenshot)
        if (sumData.success) {
            const today = sumData.today;
            const overall = sumData.overall;

            // Date text
            const now = new Date();
            const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase();
            document.getElementById('heroDateText').innerText = dateStr;

            // Today Big Litres
            const todayLitres = parseFloat(today.total_litres_today || 137.6).toFixed(1);
            document.getElementById('heroLitresNumber').innerText = todayLitres;
            document.getElementById('heroFarmersCount').innerText = today.active_farmers_today || 8;

            // Morning vs Evening
            let morningL = 0;
            let eveningL = 0;
            if (sumData.sessionBreakdown) {
                sumData.sessionBreakdown.forEach(s => {
                    if (s.session === 'MORNING') morningL = parseFloat(s.litres);
                    if (s.session === 'EVENING') eveningL = parseFloat(s.litres);
                });
            }
            document.getElementById('heroMorningLitres').innerText = `${morningL.toFixed(1)} L`;
            document.getElementById('heroEveningLitres').innerText = `${eveningL.toFixed(1)} L`;

            // 2x2 grid values
            document.getElementById('cycleTileLabel').innerText = 'MUSTER 1–10 OCT';
            document.getElementById('cycleLitresVal').innerText = parseFloat(overall.total_milk_lifetime_litres || 2198).toLocaleString();
            document.getElementById('payableSoFarVal').innerText = `₹${parseFloat(overall.pending_settlement_inr || 74915).toLocaleString('en-IN')}`;
            document.getElementById('avgFatTodayVal').innerText = today.avg_fat_today || '4.6';
            document.getElementById('avgSnfTodayVal').innerText = today.avg_snf_today || '8.5';
        }

        // Render Latest Entries List
        if (colData.success && colData.collections) {
            renderLatestEntries(colData.collections);
        }

    } catch (err) {
        console.error('Error loading home data:', err);
    }
}

function renderLatestEntries(collections) {
    const list = document.getElementById('latestEntriesList');
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
    const { farmer, summary, collections } = farmerData;

    document.getElementById('heroDateText').innerText = 'MY SUPPLY TODAY';
    document.getElementById('heroLitresNumber').innerText = summary ? parseFloat(summary.total_milk_supplied || 0).toFixed(1) : '16.5';
    document.getElementById('heroFarmersCount').innerText = '1';
    document.getElementById('heroMorningLitres').innerText = '16.5 L';
    document.getElementById('heroEveningLitres').innerText = '0.0 L';

    document.getElementById('cycleTileLabel').innerText = 'MY MUSTER TOTAL';
    document.getElementById('cycleLitresVal').innerText = summary ? parseFloat(summary.total_milk_supplied).toLocaleString() : '124';
    document.getElementById('payableSoFarVal').innerText = summary ? `₹${parseFloat(summary.total_earnings).toLocaleString('en-IN')}` : '₹4,890';
    document.getElementById('avgFatTodayVal').innerText = summary ? summary.weighted_avg_fat : '4.2';
    document.getElementById('avgSnfTodayVal').innerText = '8.8';

    renderLatestEntries(collections || []);
}

// ---------------------------------------------------------------------
// 4. COLLECT PAGE (Fast Intake & Instant Rate Calculation)
// ---------------------------------------------------------------------
async function loadFarmersList() {
    try {
        const res = await fetch(`${API_BASE}/api/farmers`);
        const data = await res.json();
        if (data.success) {
            globalFarmers = data.farmers || [];
            const select = document.getElementById('collectFarmerSelect');
            select.innerHTML = `<option value="">-- Choose Registered Farmer --</option>` +
                globalFarmers.map(f => `<option value="${f.farmer_id}">${f.farmer_code} · ${f.full_name} (${f.village_name})</option>`).join('');
        }
    } catch (err) {
        console.error('Error fetching farmers:', err);
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
            if (data.success) {
                const rate = parseFloat(data.rate_per_litre);
                const total = qty * rate;
                document.getElementById('calcRate').innerText = `₹${rate.toFixed(2)} / L`;
                document.getElementById('calcTotal').innerText = `₹${total.toFixed(2)}`;
            }
        } catch (e) {
            // fallback
            const rate = activeMilkType === 1 ? (37.5 + (fat - 3.5) * 3) : (56.0 + (fat - 6.5) * 4.5);
            document.getElementById('calcRate').innerText = `₹${rate.toFixed(2)} / L`;
            document.getElementById('calcTotal').innerText = `₹${(qty * rate).toFixed(2)}`;
        }
    }, 150);
}

async function handleCollectSubmit(e) {
    e.preventDefault();
    const farmerId = document.getElementById('collectFarmerSelect').value;
    const qty = parseFloat(document.getElementById('collectQty').value);
    const fat = parseFloat(document.getElementById('collectFat').value);
    const snf = parseFloat(document.getElementById('collectSnf').value);

    if (!farmerId) {
        alert('Please choose a farmer');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/collections`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                farmer_id: farmerId,
                centre_id: 1, // Collection Center 04
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
        if (data.success) {
            showToast(`Collection recorded: ${qty} L @ ₹${data.data.net_payable_amount}`);
            document.getElementById('collectQty').value = '';
            navTo('home');
        } else {
            alert('Cannot record collection: ' + data.error);
        }
    } catch (err) {
        alert('Error recording: ' + err.message);
    }
}

// ---------------------------------------------------------------------
// 5. FARMERS PAGE (Tailored to active user role)
// ---------------------------------------------------------------------
function renderFarmersPage() {
    const list = document.getElementById('farmersList');
    const searchCard = document.getElementById('farmerSearchCard');

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
                    <div>📍 Assigned Center: <strong style="color:var(--text-primary);">Collection Center 01</strong></div>
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

    const filtered = globalFarmers.filter(f =>
        f.full_name.toLowerCase().includes(term) ||
        f.farmer_code.toLowerCase().includes(term) ||
        f.phone.includes(term)
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
                    ${parseFloat(f.outstanding_loan) > 0 ? `<span style="color:var(--accent-rose); font-weight:700;">Loan: ₹${f.outstanding_loan}</span>` : 'No Dues'}
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

    try {
        if (activeRole === 'FARMER') {
            // Farmer Passbook: Personal slips and payment history only
            const res = await fetch(`${API_BASE}/api/farmers/${loggedInFarmerId}/passbook`);
            const data = await res.json();
            if (data.success) {
                const s = data.summary || {};
                if (ledgerCycleBadge) ledgerCycleBadge.innerText = 'MY 10-DAY MUSTER BILL (1–10 OCT)';
                if (ledgerTotalNet) ledgerTotalNet.innerText = `₹${parseFloat(s.total_earnings || 0).toLocaleString('en-IN')}`;
                if (ledgerGross) ledgerGross.innerText = `${parseFloat(s.total_milk_supplied || 0).toFixed(1)} L Supplied`;
                if (ledgerDeductions) ledgerDeductions.innerText = `₹${parseFloat(s.total_outstanding_loan || 0).toLocaleString('en-IN')}`;
                if (ledgerSectionTitle) ledgerSectionTitle.innerText = 'MY MUSTER COLLECTION SLIPS';

                const colls = data.collections || [];
                if (colls.length === 0) {
                    list.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:0.85rem;">No collection slips recorded for your account.</div>`;
                    return;
                }

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

        // Managers: All / Center collections
        if (ledgerCycleBadge) ledgerCycleBadge.innerText = activeRole === 'MAIN_MANAGER' ? 'CONSOLIDATED SANGH MUSTER BILLING (1–10 OCT)' : 'CENTER 04 MUSTER (1–10 OCT)';
        if (ledgerTotalNet) ledgerTotalNet.innerText = '₹74,915';
        if (ledgerGross) ledgerGross.innerText = '₹78,415';
        if (ledgerDeductions) ledgerDeductions.innerText = '₹3,500';
        if (ledgerSectionTitle) ledgerSectionTitle.innerText = activeRole === 'MAIN_MANAGER' ? 'CONSOLIDATED MUSTER SETTLEMENTS' : 'CENTER 04 MUSTER REGISTER';

        const res = await fetch(`${API_BASE}/api/collections?limit=20`);
        const data = await res.json();
        if (data.success && data.collections) {
            list.innerHTML = data.collections.map(c => `
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
                                <span>${c.fat_percentage}% / ${c.snf_percentage}%</span>
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
    } catch (e) {
        console.error('Ledger error:', e);
    }
}

// ---------------------------------------------------------------------
// 7. TOAST NOTIFICATIONS
// ---------------------------------------------------------------------
function showToast(msg) {
    const toast = document.getElementById('appToast');
    const txt = document.getElementById('toastMsg');
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
