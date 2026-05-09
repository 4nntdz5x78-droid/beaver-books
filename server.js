const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config();

const pool = require('./database');

async function runMigrations() {
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
      CREATE TABLE IF NOT EXISTS leads (
        id         SERIAL PRIMARY KEY,
        nome       TEXT NOT NULL,
        email      TEXT NOT NULL,
        whatsapp   TEXT,
        cidade     TEXT,
        objetivo   TEXT,
        genero     TEXT,
        finalizado TEXT,
        paginas    INTEGER,
        obj_livro  TEXT,
        prazo      TEXT,
        mensagem   TEXT,
        arquivo    TEXT,
        status     TEXT NOT NULL DEFAULT 'novo',
        anotacao   TEXT,
        criado_em  TIMESTAMP DEFAULT NOW()
      );
    `);
    // Adiciona colunas novas em tabelas existentes (idempotente)
    await client.query(`
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS status   TEXT NOT NULL DEFAULT 'novo';
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS anotacao TEXT;
    `);
    console.log('✅ Migrations executadas com sucesso!');
  } catch (err) {
    console.error('❌ Erro nas migrations:', err.message);
  } finally {
    client.release();
  }
}

const app = express();

const FRONTEND = path.join(__dirname, 'frontend');

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(FRONTEND));

app.use('/leads',    require('./routes/leads'));
app.use('/admin',    require('./routes/admin'));
app.use('/books',    require('./books'));
app.use('/orders',   require('./orders'));
app.use('/payments', require('./payments'));

app.get('/contato-beaver-books', (req, res) => 
  res.sendFile(path.join(FRONTEND, 'contato-beaver-books.html')));

app.get('/catalogo-livro-beaver-books/catalogo.html', (req, res) => 
  res.sendFile(path.join(FRONTEND, 'catalogo.html')));

app.get('/catalogo.html', (req, res) => 
  res.sendFile(path.join(FRONTEND, 'catalogo.html')));

app.get('/livro/:id', (req, res) => 
  res.sendFile(path.join(FRONTEND, 'livro.html')));

app.get('*', (req, res) => 
  res.sendFile(path.join(FRONTEND, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log('Servidor rodando na porta ' + PORT);
  await runMigrations();
});
