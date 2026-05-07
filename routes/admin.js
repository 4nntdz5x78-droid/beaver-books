const express = require('express');
const router  = express.Router();
const pool    = require('../database');
const path    = require('path');

// ── Middleware de autenticação ──────────────────────────────────────────────
function auth(req, res, next) {
  const senha = req.headers['x-admin-senha'];
  if (!senha || senha !== process.env.ADMIN_SENHA) {
    return res.status(401).json({ erro: 'Não autorizado.' });
  }
  next();
}

// ── GET /admin  → serve o painel HTML ──────────────────────────────────────
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// ── GET /admin/leads  → lista leads com filtros ────────────────────────────
router.get('/leads', auth, async (req, res) => {
  const { status, objetivo, busca } = req.query;
  const params = [];
  let where = 'WHERE 1=1';

  if (status)  { params.push(status);  where += ` AND status = $${params.length}`; }
  if (objetivo){ params.push(objetivo); where += ` AND objetivo = $${params.length}`; }
  if (busca)   {
    params.push(`%${busca}%`);
    where += ` AND (nome ILIKE $${params.length} OR email ILIKE $${params.length} OR whatsapp ILIKE $${params.length})`;
  }

  try {
    const result = await pool.query(
      `SELECT * FROM leads ${where} ORDER BY criado_em DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar leads.' });
  }
});

// ── GET /admin/leads/:id  → detalhe de um lead ─────────────────────────────
router.get('/leads/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM leads WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ erro: 'Lead não encontrado.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar lead.' });
  }
});

// ── PATCH /admin/leads/:id  → atualiza status ──────────────────────────────
router.patch('/leads/:id', auth, async (req, res) => {
  const { status, anotacao } = req.body;
  try {
    await pool.query(
      'UPDATE leads SET status = COALESCE($1, status), anotacao = COALESCE($2, anotacao) WHERE id = $3',
      [status || null, anotacao || null, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar lead.' });
  }
});

// ── DELETE /admin/leads/:id  → remove lead ─────────────────────────────────
router.delete('/leads/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM leads WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao deletar lead.' });
  }
});

// ── GET /admin/stats  → números do dashboard ───────────────────────────────
router.get('/stats', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'novo')         AS novos,
        COUNT(*) FILTER (WHERE status = 'em_contato')   AS em_contato,
        COUNT(*) FILTER (WHERE status = 'publicando')   AS publicando,
        COUNT(*) FILTER (WHERE status = 'encerrado')    AS encerrados,
        COUNT(*)                                         AS total,
        COUNT(*) FILTER (WHERE criado_em >= NOW() - INTERVAL '7 days') AS ultimos_7_dias
      FROM leads
    `);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar estatísticas.' });
  }
});

// ── GET /admin/books  → lista todos os livros ──────────────────────────────
router.get('/books', auth, async (req, res) => {
  const { genero, busca } = req.query;
  const params = [];
  let where = 'WHERE 1=1';

  if (genero) { params.push(genero);        where += ` AND genero = $${params.length}`; }
  if (busca)  { params.push(`%${busca}%`);  where += ` AND (titulo ILIKE $${params.length} OR autor ILIKE $${params.length})`; }

  try {
    const result = await pool.query(
      `SELECT * FROM books ${where} ORDER BY criado_em DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar livros.' });
  }
});

// ── POST /admin/books  → cria livro ───────────────────────────────────────
router.post('/books', auth, async (req, res) => {
  const { titulo, autor, descricao, capa, preco, genero, estoque } = req.body;
  if (!titulo || !autor || preco == null) {
    return res.status(400).json({ erro: 'Título, autor e preço são obrigatórios.' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO books (titulo, autor, descricao, capa, preco, genero, estoque) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [titulo, autor, descricao || null, capa || null, parseFloat(preco), genero || null, parseInt(estoque) || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar livro.' });
  }
});

// ── PUT /admin/books/:id  → atualiza livro ────────────────────────────────
router.put('/books/:id', auth, async (req, res) => {
  const { titulo, autor, descricao, capa, preco, genero, estoque } = req.body;
  try {
    const result = await pool.query(
      `UPDATE books SET
        titulo    = COALESCE($1, titulo),
        autor     = COALESCE($2, autor),
        descricao = COALESCE($3, descricao),
        capa      = COALESCE($4, capa),
        preco     = COALESCE($5, preco),
        genero    = COALESCE($6, genero),
        estoque   = COALESCE($7, estoque)
       WHERE id = $8 RETURNING *`,
      [titulo || null, autor || null, descricao || null, capa || null,
       preco != null ? parseFloat(preco) : null,
       genero || null,
       estoque != null ? parseInt(estoque) : null,
       req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ erro: 'Livro não encontrado.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar livro.' });
  }
});

// ── DELETE /admin/books/:id  → remove livro ───────────────────────────────
router.delete('/books/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM books WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao deletar livro.' });
  }
});

// ── GET /admin/orders  → lista pedidos ────────────────────────────────────
router.get('/orders', auth, async (req, res) => {
  const { status, busca } = req.query;
  const params = [];
  let where = 'WHERE 1=1';

  if (status) { params.push(status);        where += ` AND o.status = $${params.length}`; }
  if (busca)  { params.push(`%${busca}%`);  where += ` AND (o.cliente_nome ILIKE $${params.length} OR o.cliente_email ILIKE $${params.length})`; }

  try {
    const result = await pool.query(
      `SELECT o.*, json_agg(json_build_object(
         'livro_id', oi.livro_id, 'titulo', b.titulo,
         'quantidade', oi.quantidade, 'preco_unitario', oi.preco_unitario
       )) AS itens
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN books b ON b.id = oi.livro_id
       ${where}
       GROUP BY o.id
       ORDER BY o.criado_em DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar pedidos.' });
  }
});

// ── PATCH /admin/orders/:id  → atualiza status do pedido ──────────────────
router.patch('/orders/:id', auth, async (req, res) => {
  const { status } = req.body;
  const allowed = ['pendente', 'confirmado', 'enviado', 'entregue', 'cancelado'];
  if (!status || !allowed.includes(status)) {
    return res.status(400).json({ erro: `Status inválido. Use: ${allowed.join(', ')}.` });
  }
  try {
    await pool.query('UPDATE orders SET status = $1 WHERE id = $2', [status, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar pedido.' });
  }
});

module.exports = router;
