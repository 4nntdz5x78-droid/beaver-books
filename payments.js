const express = require('express');
const router  = express.Router();
const pool    = require('./database');
const { sendPixEmail, sendCardApprovedEmail, sendCardPendingEmail } = require('./email');

// ── Credenciais ───────────────────────────────────────────────────────────
const PIX_KEY    = process.env.PIX_KEY    || 'd1817340-5d2d-41d2-bad1-d2d309185d00';
const PIX_NAME   = process.env.PIX_NAME   || 'Caio Henrique Ventura';
const PIX_CITY   = process.env.PIX_CITY   || 'SAO PAULO';
const MP_TOKEN   = process.env.MP_ACCESS_TOKEN;
const MP_PUB_KEY = process.env.MP_PUBLIC_KEY || '';
const MP_URL     = 'https://api.mercadopago.com';

// ── Helper: busca itens do pedido com título e autor ─────────────────────
async function getOrderItens(orderId) {
  const r = await pool.query(
    `SELECT oi.quantidade, oi.preco_unitario, b.titulo, b.autor
     FROM order_items oi
     JOIN books b ON b.id = oi.livro_id
     WHERE oi.order_id = $1`,
    [orderId]
  );
  return r.rows;
}

// ── Gerador de EMV PIX (BR Code) ─────────────────────────────────────────
function tlv(id, value) {
  return `${id}${String(value.length).padStart(2,'0')}${value}`;
}
function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc<<1)^0x1021) : (crc<<1);
    crc &= 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4,'0');
}
function buildPixEMV(key, name, city, amount, txId='daqr') {
  const stripDiacritics = s => s.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^ -~]/g,'');
  const merchantName = stripDiacritics(name.substring(0,25).toUpperCase());
  const merchantCity = stripDiacritics(city.substring(0,15).toUpperCase());
  const txIdSafe     = txId.replace(/\W/g,'').substring(0,25) || 'BB';
  const mai     = tlv('26', tlv('00','BR.GOV.BCB.PIX') + tlv('01',key));
  const addData = tlv('62', tlv('05',txIdSafe));
  const payload =
    tlv('00','01') + tlv('01','12') + mai +
    tlv('52','0000') + tlv('53','986') + tlv('54',parseFloat(amount).toFixed(2)) +
    tlv('58','BR') + tlv('59',merchantName) + tlv('60',merchantCity) + addData + '6304';
  return payload + crc16(payload);
}

// ── GET /payments/config  — chave pública MP para o frontend ─────────────
router.get('/config', (_req, res) => {
  res.json({ mp_public_key: MP_PUB_KEY });
});

// ── POST /payments/pix  — gera PIX via chave própria ────────────────────
router.post('/pix', async (req, res) => {
  const { order_id, cliente_nome, cliente_email } = req.body;
  if (!order_id || !cliente_nome || !cliente_email)
    return res.status(400).json({ ok:false, erro:'Dados incompletos.' });

  try {
    const pedido = await pool.query('SELECT * FROM orders WHERE id=$1', [order_id]);
    if (!pedido.rows.length)
      return res.status(404).json({ ok:false, erro:'Pedido não encontrado.' });

    const total = parseFloat(pedido.rows[0].total);
    const emv   = buildPixEMV(PIX_KEY, PIX_NAME, PIX_CITY, total, `BB${order_id}`);

    await pool.query(
      `INSERT INTO payments (order_id, mp_payment_id, method, status, amount, qr_code, qr_code_base64)
       VALUES ($1,$2,'pix','pending',$3,$4,'')
       ON CONFLICT (order_id) DO UPDATE
       SET method='pix', status='pending', amount=$3, qr_code=$4, qr_code_base64=''`,
      [order_id, order_id, total, emv]
    );

    // Disparar e-mail em background (não bloqueia a resposta)
    getOrderItens(order_id).then(itens => {
      sendPixEmail({
        to:       cliente_email,
        nome:     cliente_nome,
        pedidoId: order_id,
        total,
        itens,
        pixCode:  emv,
      }).catch(e => console.error('Erro e-mail PIX:', e));
    }).catch(() => {});

    return res.json({ ok:true, payment_id:order_id, status:'pending', qr_code:emv, qr_code_base64:null, total });

  } catch (err) {
    console.error('Erro PIX:', err);
    return res.status(500).json({ ok:false, erro:'Erro interno ao processar pagamento.' });
  }
});

// ── POST /payments/card  — cobra via cartão (Mercado Pago) ───────────────
router.post('/card', async (req, res) => {
  const { order_id, token, installments, payment_method_id, issuer_id, payer } = req.body;

  if (!order_id || !token || !payer?.email)
    return res.status(400).json({ ok:false, erro:'Dados incompletos.' });

  if (!MP_TOKEN)
    return res.status(500).json({ ok:false, erro:'Pagamento com cartão não configurado.' });

  try {
    const pedido = await pool.query('SELECT * FROM orders WHERE id=$1', [order_id]);
    if (!pedido.rows.length)
      return res.status(404).json({ ok:false, erro:'Pedido não encontrado.' });

    const total = parseFloat(pedido.rows[0].total);

    const mpRes = await fetch(`${MP_URL}/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'Authorization':     `Bearer ${MP_TOKEN}`,
        'X-Idempotency-Key': `card-${order_id}-${Date.now()}`,
      },
      body: JSON.stringify({
        transaction_amount: total,
        token,
        installments:       parseInt(installments) || 1,
        payment_method_id,
        issuer_id,
        description:        `Pedido #${order_id} — Beaver Books`,
        external_reference: String(order_id),
        payer: {
          email:          payer.email,
          identification: payer.identification || undefined,
        },
      }),
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok || mpData.error) {
      console.error('MP Card Error:', mpData);
      return res.status(400).json({ ok:false, erro: mpData.message || 'Erro ao processar cartão.' });
    }

    const status = mpData.status; // approved | in_process | rejected

    await pool.query(
      `INSERT INTO payments (order_id, mp_payment_id, method, status, amount, qr_code, qr_code_base64)
       VALUES ($1,$2,'card',$3,$4,'','')
       ON CONFLICT (order_id) DO UPDATE
       SET mp_payment_id=$2, method='card', status=$3, amount=$4`,
      [order_id, mpData.id, status, total]
    );

    if (status === 'approved') {
      await pool.query("UPDATE orders SET status='confirmed' WHERE id=$1", [order_id]);
    }

    // Disparar e-mail em background
    const emailNome = pedido.rows[0].cliente_nome;
    const emailTo   = payer.email || pedido.rows[0].cliente_email;
    getOrderItens(order_id).then(itens => {
      if (status === 'approved') {
        sendCardApprovedEmail({ to: emailTo, nome: emailNome, pedidoId: order_id, total, itens })
          .catch(e => console.error('Erro e-mail aprovado:', e));
      } else if (status === 'in_process') {
        sendCardPendingEmail({ to: emailTo, nome: emailNome, pedidoId: order_id, total, itens })
          .catch(e => console.error('Erro e-mail pendente:', e));
      }
    }).catch(() => {});

    return res.json({
      ok:           status !== 'rejected',
      status,
      approved:     status === 'approved',
      in_process:   status === 'in_process',
      rejected:     status === 'rejected',
      status_detail: mpData.status_detail,
      payment_id:   mpData.id,
      total,
    });

  } catch (err) {
    console.error('Erro cartão:', err);
    return res.status(500).json({ ok:false, erro:'Erro interno ao processar pagamento.' });
  }
});

// ── POST /payments/webhook ────────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  const { type, data } = req.body;
  if (type === 'payment') {
    try {
      const mpRes    = await fetch(`${MP_URL}/v1/payments/${data.id}`, {
        headers: { 'Authorization': `Bearer ${MP_TOKEN}` },
      });
      const payment  = await mpRes.json();
      const orderId  = payment.external_reference;
      const status   = payment.status;

      await pool.query('UPDATE payments SET status=$1 WHERE order_id=$2', [status, orderId]);
      if (status === 'approved') {
        await pool.query("UPDATE orders SET status='confirmed' WHERE id=$1", [orderId]);
        console.log(`✅ Pedido #${orderId} pago!`);
      }
    } catch (err) { console.error('Webhook error:', err); }
  }
  res.sendStatus(200);
});

// ── GET /payments/status/:orderId ─────────────────────────────────────────
router.get('/status/:orderId', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM payments WHERE order_id=$1', [req.params.orderId]);
    if (!result.rows.length) return res.json({ status:'pending', paid:false });
    const p = result.rows[0];
    return res.json({ status:p.status, paid:p.status==='approved', method:p.method, amount:p.amount });
  } catch (err) {
    res.status(500).json({ erro:'Erro ao consultar status.' });
  }
});

// ── POST /payments/confirm/:orderId  — confirmação manual ─────────────────
router.post('/confirm/:orderId', async (req, res) => {
  try {
    await pool.query("UPDATE payments SET status='approved' WHERE order_id=$1", [req.params.orderId]);
    await pool.query("UPDATE orders SET status='confirmed' WHERE id=$1", [req.params.orderId]);
    res.json({ ok:true });
  } catch (err) {
    res.status(500).json({ ok:false, erro:'Erro ao confirmar.' });
  }
});

module.exports = router;
