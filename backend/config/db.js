const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               parseInt(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER     || 'ptms_user',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'ptms_db',
  waitForConnections: true,
  connectionLimit:    20,
  queueLimit:         0,
  timezone:           '+00:00',
  decimalNumbers:     true,
  charset:            'utf8mb4'
});

// Test connection on startup
pool.getConnection()
  .then(conn => { console.log('✓ MySQL connected'); conn.release(); })
  .catch(err  => { console.error('✗ MySQL error:', err.message); process.exit(1); });

module.exports = pool;
