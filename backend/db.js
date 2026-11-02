// =====================================================================
// SAHYADRI DAIRY SYSTEM - DATABASE CONNECTION POOL
// =====================================================================

require('dotenv').config();
const mysql = require('mysql2/promise');

let poolConfig = {
    multipleStatements: true,
    waitForConnections: true,
    connectionLimit: 15,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
};

if (process.env.DATABASE_URL) {
    poolConfig.uri = process.env.DATABASE_URL;
} else {
    poolConfig.host = process.env.DB_HOST || 'localhost';
    poolConfig.user = process.env.DB_USER || 'root';
    poolConfig.password = process.env.DB_PASSWORD || 'root123';
    poolConfig.database = process.env.DB_NAME || 'dairy_db';
    poolConfig.port = process.env.DB_PORT || 3306;
}

const pool = mysql.createPool(poolConfig);

module.exports = pool;
