/* ── State ────────────────────────────────────────────────────────────────── */
const state = {
  page:     1,
  paginas:  1,
  total:    0,
  loading:  false,
  filters:  { genero: '', preco_min: '', preco_max: '', order_by: 'recentes' },
  search:   '',
};

let cart = loadCart();

/* ── DOM Refs ─────────────────────────────────────────────────────────────── */
const booksGrid     = document.getElementById('books-grid');
const resultsInfo   = document.getElementById('results-info');
const paginationEl  = document.getElementById('pagination');
const searchInput   = document.getElementById('search-input');
const generoSelect  = document.getElementById('filter-genero');
const precoMinSel   = document.getElementById('filter-preco-min');
const precoMaxSel   = document.getElementById('filter-preco-max');
const orderSelect   = document.getElementById('filter-order');
const cartBadge     = document.querySelector('.cart-badge');
const cartOverlay   = document.getElementById('cart-overlay');
const cartSidebar   = document.getElementById('cart-sidebar');
const cartItemsList = document.getElementById('cart-items');
const cartTotalVal  = document.getElementById('cart-total-value');
const checkoutBtn   = document.getElementById('checkout-btn');
const modalOverlay  = document.getElementById('modal-overlay');
const modalContent  = document.getElementById('modal-content');

/* ── Cart Persistence ─────────────────────────────────────────────────────── */
function loadCart() {
  try { return JSON.parse(localStorage.getItem('beaver_cart') || '[]'); }
  catch { return []; }
}

function saveCart() {
  localStorage.setItem('beaver_cart', JSON.stringify(cart));
}

function cartTotal() {
  return cart.reduce((sum, item) => sum + item.preco * item.quantidade, 0);
}

function cartCount() {
  return cart.reduce((sum, item) => sum + item.quantidade, 0);
}

function addToCart(livro) {
  const existing = cart.find(i => i.id === livro.id);
  if (existing) {
    existing.quantidade++;
  } else {
    cart.push({ ...livro, quantidade: 1 });
  }
  saveCart();
  updateCartUI();
  toast(`"${livro.titulo}" adicionado ao carrinho`, 'success');
}

function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  saveCart();
  updateCartUI();
  renderCartItems();
}

function changeQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.quantidade = Math.max(1, item.quantidade + delta);
  saveCart();
  updateCartUI();
  renderCartItems();
}

/* ── Cart UI ──────────────────────────────────────────────────────────────── */
function updateCartUI() {
  const count = cartCount();
  if (cartBadge) {
    cartBadge.textContent = count;
    cartBadge.classList.toggle('hidden', count === 0);
  }
  if (cartTotalVal) cartTotalVal.textContent = formatPrice(cartTotal());
  if (checkoutBtn)  checkoutBtn.disabled = cart.length === 0;
}

function renderCartItems() {
  if (!cartItemsList) return;
  if (cart.length === 0) {
    cartItemsList.innerHTML = `
      <div class="cart-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0"/>
        </svg>
        <p>Seu carrinho está vazio.<br>Adicione livros ao catálogo!</p>
      </div>`;
    return;
  }

  cartItemsList.innerHTML = cart.map(item => `
    <div class="cart-item" data-id="${item.id}">
      ${item.capa
        ? `<img class="cart-item-thumb" src="${escHtml(item.capa)}" alt="${escHtml(item.titulo)}" loading="lazy">`
        : `<div class="cart-item-thumb-placeholder">
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
               <path d="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 004 17V5a2 2 0 012-2h14a2 2 0 012 2v12"/>
             </svg>
           </div>`
      }
      <div class="cart-item-body">
        <div class="cart-item-title">${escHtml(item.titulo)}</div>
        <div class="cart-item-author">${escHtml(item.autor)}</div>
        <div class="cart-item-controls">
          <button class="qty-btn" onclick="changeQty(${item.id}, -1)" aria-label="Diminuir">−</button>
          <span class="qty-display">${item.quantidade}</span>
          <button class="qty-btn" onclick="changeQty(${item.id}, 1)" aria-label="Aumentar">+</button>
          <span class="cart-item-price">${formatPrice(item.preco * item.quantidade)}</span>
          <button class="remove-item-btn" onclick="removeFromCart(${item.id})" aria-label="Remover">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
    </div>`).join('');
}

function openCart() {
  if (cartOverlay) cartOverlay.classList.add('open');
  if (cartSidebar) cartSidebar.classList.add('open');
  document.body.style.overflow = 'hidden';
  renderCartItems();
}

function closeCart() {
  if (cartOverlay) cartOverlay.classList.remove('open');
  if (cartSidebar) cartSidebar.classList.remove('open');
  document.body.style.overflow = '';
}

/* ── Fetch Books ──────────────────────────────────────────────────────────── */
async function fetchBooks() {
  if (state.loading) return;
  state.loading = true;

  const params = new URLSearchParams();
  if (state.search)              params.set('busca',     state.search);
  if (state.filters.genero)      params.set('genero',    state.filters.genero);
  if (state.filters.preco_min)   params.set('preco_min', state.filters.preco_min);
  if (state.filters.preco_max)   params.set('preco_max', state.filters.preco_max);
  if (state.filters.order_by)    params.set('order_by',  state.filters.order_by);
  params.set('page',   state.page);
  params.set('limite', 15);

  renderSkeletons(15);

  try {
    const res  = await fetch(`/books?${params}`);
    const data = await res.json();

    state.paginas = data.paginas || 1;
    state.total   = data.total  || 0;

    renderBooks(data.livros || []);
    renderPagination();
    if (resultsInfo) {
      resultsInfo.textContent = state.total === 0
        ? 'Nenhum livro encontrado'
        : `${state.total} livro${state.total !== 1 ? 's' : ''} encontrado${state.total !== 1 ? 's' : ''}`;
    }
  } catch (err) {
    if (booksGrid) booksGrid.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <h3>Erro ao carregar</h3>
        <p>Não foi possível carregar os livros. Verifique se o servidor está rodando.</p>
      </div>`;
    if (resultsInfo) resultsInfo.textContent = '';
    toast('Erro ao carregar catálogo', 'error');
  } finally {
    state.loading = false;
  }
}

async function fetchGeneros() {
  try {
    const res    = await fetch('/books/generos');
    const genres = await res.json();
    if (generoSelect) {
      generoSelect.innerHTML = '<option value="">Todos os gêneros</option>' +
        genres.map(g => `<option value="${escHtml(g)}">${escHtml(g)}</option>`).join('');
    }
  } catch { /* non-critical */ }
}

/* ── Render Books ─────────────────────────────────────────────────────────── */
function renderBooks(livros) {
  if (!booksGrid) return;
  if (livros.length === 0) {
    booksGrid.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 004 17V5a2 2 0 012-2h14a2 2 0 012 2v12"/>
        </svg>
        <h3>Nenhum livro encontrado</h3>
        <p>Tente ajustar os filtros ou realizar uma nova busca.</p>
      </div>`;
    return;
  }

  booksGrid.innerHTML = livros.map(livro => {
    const stockCls   = livro.estoque <= 3 ? 'book-stock low' : 'book-stock';
    const stockLabel = livro.estoque <= 3 ? `Apenas ${livro.estoque} em estoque` : '';
    return `
      <article class="book-card" data-id="${livro.id}" style="cursor:pointer">
        <div class="book-cover"${livro.capa ? ` style="--cover-url:url('${escHtml(livro.capa)}')"` : ''}>
          <img
            src="${livro.capa ? escHtml(livro.capa) : 'Imagens/capa-padrao.svg'}"
            alt="${escHtml(livro.titulo)}"
            loading="lazy"
            ${!livro.capa ? 'class="default-cover"' : ''}
          >
          ${livro.genero ? `<span class="genre-badge">${escHtml(livro.genero)}</span>` : ''}
        </div>
        <div class="book-info">
          <div class="book-title">${escHtml(livro.titulo)}</div>
          <div class="book-author">${escHtml(livro.autor)}</div>
          <div class="book-price-row">
            <span class="book-price">${formatPrice(livro.preco)}</span>
            ${stockLabel ? `<span class="${stockCls}">${stockLabel}</span>` : ''}
          </div>
          <button
            class="add-to-cart-btn"
            onclick='addToCart(${JSON.stringify({ id: livro.id, titulo: livro.titulo, autor: livro.autor, preco: parseFloat(livro.preco), capa: livro.capa || null })})'
            ${livro.estoque === 0 ? 'disabled' : ''}
          >${livro.estoque === 0 ? 'Indisponível' : 'Adicionar ao carrinho'}</button>
        </div>
      </article>`;
  }).join('');
}

function renderSkeletons(n) {
  if (!booksGrid) return;
  booksGrid.innerHTML = Array.from({ length: n }, () => `
    <div class="skeleton-card">
      <div class="skeleton skeleton-cover"></div>
      <div class="skeleton-body">
        <div class="skeleton skeleton-line w-80"></div>
        <div class="skeleton skeleton-line w-60"></div>
        <div class="skeleton skeleton-line w-40"></div>
        <div class="skeleton skeleton-btn"></div>
      </div>
    </div>`).join('');
}

/* ── Pagination ───────────────────────────────────────────────────────────── */
function renderPagination() {
  if (!paginationEl) return;
  if (state.paginas <= 1) { paginationEl.innerHTML = ''; return; }

  const pages = [];
  pages.push(`<button class="page-btn" onclick="goToPage(${state.page - 1})" ${state.page === 1 ? 'disabled' : ''}>‹</button>`);

  for (let i = 1; i <= state.paginas; i++) {
    if (i === 1 || i === state.paginas || Math.abs(i - state.page) <= 2) {
      pages.push(`<button class="page-btn ${i === state.page ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`);
    } else if (Math.abs(i - state.page) === 3) {
      pages.push(`<span style="color:var(--text-dim);padding:0 4px">…</span>`);
    }
  }

  pages.push(`<button class="page-btn" onclick="goToPage(${state.page + 1})" ${state.page === state.paginas ? 'disabled' : ''}>›</button>`);
  paginationEl.innerHTML = pages.join('');
}

function goToPage(p) {
  if (p < 1 || p > state.paginas || p === state.page) return;
  state.page = p;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  fetchBooks();
}

/* ── Checkout ─────────────────────────────────────────────────────────────── */
let _mpInstanceCat = null;
let _cardFormInstanceCat = null;

function openCheckout() {
  closeCart();
  if (!modalContent) return;

  const summaryLines = cart.map(item =>
    `<div class="order-summary-line"><span>${escHtml(item.titulo)} × ${item.quantidade}</span><span>${formatPrice(item.preco*item.quantidade)}</span></div>`
  ).join('');
  const total = cartTotal();

  modalContent.innerHTML = `
    <h2>Finalizar pedido</h2>
    <p class="modal-subtitle">Preencha seus dados para confirmar a compra.</p>
    <div class="order-summary">
      ${summaryLines}
      <div class="order-summary-line total"><span>Total</span><span>${formatPrice(total)}</span></div>
    </div>
    <form id="checkout-form" novalidate>
      <div class="form-group">
        <label>Nome completo *</label>
        <input type="text" id="checkout-nome" placeholder="Seu nome" required>
      </div>
      <div class="form-group">
        <label>E-mail *</label>
        <input type="email" id="checkout-email" placeholder="seu@email.com" required>
      </div>

      <!-- Seletor de método de pagamento -->
      <div class="payment-method-selector">
        <label class="pm-option active" id="pm-pix-label">
          <input type="radio" name="payment_method" value="pix" checked hidden>
          <span class="pm-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
          </span>
          <span>PIX</span>
        </label>
        <label class="pm-option" id="pm-card-label">
          <input type="radio" name="payment_method" value="card" hidden>
          <span class="pm-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          </span>
          <span>Cartão de Crédito</span>
        </label>
      </div>

      <div class="modal-actions">
        <button type="button" class="modal-cancel-btn" onclick="closeModal()">Cancelar</button>
        <button type="submit" class="modal-confirm-btn" id="confirm-btn">Continuar</button>
      </div>
    </form>`;

  if (modalOverlay) modalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  document.querySelectorAll('.pm-option').forEach(label => {
    label.addEventListener('click', () => {
      document.querySelectorAll('.pm-option').forEach(l => l.classList.remove('active'));
      label.classList.add('active');
    });
  });

  document.getElementById('checkout-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome  = document.getElementById('checkout-nome').value.trim();
    const email = document.getElementById('checkout-email').value.trim();
    if (!nome || !email || !email.includes('@')) { toast('Preencha todos os campos.', 'error'); return; }

    const method = document.querySelector('input[name="payment_method"]:checked')?.value || 'pix';
    const btn    = document.getElementById('confirm-btn');
    if (btn) { btn.disabled=true; btn.textContent='Processando…'; }

    const itens = cart.map(item => ({ livro_id:item.id, quantidade:item.quantidade }));

    try {
      const res  = await fetch('/orders', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ cliente_nome:nome, cliente_email:email, itens }) });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.erro || 'Erro ao processar pedido.');

      if (method === 'pix') {
        const pixRes  = await fetch('/payments/pix', { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ order_id:data.pedido_id, cliente_nome:nome, cliente_email:email }) });
        const pixData = await pixRes.json();
        cart=[]; saveCart(); updateCartUI(); fetchBooks();
        if (pixRes.ok && pixData.ok) showPixQRCode(data.pedido_id, pixData);
        else showOrderSuccess(data.pedido_id);
      } else {
        cart=[]; saveCart(); updateCartUI(); fetchBooks();
        await showCardFormCat(data.pedido_id, total, nome, email);
      }
    } catch (err) {
      toast(err.message, 'error');
      if (btn) { btn.disabled=false; btn.textContent='Continuar'; }
    }
  });
}

function closeModal() {
  if (modalOverlay) modalOverlay.classList.remove('open');
  document.body.style.overflow = '';
}

function showOrderSuccess(pedidoId) {
  if (!modalContent) return;
  modalContent.innerHTML = `
    <div class="success-state">
      <div class="success-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <h3>Pedido confirmado!</h3>
      <p>Seu pedido foi registrado com sucesso.</p>
      <p style="font-size:13px;color:var(--text-dim);margin:16px 0">Nº do pedido: <strong>#${pedidoId}</strong></p>
      <button class="checkout-btn" style="max-width:200px;margin:0 auto" onclick="closeModal()">Continuar comprando</button>
    </div>`;
}

async function showCardFormCat(pedidoId, total, nome, email) {
  if (!modalContent) return;

  const cfg = await fetch('/payments/config').then(r=>r.json()).catch(()=>({}));
  if (!cfg.mp_public_key) {
    modalContent.innerHTML = `<div class="success-state">
      <h3>Cartão indisponível</h3>
      <p style="color:var(--text-dim);margin:16px 0">Por favor, use PIX como forma de pagamento.</p>
      <button class="checkout-btn" style="max-width:200px;margin:0 auto" onclick="closeModal()">Fechar</button>
    </div>`;
    return;
  }

  modalContent.innerHTML = `
    <div class="card-form-wrap">
      <div class="card-form-header">
        <div class="pix-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
        </div>
        <div><h3>Pedido #${pedidoId}</h3><p>Total: <strong>${formatPrice(total)}</strong></p></div>
      </div>
      <form id="mp-card-form-cat">
        <div class="card-form-grid">
          <div class="form-group full"><label>Número do cartão</label><div id="mp-cardNumber-cat" class="mp-field"></div></div>
          <div class="form-group"><label>Validade</label><div id="mp-expiration-cat" class="mp-field"></div></div>
          <div class="form-group"><label>CVV</label><div id="mp-cvv-cat" class="mp-field"></div></div>
          <div class="form-group full"><label>Nome no cartão</label><input id="mp-cardholder-cat" class="mp-input" type="text" placeholder="Como está no cartão" autocomplete="cc-name"/></div>
          <div class="form-group full"><label>CPF do titular</label><input id="mp-cpf-cat" class="mp-input" type="text" placeholder="000.000.000-00" maxlength="14"/></div>
          <div class="form-group full" id="mp-installments-wrap-cat" style="display:none">
            <label>Parcelas</label>
            <select id="mp-installments-cat" class="mp-input"></select>
          </div>
        </div>
        <div class="card-form-security">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          Pagamento seguro via Mercado Pago
        </div>
        <div class="modal-actions" style="margin-top:16px">
          <button type="button" class="modal-cancel-btn" onclick="closeModal()">Cancelar</button>
          <button type="submit" id="mp-pay-btn-cat" class="modal-confirm-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            Pagar ${formatPrice(total)}
          </button>
        </div>
      </form>
    </div>`;

  const cpfInput = document.getElementById('mp-cpf-cat');
  cpfInput.addEventListener('input', () => {
    let v = cpfInput.value.replace(/\D/g,'');
    v = v.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2');
    cpfInput.value = v;
  });

  _mpInstanceCat = new MercadoPago(cfg.mp_public_key, { locale:'pt-BR' });
  _cardFormInstanceCat = _mpInstanceCat.cardForm({
    amount: String(total),
    iframe: true,
    form: {
      id: 'mp-card-form-cat',
      cardNumber:     { id:'mp-cardNumber-cat',   placeholder:'0000 0000 0000 0000' },
      expirationDate: { id:'mp-expiration-cat',   placeholder:'MM/AA' },
      securityCode:   { id:'mp-cvv-cat',          placeholder:'CVV' },
      cardholderName: { id:'mp-cardholder-cat',   placeholder:'Nome no cartão' },
      installments:   { id:'mp-installments-cat' },
      // CPF lido manualmente via #mp-cpf-cat, sem envolver o SDK
    },
    callbacks: {
      onFormMounted: err => { if(err) console.warn('MP CardForm error:', err); },
      onInstallmentsReceived: (_err, data) => {
        const wrap = document.getElementById('mp-installments-wrap-cat');
        const sel  = document.getElementById('mp-installments-cat');
        if (!data?.payer_costs?.length) return;
        sel.innerHTML = data.payer_costs.map(p =>
          `<option value="${p.installments}">${p.recommended_message}</option>`
        ).join('');
        if (wrap) wrap.style.display = '';
      },
      onSubmit: async (event) => {
        event.preventDefault();
        const payBtn = document.getElementById('mp-pay-btn-cat');
        if (payBtn) { payBtn.disabled=true; payBtn.textContent='Processando…'; }

        try {
          const formData = _cardFormInstanceCat.getCardFormData();
          const cpf = document.getElementById('mp-cpf-cat')?.value.replace(/\D/g,'') || '';

          const cardRes = await fetch('/payments/card', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({
              order_id:          pedidoId,
              token:             formData.token,
              installments:      formData.installments,
              payment_method_id: formData.paymentMethodId,
              issuer_id:         formData.issuerId,
              payer: { email, identification:{ type:'CPF', number:cpf } },
            }),
          });
          const cardData = await cardRes.json();

          if (cardData.approved) {
            modalContent.innerHTML = `<div class="success-state">
              <div class="success-icon" style="background:rgba(34,197,94,.12)">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h3>Pagamento aprovado!</h3>
              <p>Obrigado, ${escHtml(nome)}! Pedido confirmado.</p>
              <p style="font-size:13px;color:var(--text-dim);margin:16px 0">Nº do pedido: <strong>#${pedidoId}</strong> · ${formatPrice(total)}</p>
              <button class="checkout-btn" style="max-width:200px;margin:0 auto" onclick="closeModal()">Continuar comprando</button>
            </div>`;
          } else if (cardData.in_process) {
            modalContent.innerHTML = `<div class="success-state">
              <div class="success-icon" style="background:rgba(234,179,8,.12)">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <h3>Pagamento em análise</h3>
              <p>Nº do pedido: <strong>#${pedidoId}</strong></p>
              <button class="checkout-btn" style="max-width:200px;margin:0 auto" onclick="closeModal()">Fechar</button>
            </div>`;
          } else {
            toast('Cartão recusado. Tente outro cartão ou use PIX.', 'error');
            if (payBtn) { payBtn.disabled=false; payBtn.textContent=`Pagar ${formatPrice(total)}`; }
          }
        } catch(err) {
          toast(err.message || 'Erro ao processar cartão.', 'error');
          const payBtn = document.getElementById('mp-pay-btn-cat');
          if (payBtn) { payBtn.disabled=false; payBtn.textContent=`Pagar ${formatPrice(total)}`; }
        }
      },
    },
  });
}


function makeQRCodeDataURL(text) {
  try {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const svg = qr.createSvgTag({ scalable: true });
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
  } catch(e) { return null; }
}

function showPixQRCode(pedidoId, pixData) {
  if (!modalContent) return;
  const total = typeof pixData.total === 'number'
    ? formatPrice(pixData.total)
    : 'R$ ' + String(pixData.total).replace('.', ',');

  const qrUrl = makeQRCodeDataURL(pixData.qr_code);
  const qrImgHTML = qrUrl
    ? `<img src="${qrUrl}" alt="QR Code PIX" class="pix-qr-img" style="width:200px;height:200px;display:block;margin:0 auto"/>`
    : `<p style="color:var(--text-dim);font-size:13px">Use o código abaixo para pagar.</p>`;

  modalContent.innerHTML = `
    <div class="pix-success">
      <div class="pix-header">
        <div class="pix-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <div>
          <h3>Pedido #${pedidoId} criado!</h3>
          <p>Escaneie o QR Code para pagar via PIX</p>
        </div>
      </div>
      <div class="pix-qr-wrap">
        ${qrImgHTML}
        <p class="pix-total">Total: <strong>${total}</strong></p>
      </div>
      <div class="pix-copy-wrap">
        <p class="pix-copy-label">Ou copie o codigo PIX:</p>
        <div class="pix-code-row">
          <input type="text" class="pix-code-input" value="${pixData.qr_code}" readonly id="pix-code-cat"/>
          <button class="pix-copy-btn" onclick="copyPixCat()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
            </svg>
            Copiar
          </button>
        </div>
      </div>
      <div class="pix-info">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>O PIX expira em <strong>30 minutos</strong>. Voce recebera a confirmacao por e-mail apos o pagamento.</span>
      </div>
      <div class="pix-status" id="pix-status-cat">
        <div class="pix-status-dot"></div>
        Aguardando pagamento...
      </div>
      <button onclick="closeModal()" class="modal-cancel-btn" style="width:100%;margin-top:8px">
        Fechar e continuar comprando
      </button>
    </div>`;

  const polling = setInterval(async () => {
    try {
      const r = await fetch('/payments/status/' + pedidoId);
      const d = await r.json();
      if (d.paid) {
        clearInterval(polling);
        const el = document.getElementById('pix-status-cat');
        if (el) el.innerHTML = '<div class="pix-status-dot paid"></div><strong style="color:#22c55e">Pagamento confirmado! Obrigado!</strong>';
        toast('PIX recebido! Pedido confirmado!');
      }
    } catch(e) { clearInterval(polling); }
  }, 5000);
}

function copyPixCat() {
  const input = document.getElementById('pix-code-cat');
  if (!input) return;
  navigator.clipboard.writeText(input.value);
  toast('Codigo PIX copiado!');
}

/* ── Event Delegation for dynamic checkout form ───────────────────────────── */
if (modalOverlay) {
  modalOverlay.addEventListener('submit', async (e) => {
    if (e.target.id !== 'checkout-form') return;
    e.preventDefault();

    const nomeInput  = document.getElementById('checkout-nome');
    const emailInput = document.getElementById('checkout-email');
    let valid = true;

    if (!nomeInput.value.trim()) { nomeInput.classList.add('error'); valid = false; }
    else nomeInput.classList.remove('error');

    if (!emailInput.value.trim() || !emailInput.value.includes('@')) {
      emailInput.classList.add('error'); valid = false;
    } else emailInput.classList.remove('error');

    if (!valid) { toast('Preencha todos os campos obrigatórios.', 'error'); return; }
    await submitOrder(nomeInput.value.trim(), emailInput.value.trim());
  });

  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });
}

/* ── Filters & Search ─────────────────────────────────────────────────────── */
function applyFilters() {
  if (generoSelect) state.filters.genero    = generoSelect.value;
  if (precoMinSel)  state.filters.preco_min = precoMinSel.value;
  if (precoMaxSel)  state.filters.preco_max = precoMaxSel.value;
  if (orderSelect)  state.filters.order_by  = orderSelect.value;
  state.page = 1;
  fetchBooks();
}

function clearFilters() {
  if (searchInput)  searchInput.value  = '';
  if (generoSelect) generoSelect.value = '';
  if (precoMinSel)  precoMinSel.value  = '';
  if (precoMaxSel)  precoMaxSel.value  = '';
  if (orderSelect)  orderSelect.value  = 'recentes';
  state.search  = '';
  state.filters = { genero: '', preco_min: '', preco_max: '', order_by: 'recentes' };
  state.page = 1;
  fetchBooks();
}

if (searchInput) {
  let searchDebounce;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      state.search = searchInput.value.trim();
      state.page = 1;
      fetchBooks();
    }, 400);
  });
}

const searchForm = document.getElementById('search-form');
if (searchForm) {
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    state.search = searchInput ? searchInput.value.trim() : '';
    state.page = 1;
    fetchBooks();
  });
}

if (generoSelect) generoSelect.addEventListener('change', applyFilters);
if (precoMinSel)  precoMinSel.addEventListener('change', applyFilters);
if (precoMaxSel)  precoMaxSel.addEventListener('change', applyFilters);
if (orderSelect)  orderSelect.addEventListener('change', applyFilters);

/* ── Cart Events ──────────────────────────────────────────────────────────── */
const cartBtn = document.querySelector('.cart-icon, .cart-btn, [data-cart], .btn-cart') ||
                document.querySelector('button[aria-label*="cart"], button[aria-label*="carrinho"]');
if (cartBtn) cartBtn.addEventListener('click', function() {
  cartSidebar?.classList.contains('open') ? closeCart() : openCart();
});

const cartCloseBtn = document.getElementById('cart-close-btn');
if (cartCloseBtn) cartCloseBtn.addEventListener('click', closeCart);
if (cartOverlay)  cartOverlay.addEventListener('click', closeCart);
if (checkoutBtn)  checkoutBtn.addEventListener('click', openCheckout);

const hamburger = document.getElementById('hamburger');
const mainNav   = document.getElementById('main-nav');
if (hamburger && mainNav) {
  hamburger.addEventListener('click', () => {
    mainNav.classList.toggle('open');
    hamburger.classList.toggle('open');
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeCart(); closeModal(); }
});

const footerYear = document.getElementById('footer-year');
if (footerYear) footerYear.textContent = new Date().getFullYear();

/* ── Utilities ────────────────────────────────────────────────────────────── */
function formatPrice(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

/* ── Init ─────────────────────────────────────────────────────────────────── */
updateCartUI();
fetchGeneros();
fetchBooks();

/* ── Book card click (delegação) ──────────────────────── */
booksGrid.addEventListener('click', function(e) {
  const card = e.target.closest('.book-card');
  if (!card) return;
  // Se clicou no botão "Adicionar ao carrinho", não redirecionar
  if (e.target.closest('.add-to-cart-btn')) return;
  const id = card.getAttribute('data-id');
  if (id) window.location.href = 'livro.html?id=' + id;
});