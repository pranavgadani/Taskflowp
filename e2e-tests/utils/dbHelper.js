const mysql = require('mysql2/promise');
require('dotenv').config();

function getDbConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'taskflow_db',
  });
}

/**
 * Query helper for MySQL verification
 */
async function queryMySQL(sql, params = []) {
  let conn;
  try {
    conn = await getDbConnection();
    const [rows] = await conn.execute(sql, params);
    return rows;
  } finally {
    if (conn) await conn.end();
  }
}

/**
 * Generate random test string suffix
 */
function randomString(prefix = 'test') {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

module.exports = {
  getDbConnection,
  queryMySQL,
  randomString,
};
