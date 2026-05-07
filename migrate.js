require('dotenv').config();
const pool = require('./database');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS books (
        id         SERIAL PRIMARY KEY,
        titulo     TEXT NOT NULL,
        autor      TEXT NOT NULL,
        descricao  TEXT,
        capa       TEXT,
        preco      NUMERIC(10,2) NOT NULL,
        genero     TEXT,
        estoque    INTEGER NOT NULL DEFAULT 0,
        criado_em  TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS orders (
        id             SERIAL PRIMARY KEY,
        cliente_email  TEXT NOT NULL,
        cliente_nome   TEXT NOT NULL,
        total          NUMERIC(10,2) NOT NULL,
        status         TEXT NOT NULL DEFAULT 'pendente',
        criado_em      TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id               SERIAL PRIMARY KEY,
        order_id         INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        livro_id         INTEGER NOT NULL REFERENCES books(id),
        quantidade       INTEGER NOT NULL,
        preco_unitario   NUMERIC(10,2) NOT NULL
      );
    `);
    console.log('✅ Tabelas criadas com sucesso!');
  } catch (err) {
    console.error('❌ Erro na migração:', err.message);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate();