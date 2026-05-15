const express = require('express');
const router  = express.Router();
const pool    = require('./database');

// ── Chave PIX Beaver Books ──────────────────────────────────────────────
const PIX_KEY  = process.env.PIX_KEY  || 'd1817340-5d2d-41d2-bad1-d2d309185d00';
const PIX_NAME = process.env.PIX_NAME || 'Caio Henrique Ventura';
const PIX_CITY = process.env.PIX_CITY || 'SAO PAULO';

// ── Gerador de EMV PIX (BR Code) ─────────────────────────────────────────
function tlv(id, value) {
  const len = String(value.length).padStart(2, '0');
  return `${id}${len}${value}`;
}

function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
    }
    crc &= 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function buildPixEMV(key, name, city, amount, txId = 'daqr') {
  // Merchant Account Info
  const gui    = tlv('00', 'BR.GOV.BCB.PIX');
  const pixKey = tlv('01', key);
  const mai    = tlv('26', gui + pixKey);

  // Merchant name / city (max 25 / 15 chars, ASCII only)
  const stripDiacritics = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^ -~]/g, '');
  const merchantName = stripDiacritics(name.substring(0, 25).toUpperCase());
  const merchantCity = stripDiacritics(city.substring(0, 15).toUpperCase());

  // Additional data (txid)
  const txIdSafe = txId.replace(/\W/g, '').substring(0, 25) || '***';
  const addData  = tlv('62', tlv('05', txIdSafe));

  // Amount (obrigatório para PIX dinâmico)
  const amtStr = parseFloat(amount).toFixed(2);

  const payload =
    tlv('00', '01') +           // Payload Format Indicator
    tlv('01', '12') +           // Point of Initiation (12 = dinâmico, reutilizável)
    mai +                       // Merchant Account Info
    tlv('52', '0000') +         // MCC
    tlv('53', '986') +          // Currency (BRL)
    tlv('54', amtStr) +         // Amount
    tlv('58', 'BR') +           // Country
    tlv('59', merchantName) +   // Merchant Name
    tlv('60', merchantCity) +   // Merchant City
    addData +                   // Additional Data
    '6304';                     // CRC placeholder

  return payload + crc16(payload);
}

// ── POST /payments/pix  — gera QR Code PIX via chave própria ────────────
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

    // Gerar código EMV com valor dinâmico
    const txId = `BB${order_id}`;
    const emv  = buildPixEMV(PIX_KEY, PIX_NAME, PIX_CITY, total, txId);

    // Salvar no banco (QR Code será gerado no frontend via CDN)
    await pool.query(
      `INSERT INTO payments (order_id, mp_payment_id, method, status, amount, qr_code, qr_code_base64)
       VALUES ($1, $2, 'pix', 'pending', $3, $4, '')
       ON CONFLICT (order_id) DO UPDATE
       SET method='pix', status='pending', amount=$3, qr_code=$4, qr_code_base64=''`,
      [order_id, `pix-${order_id}`, total, emv]
    );

    return res.json({
      ok:             true,
      payment_id:     `pix-${order_id}`,
      status:         'pending',
      qr_code:        emv,
      qr_code_base64: null,   // gerado no frontend
      total,
    });

  } catch (err) {
    console.error('Erro pagamento PIX:', err);
    return res.status(500).json({ ok: false, erro: err.message || 'Erro interno ao processar pagamento.' });
  }
});

// ── POST /payments/webhook  — confirmação manual de pagamento ────────────
router.post('/webhook', async (req, res) => {
  const { type, data } = req.body;

  if (type === 'payment') {
    try {
      const orderId = data.external_reference || data.order_id;
      const status  = data.status;

      await pool.query(
        'UPDATE payments SET status=$1 WHERE order_id=$2',
        [status, orderId]
      );

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

// ── GET /payments/status/:orderId  — consulta status ────────────────────
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
      status: p.status,
      paid:   p.status === 'approved',
      method: p.method,
      amount: p.amount,
    });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao consultar status.' });
  }
});

// ── POST /payments/confirm/:orderId  — confirmar pagamento manualmente ───
router.post('/confirm/:orderId', async (req, res) => {
  try {
    await pool.query(
      "UPDATE payments SET status='approved' WHERE order_id=$1",
      [req.params.orderId]
    );
    await pool.query(
      "UPDATE orders SET status='confirmed' WHERE id=$1",
      [req.params.orderId]
    );
    console.log(`✅ Pedido #${req.params.orderId} confirmado manualmente.`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, erro: 'Erro ao confirmar.' });
  }
});

module.exports = router;
