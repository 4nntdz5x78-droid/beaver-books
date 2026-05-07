const express = require('express');
const router  = express.Router();
const pool    = require('./database');

// ── GET /books  → lista livros com filtros ─────────────────────────────────
router.get('/', async (req, res) => {
  const { genero, preco_min, preco_max, busca, order_by, page = 1, limite = 12 } = req.query;

  const params = [];
  let where = 'WHERE estoque > 0';

  if (genero) {
    params.push(genero);
    where += ` AND genero = $${params.length}`;
  }
  if (preco_min) {
    params.push(parseFloat(preco_min));
    where += ` AND preco >= $${params.length}`;
  }
  if (preco_max) {
    params.push(parseFloat(preco_max));
    where += ` AND preco <= $${params.length}`;
  }
  if (busca) {
    params.push(`%${busca}%`);
    where += ` AND (titulo ILIKE $${params.length} OR autor ILIKE $${params.length})`;
  }

  const orderMap = {
    preco_asc:  'preco ASC',
    preco_desc: 'preco DESC',
    titulo:     'titulo ASC',
    recentes:   'criado_em DESC',
  };
  const orderClause = orderMap[order_by] || 'criado_em DESC';

  const pageNum   = Math.max(1, parseInt(page));
  const limitNum  = Math.min(48, Math.max(1, parseInt(limite)));
  const offset    = (pageNum - 1) * limitNum;

  const countParams = [...params];
  params.push(limitNum, offset);

  try {
    const [rows, count] = await Promise.all([
      pool.query(
        `SELECT * FROM books ${where} ORDER BY ${orderClause} LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      ),
      pool.query(`SELECT COUNT(*) FROM books ${where}`, countParams),
    ]);

    res.json({
      livros: rows.rows,
      total:  parseInt(count.rows[0].count),
      pagina: pageNum,
      paginas: Math.ceil(parseInt(count.rows[0].count) / limitNum),
    });
  } catch (err) {
    console.error('Erro ao buscar livros:', err.message);
    res.status(500).json({ erro: 'Erro ao buscar livros.' });
  }
});

// ── GET /books/generos  → lista gêneros disponíveis ────────────────────────
router.get('/generos', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT genero FROM books WHERE genero IS NOT NULL AND estoque > 0 ORDER BY genero`
    );
    res.json(result.rows.map(r => r.genero));
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar gêneros.' });
  }
});

// ── GET /books/:id  → detalhe de um livro ─────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM books WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ erro: 'Livro não encontrado.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar livro.' });
  }
});

module.exports = router;