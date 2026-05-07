const express = require('express');
const router  = express.Router();
const pool    = require('./database');

const MP_TOKEN = process.env.MP_ACCESS_TOKEN;
const MP_URL   = 'https://api.mercadopago.com';

// ── POST /payments/pix  — gera QR Code PIX ──────────────────────────
router.post('/pix', async (req, res) => {
  const { order_id, cliente_nome, cliente_email } = req.body;

  if (!order_id || !cliente_nome || !cliente_email) {
    return res.status(400).json({ ok: false, erro: 'Dados incompletos.' });
  }

  try {
    // Buscar o pedido no banco
    const pedido = await pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [order_id]
    );
    if (!pedido.rows.length) {
      return res.status(404).json({ ok: false, erro: 'Pedido não encontrado.' });
    }

    const order = pedido.rows[0];
    const total = parseFloat(order.total);

    // Criar pagamento PIX no Mercado Pago
    const body = {
      transaction_amount: total,
      description: `Pedido #${order_id} — Beaver Books`,
      payment_method_id: 'pix',
      payer: {
        email: cliente_email,
        first_name: cliente_nome.split(' ')[0],
        last_name:  cliente_nome.split(' ').slice(1).join(' ') || 'Cliente',
      },
      external_reference: String(order_id),
    };

    const mpRes = await fetch(`${MP_URL}/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        'Authorization':  `Bearer ${MP_TOKEN}`,
        'X-Idempotency-Key': `order-${order_id}-${Date.now()}`,
      },
      body: JSON.stringify(body),
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok || mpData.error) {
      console.error('MP Error:', mpData);
      return res.status(500).json({ ok: false, erro: mpData.message || 'Erro ao gerar PIX.' });
    }

    // Salvar pagamento no banco
    await pool.query(
      `INSERT INTO payments (order_id, mp_payment_id, method, status, amount, qr_code, qr_code_base64)
       VALUES ($1, $2, 'pix', $3, $4, $5, $6)
       ON CONFLICT (order_id) DO UPDATE
       SET mp_payment_id=$2, status=$3, qr_code=$5, qr_code_base64=$6`,
      [
        order_id,
        mpData.id,
        mpData.status,
        total,
        mpData.point_of_interaction?.transaction_data?.qr_code || '',
        mpData.point_of_interaction?.transaction_data?.qr_code_base64 || '',
      ]
    );

    return res.json({
      ok: true,
      payment_id: mpData.id,
      status:     mpData.status,
      qr_code:    mpData.point_of_interaction?.transaction_data?.qr_code,
      qr_code_base64: mpData.point_of_interaction?.transaction_data?.qr_code_base64,
      expires_at: mpData.date_of_expiration,
      total,
    });

  } catch (err) {
    console.error('Erro pagamento PIX:', err);
    return res.status(500).json({ ok: false, erro: 'Erro interno ao processar pagamento.' });
  }
});

// ── POST /payments/webhook  — recebe notificações do MP ─────────────
router.post('/webhook', async (req, res) => {
  const { type, data } = req.body;

  if (type === 'payment') {
    try {
      const mpRes = await fetch(`${MP_URL}/v1/payments/${data.id}`, {
        headers: { 'Authorization': `Bearer ${MP_TOKEN}` },
      });
      const payment = await mpRes.json();

      const orderId = payment.external_reference;
      const status  = payment.status; // approved, pending, rejected

      // Atualizar status do pagamento no banco
      await pool.query(
        'UPDATE payments SET status=$1 WHERE mp_payment_id=$2',
        [status, data.id]
      );

      // Se aprovado, atualizar status do pedido
      if (status === 'approved') {
        await pool.query(
          "UPDATE orders SET status='confirmed' WHERE id=$1",
          [orderId]
        );
        console.log(`✅ Pedido #${orderId} pago via PIX!`);
      }

    } catch (err) {
      console.error('Webhook error:', err);
    }
  }

  res.sendStatus(200);
});

// ── GET /payments/status/:orderId  — consulta status ────────────────
router.get('/status/:orderId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM payments WHERE order_id=$1',
      [req.params.orderId]
    );
    if (!result.rows.length) {
      return res.json({ status: 'pending', paid: false });
    }
    const p = result.rows[0];
    return res.json({
      status:  p.status,
      paid:    p.status === 'approved',
      method:  p.method,
      amount:  p.amount,
    });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao consultar status.' });
  }
});

module.exports = router;
