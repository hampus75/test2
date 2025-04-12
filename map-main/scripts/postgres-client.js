const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL connection configuration
const pgConfig = {
  connectionString: process.env.POSTGRES_URL || 'postgresql://mapuser:mappassword@localhost:5432/mapdb',
  ssl: process.env.POSTGRES_SSL === 'true' ? {
    rejectUnauthorized: false
  } : undefined
};

// Create a connection pool
const pool = new Pool(pgConfig);

// Test the connection
async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('Connected to PostgreSQL database successfully!');
    
    const res = await client.query('SELECT NOW() as time');
    console.log('Current database time:', res.rows[0].time);
    
    client.release();
    return true;
  } catch (err) {
    console.error('Error connecting to PostgreSQL database:', err.message);
    return false;
  }
}

// Export the pool and helper functions
module.exports = {
  pool,
  testConnection,
  query: (text, params) => pool.query(text, params)
};
