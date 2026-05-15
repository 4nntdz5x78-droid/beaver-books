const nodemailer = require('nodemailer');

// ── Transporter ──────────────────────────────────────────────────────────
function createTransporter() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const FROM = process.env.EMAIL_FROM || `"Beaver Books" <${process.env.SMTP_USER}>`;

// ── Layout base do e-mail ─────────────────────────────────────────────────
function baseLayout(content) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Beaver Books</title>
</head>
<body style="margin:0;padding:0;background:#f5f0eb;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0eb;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr>
          <td style="background:#111010;padding:28px 32px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#fff;letter-spacing:1px;">BEAVER BOOKS</p>
            <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,.5);letter-spacing:2px;text-transform:uppercase;">Editora</p>
          </td>
        </tr>

        <!-- Corpo -->
        <tr>
          <td style="padding:32px;">
            ${content}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f5f0eb;padding:20px 32px;border-top:1px solid #e8e0d5;">
            <p style="margin:0;font-size:12px;color:#999;text-align:center;">
              Beaver Books · São Paulo, SP<br>
              <a href="mailto:contato@beaverbooks.com.br" style="color:#c0143c;text-decoration:none;">contato@beaverbooks.com.br</a>
              &nbsp;·&nbsp;
              <a href="https://wa.me/5511981725028" style="color:#c0143c;text-decoration:none;">+55 11 98172-5028</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Helper: formatar preço ────────────────────────────────────────────────
function fmtBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(value);
}

// ── Helper: linhas dos itens do pedido ───────────────────────────────────
function itemsTable(itens) {
  const rows = itens.map(item => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f0ece6;">
        <p style="margin:0;font-size:14px;font-weight:600;color:#1c1a17;">${item.titulo}</p>
        <p style="margin:2px 0 0;font-size:13px;color:#888;">${item.autor}</p>
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #f0ece6;text-align:right;font-size:14px;color:#1c1a17;white-space:nowrap;">
        ${item.quantidade}× ${fmtBRL(item.preco_unitario)}
      </td>
    </tr>`).join('');

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
      ${rows}
      <tr>
        <td style="padding-top:12px;font-size:15px;font-weight:700;color:#1c1a17;">Total</td>
        <td style="padding-top:12px;font-size:15px;font-weight:700;color:#c0143c;text-align:right;">${fmtBRL(itens.reduce((s,i)=>s+(i.preco_unitario*i.quantidade),0))}</td>
      </tr>
    </table>`;
}

// ── E-mail 1: PIX gerado — aguardando pagamento ───────────────────────────
async function sendPixEmail({ to, nome, pedidoId, total, itens, pixCode }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return;
  const transporter = createTransporter();

  const content = `
    <h2 style="margin:0 0 4px;font-size:22px;color:#1c1a17;">Quase lá, ${nome.split(' ')[0]}! 🎉</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#888;">Pedido <strong>#${pedidoId}</strong> criado com sucesso.</p>

    <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;font-weight:600;color:#166534;">⏳ Aguardando pagamento via PIX</p>
      <p style="margin:6px 0 0;font-size:13px;color:#166534;">Após o pagamento seu pedido será confirmado automaticamente.</p>
    </div>

    <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#555;text-transform:uppercase;letter-spacing:.5px;">Seu pedido</p>
    ${itemsTable(itens)}

    <p style="margin:24px 0 8px;font-size:13px;font-weight:600;color:#555;text-transform:uppercase;letter-spacing:.5px;">Código PIX (Copia e Cola)</p>
    <div style="background:#f5f0eb;border:1px solid #e8e0d5;border-radius:8px;padding:14px;word-break:break-all;">
      <p style="margin:0;font-size:11px;font-family:monospace;color:#444;line-height:1.6;">${pixCode}</p>
    </div>
    <p style="margin:8px 0 0;font-size:12px;color:#999;">Cole esse código no app do seu banco para pagar via PIX.</p>

    <p style="margin:28px 0 0;font-size:13px;color:#888;">Dúvidas? Fale com a gente pelo WhatsApp ou e-mail — estamos aqui para ajudar.</p>`;

  await transporter.sendMail({
    from:    FROM,
    to,
    subject: `✅ Pedido #${pedidoId} recebido — aguardando PIX · Beaver Books`,
    html:    baseLayout(content),
  });
  console.log(`📧 E-mail PIX enviado para ${to}`);
}

// ── E-mail 2: Cartão aprovado ────────────────────────────────────────────
async function sendCardApprovedEmail({ to, nome, pedidoId, total, itens }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return;
  const transporter = createTransporter();

  const content = `
    <h2 style="margin:0 0 4px;font-size:22px;color:#1c1a17;">Pagamento confirmado! 🎊</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#888;">Olá, <strong>${nome.split(' ')[0]}</strong>! Seu pedido <strong>#${pedidoId}</strong> foi confirmado.</p>

    <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;font-weight:600;color:#166534;">✅ Pagamento aprovado via cartão de crédito</p>
      <p style="margin:6px 0 0;font-size:13px;color:#166534;">Em breve entraremos em contato com as próximas etapas.</p>
    </div>

    <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#555;text-transform:uppercase;letter-spacing:.5px;">Resumo do pedido</p>
    ${itemsTable(itens)}

    <p style="margin:28px 0 0;font-size:13px;color:#888;">Obrigado por escolher a Beaver Books. Qualquer dúvida estamos à disposição!</p>`;

  await transporter.sendMail({
    from:    FROM,
    to,
    subject: `🎊 Pagamento confirmado — Pedido #${pedidoId} · Beaver Books`,
    html:    baseLayout(content),
  });
  console.log(`📧 E-mail aprovado enviado para ${to}`);
}

// ── E-mail 3: Cartão em análise ──────────────────────────────────────────
async function sendCardPendingEmail({ to, nome, pedidoId, total, itens }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return;
  const transporter = createTransporter();

  const content = `
    <h2 style="margin:0 0 4px;font-size:22px;color:#1c1a17;">Pedido recebido! ⏳</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#888;">Olá, <strong>${nome.split(' ')[0]}</strong>! Seu pedido <strong>#${pedidoId}</strong> foi recebido.</p>

    <div style="background:#fefce8;border:1.5px solid #fde047;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;font-weight:600;color:#854d0e;">🔍 Pagamento em análise</p>
      <p style="margin:6px 0 0;font-size:13px;color:#854d0e;">Seu pagamento está sendo analisado pelo Mercado Pago. Você receberá outro e-mail assim que for confirmado.</p>
    </div>

    <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#555;text-transform:uppercase;letter-spacing:.5px;">Resumo do pedido</p>
    ${itemsTable(itens)}

    <p style="margin:28px 0 0;font-size:13px;color:#888;">Se tiver dúvidas, entre em contato. Estamos aqui para ajudar!</p>`;

  await transporter.sendMail({
    from:    FROM,
    to,
    subject: `⏳ Pedido #${pedidoId} em análise · Beaver Books`,
    html:    baseLayout(content),
  });
  console.log(`📧 E-mail em análise enviado para ${to}`);
}

module.exports = { sendPixEmail, sendCardApprovedEmail, sendCardPendingEmail };
