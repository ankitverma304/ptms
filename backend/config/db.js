const mysql = require('mysql2/promise');

// Support both custom DB_* vars and Railway's native MYSQL* vars
const host     = process.env.DB_HOST     || process.env.MYSQLHOST     || 'localhost';
const port     = parseInt(process.env.DB_PORT     || process.env.MYSQLPORT)     || 3306;
const user     = process.env.DB_USER     || process.env.MYSQLUSER     || 'ptms_user';
const password = process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '';
const database = process.env.DB_NAME     || process.env.MYSQLDATABASE || 'ptms_db';

// Railway public proxy requires SSL; internal private host does not
const isPublicHost = host && !host.endsWith('.railway.internal');
const ssl = (process.env.DB_SSL === 'true' || (process.env.NODE_ENV === 'production' && isPublicHost))
  ? { rejectUnauthorized: false }
  : undefined;

const pool = mysql.createPool({
  host, port, user, password, database,
  waitForConnections: true,
  connectionLimit:    20,
  queueLimit:         0,
  timezone:           '+00:00',
  decimalNumbers:     true,
  charset:            'utf8mb4',
  ...(ssl && { ssl }),
});

// Test connection on startup
pool.getConnection()
  .then(conn => { console.log('✓ MySQL connected'); conn.release(); })
  .catch(err  => { console.error('✗ MySQL error:', err.code || err.message || err); process.exit(1); });

module.exports = pool;
