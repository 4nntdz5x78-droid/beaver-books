const express = require('express');
const router  = express.Router();
const pool    = require('./database');

// ── POST /orders  → registra novo pedido ──────────────────────────────────
router.post('/', async (req, res) => {
  const { cliente_email, cliente_nome, itens } = req.body;

  if (!cliente_email || !cliente_nome || !Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ ok: false, erro: 'Dados incompletos. Informe nome, e-mail e itens do pedido.' });
  }

  for (const item of itens) {
    if (!item.livro_id || !item.quantidade || item.quantidade < 1) {
      return res.status(400).json({ ok: false, erro: 'Cada item deve ter livro_id e quantidade válidos.' });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let total = 0;
    const livrosVerificados = [];

    for (const item of itens) {
      const result = await client.query(
        'SELECT id, titulo, preco, estoque FROM books WHERE id = $1 FOR UPDATE',
        [item.livro_id]
      );
      if (result.rows.length === 0) {
        throw new Error(`Livro ID ${item.livro_id} não encontrado.`);
      }
      const livro = result.rows[0];
      if (livro.estoque < item.quantidade) {
        throw new Error(`Estoque insuficiente para "${livro.titulo}". Disponível: ${livro.estoque}.`);
      }
      total += parseFloat(livro.preco) * item.quantidade;
      livrosVerificados.push({ ...livro, quantidade: item.quantidade });
    }

    const orderResult = await client.query(
      'INSERT INTO orders (cliente_email, cliente_nome, total, status) VALUES ($1, $2, $3, $4) RETURNING id',
      [cliente_email, cliente_nome, total.toFixed(2), 'pendente']
    );
    const orderId = orderResult.rows[0].id;

    for (const livro of livrosVerificados) {
      await client.query(
        'INSERT INTO order_items (order_id, livro_id, quantidade, preco_unitario) VALUES ($1, $2, $3, $4)',
        [orderId, livro.id, livro.quantidade, livro.preco]
      );
      await client.query(
        'UPDATE books SET estoque = estoque - $1 WHERE id = $2',
        [livro.quantidade, livro.id]
      );
    }

    await client.query('COMMIT');
    res.json({ ok: true, pedido_id: orderId, total: parseFloat(total.toFixed(2)) });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao criar pedido:', err.message);
    res.status(400).json({ ok: false, erro: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;