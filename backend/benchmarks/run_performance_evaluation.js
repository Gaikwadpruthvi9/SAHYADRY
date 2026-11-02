// =====================================================================
// DAIRY SYSTEM - DATABASE PERFORMANCE & INDEXING EVALUATION
// Compares Execution Plans, Response Time, Rows Examined, and Cost
// =====================================================================

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const DB_CONFIG = {
    host: 'localhost',
    user: 'root',
    password: process.env.DB_PASSWORD || 'root123',
    database: 'dairy_db',
    multipleStatements: true
};

const QUERIES = [
    {
        name: 'Query 1: Farmer-wise Collection History',
        description: 'Lookup collection history for a specific farmer over a 6-month interval',
        unindexedSql: `
            SELECT farmer_id, collection_date, session, quantity_litres, fat_percentage, snf_percentage, net_payable_amount
            FROM milk_collections IGNORE INDEX (idx_col_farmer_date, uq_farmer_session_date)
            WHERE farmer_id = 1 AND collection_date BETWEEN '2025-06-01' AND '2025-12-31'
            ORDER BY collection_date DESC;
        `,
        indexedSql: `
            SELECT farmer_id, collection_date, session, quantity_litres, fat_percentage, snf_percentage, net_payable_amount
            FROM milk_collections
            WHERE farmer_id = 1 AND collection_date BETWEEN '2025-06-01' AND '2025-12-31'
            ORDER BY collection_date DESC;
        `,
        indexUsed: 'idx_col_farmer_date (farmer_id, collection_date)'
    },
    {
        name: 'Query 2: Date & Session-wise Aggregation',
        description: 'Aggregate intake volume and weighted quality for morning collection across all centres',
        unindexedSql: `
            SELECT centre_id, COUNT(*) AS total_lots, SUM(quantity_litres) AS total_milk,
                   AVG(fat_percentage) AS avg_fat, AVG(snf_percentage) AS avg_snf, SUM(net_payable_amount) AS total_payout
            FROM milk_collections IGNORE INDEX (idx_col_date_session, uq_farmer_session_date)
            WHERE collection_date = '2025-08-15' AND session = 'MORNING'
            GROUP BY centre_id;
        `,
        indexedSql: `
            SELECT centre_id, COUNT(*) AS total_lots, SUM(quantity_litres) AS total_milk,
                   AVG(fat_percentage) AS avg_fat, AVG(snf_percentage) AS avg_snf, SUM(net_payable_amount) AS total_payout
            FROM milk_collections
            WHERE collection_date = '2025-08-15' AND session = 'MORNING'
            GROUP BY centre_id;
        `,
        indexUsed: 'idx_col_date_session (collection_date, session)'
    },
    {
        name: 'Query 3: Centre-wise Periodic Milk Intake',
        description: 'Aggregate milk throughput for a specific centre over a 90-day seasonal quarter',
        unindexedSql: `
            SELECT centre_id, DATE_FORMAT(collection_date, '%Y-%m') AS month,
                   COUNT(collection_id) AS total_records, SUM(quantity_litres) AS total_litres, SUM(gross_amount) AS gross_total
            FROM milk_collections IGNORE INDEX (idx_col_centre_date)
            WHERE centre_id = 1 AND collection_date BETWEEN '2025-07-01' AND '2025-09-30'
            GROUP BY centre_id, DATE_FORMAT(collection_date, '%Y-%m');
        `,
        indexedSql: `
            SELECT centre_id, DATE_FORMAT(collection_date, '%Y-%m') AS month,
                   COUNT(collection_id) AS total_records, SUM(quantity_litres) AS total_litres, SUM(gross_amount) AS gross_total
            FROM milk_collections
            WHERE centre_id = 1 AND collection_date BETWEEN '2025-07-01' AND '2025-09-30'
            GROUP BY centre_id, DATE_FORMAT(collection_date, '%Y-%m');
        `,
        indexUsed: 'idx_col_centre_date (centre_id, collection_date)'
    },
    {
        name: 'Query 4: High-Fat Quality Incentive Analysis',
        description: 'Filter high-grade milk lots meeting super-premium fat and SNF benchmarks',
        unindexedSql: `
            SELECT collection_id, farmer_id, milk_type_id, quantity_litres, fat_percentage, snf_percentage, incentive_amount
            FROM milk_collections IGNORE INDEX (idx_col_quality)
            WHERE milk_type_id = 1 AND fat_percentage >= 4.20 AND snf_percentage >= 8.80;
        `,
        indexedSql: `
            SELECT collection_id, farmer_id, milk_type_id, quantity_litres, fat_percentage, snf_percentage, incentive_amount
            FROM milk_collections
            WHERE milk_type_id = 1 AND fat_percentage >= 4.20 AND snf_percentage >= 8.80;
        `,
        indexUsed: 'idx_col_quality (milk_type_id, fat_percentage, snf_percentage)'
    },
    {
        name: 'Query 5: Unsettled Payment Ledger Scanning',
        description: 'Find pending unbilled collection records within billing cycle',
        unindexedSql: `
            SELECT farmer_id, COUNT(*) AS supplies, SUM(quantity_litres) AS total_milk, SUM(net_payable_amount) AS net_due
            FROM milk_collections IGNORE INDEX (idx_col_payment_status)
            WHERE payment_status = 'PENDING' AND collection_date BETWEEN '2026-10-16' AND '2026-10-31'
            GROUP BY farmer_id;
        `,
        indexedSql: `
            SELECT farmer_id, COUNT(*) AS supplies, SUM(quantity_litres) AS total_milk, SUM(net_payable_amount) AS net_due
            FROM milk_collections
            WHERE payment_status = 'PENDING' AND collection_date BETWEEN '2026-10-16' AND '2026-10-31'
            GROUP BY farmer_id;
        `,
        indexUsed: 'idx_col_payment_status (payment_status, collection_date)'
    }
];

function extractAnalyzeMetrics(explainAnalyzeText) {
    let actualTimeMs = 0.0;
    let actualRows = 0;

    // Pattern in MySQL 8 EXPLAIN ANALYZE: (actual time=0.035..1.240 rows=350 loops=1)
    const match = /actual time=[\d.]+\.\.([\d.]+)\s+rows=(\d+)/.exec(explainAnalyzeText);
    if (match) {
        actualTimeMs = parseFloat(match[1]);
        actualRows = parseInt(match[2], 10);
    }
    return { actualTimeMs, actualRows };
}

async function runEvaluation() {
    console.log('Connecting to dairy_db for Benchmark Evaluation...');
    const connection = await mysql.createConnection(DB_CONFIG);

    try {
        const [[{ count }]] = await connection.query('SELECT COUNT(*) AS count FROM milk_collections');
        console.log(`Evaluating against ${count.toLocaleString()} rows in milk_collections...\n`);

        const results = [];

        for (const q of QUERIES) {
            console.log(`Running: ${q.name}...`);

            // 1. UNINDEXED TEST
            // Measure execution time over 3 iterations for stability
            let unindexedTimes = [];
            for (let i = 0; i < 3; i++) {
                const t0 = process.hrtime.bigint();
                await connection.query(q.unindexedSql);
                const t1 = process.hrtime.bigint();
                unindexedTimes.push(Number(t1 - t0) / 1e6); // convert ns to ms
            }
            const avgUnindexedTime = unindexedTimes.reduce((a, b) => a + b) / 3;

            // Fetch EXPLAIN ANALYZE
            const [unindexedExplainAnalyze] = await connection.query(`EXPLAIN ANALYZE ${q.unindexedSql}`);
            const unindexedAnalyzeText = Object.values(unindexedExplainAnalyze[0])[0];
            const unindexedMetrics = extractAnalyzeMetrics(unindexedAnalyzeText);

            // Fetch EXPLAIN FORMAT=JSON for query cost & rows examined
            const [unindexedExplainJson] = await connection.query(`EXPLAIN FORMAT=JSON ${q.unindexedSql}`);
            const unindexedParsed = JSON.parse(unindexedExplainJson[0].EXPLAIN);
            const unindexedCost = unindexedParsed.query_block.cost_info ? parseFloat(unindexedParsed.query_block.cost_info.query_cost) : 0;
            const unindexedRowsExamined = unindexedParsed.query_block.table ? parseInt(unindexedParsed.query_block.table.rows_examined_per_scan || count, 10) : count;

            // 2. INDEXED TEST
            let indexedTimes = [];
            for (let i = 0; i < 3; i++) {
                const t0 = process.hrtime.bigint();
                await connection.query(q.indexedSql);
                const t1 = process.hrtime.bigint();
                indexedTimes.push(Number(t1 - t0) / 1e6);
            }
            const avgIndexedTime = indexedTimes.reduce((a, b) => a + b) / 3;

            const [indexedExplainAnalyze] = await connection.query(`EXPLAIN ANALYZE ${q.indexedSql}`);
            const indexedAnalyzeText = Object.values(indexedExplainAnalyze[0])[0];
            const indexedMetrics = extractAnalyzeMetrics(indexedAnalyzeText);

            const [indexedExplainJson] = await connection.query(`EXPLAIN FORMAT=JSON ${q.indexedSql}`);
            const indexedParsed = JSON.parse(indexedExplainJson[0].EXPLAIN);
            const indexedCost = indexedParsed.query_block.cost_info ? parseFloat(indexedParsed.query_block.cost_info.query_cost) : 0;
            const indexedRowsExamined = indexedParsed.query_block.table ? parseInt(indexedParsed.query_block.table.rows_examined_per_scan || indexedMetrics.actualRows, 10) : indexedMetrics.actualRows;

            const speedupPercent = avgUnindexedTime > 0 ? (((avgUnindexedTime - avgIndexedTime) / avgUnindexedTime) * 100).toFixed(1) : 0;
            const rowReductionFactor = (unindexedRowsExamined / Math.max(1, indexedRowsExamined)).toFixed(1);

            results.push({
                name: q.name,
                description: q.description,
                indexUsed: q.indexUsed,
                unindexedTimeMs: avgUnindexedTime.toFixed(2),
                indexedTimeMs: avgIndexedTime.toFixed(2),
                unindexedCost: unindexedCost.toFixed(2),
                indexedCost: indexedCost.toFixed(2),
                unindexedRows: unindexedRowsExamined,
                indexedRows: indexedRowsExamined,
                speedupPercent: `${speedupPercent}%`,
                rowReduction: `${rowReductionFactor}x`,
                unindexedPlan: unindexedAnalyzeText,
                indexedPlan: indexedAnalyzeText
            });
        }

        // Generate Markdown Benchmark Report
        let report = `# Database Performance & Indexing Evaluation Report\n\n`;
        report += `**Dataset Size**: ${count.toLocaleString()} rows in \`milk_collections\` table\n`;
        report += `**RDBMS**: MySQL Server 8.0 (InnoDB Storage Engine)\n`;
        report += `**Evaluation Date**: ${new Date().toISOString()}\n\n`;

        report += `## Summary Comparison Table\n\n`;
        report += `| Benchmark Query | Index Applied | Rows Examined (Before) | Rows Examined (After) | Cost (Before) | Cost (After) | Execution Time (Unindexed) | Execution Time (Indexed) | Speedup (%) |\n`;
        report += `|---|---|---|---|---|---|---|---|---|\n`;

        for (const r of results) {
            report += `| **${r.name}** | \`${r.indexUsed}\` | ${r.unindexedRows.toLocaleString()} | ${r.indexedRows.toLocaleString()} | ${r.unindexedCost} | ${r.indexedCost} | **${r.unindexedTimeMs} ms** | **${r.indexedTimeMs} ms** | **+${r.speedupPercent}** |\n`;
        }

        report += `\n## Detailed Query Execution Plans (EXPLAIN ANALYZE)\n\n`;
        for (const r of results) {
            report += `### ${r.name}\n`;
            report += `*${r.description}*\n\n`;
            report += `**Index Used**: \`${r.indexUsed}\` | **Row Reduction Factor**: ${r.rowReduction}\n\n`;
            report += `#### Unindexed Execution Plan (Full Table Scan):\n\`\`\`text\n${r.unindexedPlan.trim()}\n\`\`\`\n\n`;
            report += `#### Indexed Execution Plan (Index Lookup / Range Scan):\n\`\`\`text\n${r.indexedPlan.trim()}\n\`\`\`\n\n`;
            report += `---\n\n`;
        }

        const reportPath = path.join(__dirname, 'BENCHMARK_RESULTS.md');
        fs.writeFileSync(reportPath, report, 'utf8');
        console.log(`\nBenchmark Completed Successfully! Results written to: ${reportPath}`);

    } catch (err) {
        console.error('Error during benchmark run:', err);
    } finally {
        await connection.end();
    }
}

if (require.main === module) {
    runEvaluation();
}

module.exports = { runEvaluation };
