const express = require('express');
const router  = express.Router();
const pool    = require('./database');

// POST /orders — cria pedido
router.post('/', async (req, res) => {
  const { cliente_nome, cliente_email, itens } = req.body;

  if (!cliente_nome || !cliente_email || !itens || !itens.length) {
    return res.status(400).json({ ok: false, erro: 'Dados incompletos.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let subtotal = 0;
    const itensDetalhes = [];

    for (const item of itens) {
      const { rows } = await client.query(
        'SELECT preco, estoque, titulo FROM books WHERE id = $1',
        [item.livro_id]
      );
      if (!rows.length) throw new Error(`Livro ${item.livro_id} não encontrado.`);
      if (rows[0].estoque < item.quantidade) throw new Error(`Estoque insuficiente para "${rows[0].titulo}".`);

      const preco = parseFloat(rows[0].preco);
      const quantidade = parseInt(item.quantidade);
      const itemSubtotal = preco * quantidade;
      subtotal += itemSubtotal;

      itensDetalhes.push({
        livro_id: item.livro_id,
        quantidade,
        preco,
        itemSubtotal,
      });
    }

    const taxa_entrega = subtotal >= 150 ? 0 : 15;
    const desconto     = 0;
    const total        = subtotal + taxa_entrega - desconto;
    const numero_pedido = `BB-${Date.now()}`;

    const pedido = await client.query(
      `INSERT INTO orders
        (numero_pedido, cliente_nome, cliente_email, subtotal, taxa_entrega, desconto, total, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pendente')
       RETURNING id`,
      [numero_pedido, cliente_nome, cliente_email, subtotal, taxa_entrega, desconto, total]
    );
    const pedidoId = pedido.rows[0].id;

    for (const item of itensDetalhes) {
      await client.query(
        `INSERT INTO order_items (order_id, book_id, quantidade, preco_unitario, subtotal)
         VALUES ($1,$2,$3,$4,$5)`,
        [pedidoId, item.livro_id, item.quantidade, item.preco, item.itemSubtotal]
      );
      await client.query(
        'UPDATE books SET estoque = estoque - $1 WHERE id = $2',
        [item.quantidade, item.livro_id]
      );
    }

    await client.query('COMMIT');
    res.json({ ok: true, pedido_id: pedidoId, numero_pedido, total });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao criar pedido:', err.message);
    res.status(400).json({ ok: false, erro: err.message });
  } finally {
    client.release();
  }
});

// GET /orders/:id
router.get('/:id', async (req, res) => {
  try {
    const pedido = await pool.query('SELECT * FROM orders WHERE id=$1', [req.params.id]);
    if (!pedido.rows.length) return res.status(404).json({ erro: 'Pedido não encontrado.' });
    const itens = await pool.query(
      `SELECT oi.*, b.titulo, b.autor FROM order_items oi
       JOIN books b ON b.id = oi.book_id WHERE oi.order_id=$1`,
      [req.params.id]
    );
    res.json({ ...pedido.rows[0], itens: itens.rows });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar pedido.' });
  }
});

module.exports = router;
