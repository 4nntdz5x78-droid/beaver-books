const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10
});

pool.connect()
  .then(client => {
    console.log('✅ Banco de dados conectado!');
    client.release();
  })
  .catch(err => console.error('❌ Erro ao conectar ao banco:', err.message));

module.exports = pool;