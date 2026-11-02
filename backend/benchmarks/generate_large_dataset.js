// =====================================================================
// DAIRY SYSTEM - HIGH-VOLUME REALISTIC DATASET GENERATOR
// Generates 50,000 - 100,000+ milk collection records for indexing benchmarks
// =====================================================================

const mysql = require('mysql2/promise');

const DB_CONFIG = {
    host: 'localhost',
    user: 'root',
    password: process.env.DB_PASSWORD || 'root123',
    database: 'dairy_db',
    multipleStatements: true
};

async function generateData(targetCount = 60000) {
    console.log(`Starting High-Volume Data Generation: Target ${targetCount} records...`);
    const connection = await mysql.createConnection(DB_CONFIG);

    try {
        // Fetch active farmers, centres, milk types, charts
        const [farmers] = await connection.query('SELECT farmer_id, assigned_centre_id FROM farmers WHERE status = "ACTIVE"');
        const [centres] = await connection.query('SELECT centre_id FROM collection_centres WHERE operating_status = "ACTIVE"');
        const [charts] = await connection.query('SELECT chart_id, milk_type_id, base_rate_per_litre FROM rate_chart_master WHERE is_active = TRUE');

        if (farmers.length === 0 || centres.length === 0) {
            console.error('Error: Seed farmers or centres not found. Please run seed script first.');
            return;
        }

        console.log(`Available Farmers: ${farmers.length}, Centres: ${centres.length}`);

        // Disable keys and autocommit for lightning speed
        await connection.query('SET autocommit = 0;');
        await connection.query('SET unique_checks = 0;');
        await connection.query('SET foreign_key_checks = 0;');

        const batchSize = 2500;
        let inserted = 0;
        const startDate = new Date(2025, 0, 1); // 2025-01-01
        const totalDays = 600; // ~20 months

        const sessions = ['MORNING', 'EVENING'];
        const milkTypes = [1, 2]; // 1: Cow, 2: Buffalo

        const startTime = Date.now();

        while (inserted < targetCount) {
            const values = [];
            const currentBatch = Math.min(batchSize, targetCount - inserted);

            for (let i = 0; i < currentBatch; i++) {
                const farmer = farmers[Math.floor(Math.random() * farmers.length)];
                const centreId = Math.random() < 0.95 ? farmer.assigned_centre_id : centres[Math.floor(Math.random() * centres.length)].centre_id;
                const isInterCentre = centreId !== farmer.assigned_centre_id ? 1 : 0;

                const dayOffset = Math.floor(Math.random() * totalDays);
                const colDate = new Date(startDate.getTime() + dayOffset * 86400000);
                const dateStr = colDate.toISOString().split('T')[0];
                const session = sessions[Math.floor(Math.random() * sessions.length)];

                const milkTypeId = Math.random() < 0.65 ? 1 : 2; // 65% cow, 35% buffalo
                let fat, snf, rate, baseRate;

                if (milkTypeId === 1) {
                    // Cow: Fat 3.2 - 4.6, SNF 8.2 - 9.1
                    fat = parseFloat((3.2 + Math.random() * 1.4).toFixed(2));
                    snf = parseFloat((8.2 + Math.random() * 0.9).toFixed(2));
                    baseRate = 37.50;
                    rate = parseFloat((baseRate + (fat - 3.5) * 3.0 + (snf - 8.5) * 2.0).toFixed(2));
                } else {
                    // Buffalo: Fat 5.8 - 9.0, SNF 8.7 - 10.0
                    fat = parseFloat((5.8 + Math.random() * 3.2).toFixed(2));
                    snf = parseFloat((8.7 + Math.random() * 1.3).toFixed(2));
                    baseRate = 56.00;
                    rate = parseFloat((baseRate + (fat - 6.5) * 4.5 + (snf - 9.0) * 2.5).toFixed(2));
                }

                if (rate < 15.0) rate = 15.0;

                const qty = parseFloat((5.0 + Math.random() * 25.0).toFixed(2)); // 5 to 30 litres
                const gross = parseFloat((qty * rate).toFixed(2));
                const incentive = (fat > (milkTypeId === 1 ? 4.2 : 7.2)) ? parseFloat((qty * 1.5).toFixed(2)) : 0.00;
                const net = parseFloat((gross + incentive).toFixed(2));
                const clr = parseFloat((26.0 + Math.random() * 6.0).toFixed(1));
                const temp = parseFloat((24.0 + Math.random() * 6.0).toFixed(1));

                values.push([
                    farmer.farmer_id,
                    centreId,
                    dateStr,
                    session,
                    `${dateStr} ${session === 'MORNING' ? '06:30:00' : '18:30:00'}`,
                    milkTypeId,
                    qty,
                    fat,
                    snf,
                    clr,
                    temp,
                    'ACCEPTED',
                    milkTypeId === 1 ? 2 : 3,
                    rate,
                    gross,
                    incentive,
                    0.00,
                    net,
                    'PROCESSED',
                    3,
                    isInterCentre
                ]);
            }

            const sql = `
                INSERT IGNORE INTO milk_collections (
                    farmer_id, centre_id, collection_date, session, collection_timestamp,
                    milk_type_id, quantity_litres, fat_percentage, snf_percentage,
                    clr_reading, temperature_celsius, quality_status, rate_chart_id,
                    rate_per_litre, gross_amount, incentive_amount, deduction_amount,
                    net_payable_amount, payment_status, collected_by_user_id, is_inter_centre_collection
                ) VALUES ?
            `;

            await connection.query(sql, [values]);
            await connection.query('COMMIT;');

            inserted += currentBatch;
            process.stdout.write(`\rInserted ${inserted} / ${targetCount} collection records...`);
        }

        await connection.query('SET unique_checks = 1;');
        await connection.query('SET foreign_key_checks = 1;');
        await connection.query('SET autocommit = 1;');

        const totalSec = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\nSuccess! High-volume population completed in ${totalSec}s.`);

        const [[{ count }]] = await connection.query('SELECT COUNT(*) AS count FROM milk_collections');
        console.log(`Total milk_collections rows in database: ${count}`);

    } catch (err) {
        console.error('Error generating high-volume dataset:', err);
    } finally {
        await connection.end();
    }
}

if (require.main === module) {
    const target = parseInt(process.argv[2], 10) || 50000;
    generateData(target);
}

module.exports = { generateData };
