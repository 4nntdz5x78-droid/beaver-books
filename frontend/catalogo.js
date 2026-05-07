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
  params.set('limite', 12);

  renderSkeletons(12);

  try {
    const res  = await fetch(`http://localhost:3000/books?${params}`);
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
    const res    = await fetch('http://localhost:3000/books/generos');
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
        <div class="book-cover">
          ${livro.capa
            ? `<img src="${escHtml(livro.capa)}" alt="${escHtml(livro.titulo)}" loading="lazy">`
            : `<div class="book-cover-placeholder">
                 <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                   <path d="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 004 17V5a2 2 0 012-2h14a2 2 0 012 2v12"/>
                 </svg>
                 <span>${escHtml(livro.titulo)}</span>
               </div>`
          }
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
function openCheckout() {
  closeCart();
  if (!modalContent) return;
  modalContent.innerHTML = buildCheckoutForm();
  if (modalOverlay) modalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  if (modalOverlay) modalOverlay.classList.remove('open');
  document.body.style.overflow = '';
}

function buildCheckoutForm() {
  const summaryLines = cart.map(item =>
    `<div class="order-summary-line">
       <span>${escHtml(item.titulo)} × ${item.quantidade}</span>
       <span>${formatPrice(item.preco * item.quantidade)}</span>
     </div>`
  ).join('');

  return `
    <h2>Finalizar pedido</h2>
    <p class="modal-subtitle">Preencha seus dados para confirmar a compra.</p>
    <div class="order-summary">
      ${summaryLines}
      <div class="order-summary-line total">
        <span>Total</span>
        <span>${formatPrice(cartTotal())}</span>
      </div>
    </div>
    <form id="checkout-form" novalidate>
      <div class="form-group">
        <label for="checkout-nome">Nome completo *</label>
        <input type="text" id="checkout-nome" placeholder="Seu nome" required>
      </div>
      <div class="form-group">
        <label for="checkout-email">E-mail *</label>
        <input type="email" id="checkout-email" placeholder="seu@email.com" required>
      </div>
      <div class="modal-actions">
        <button type="button" class="modal-cancel-btn" onclick="closeModal()">Cancelar</button>
        <button type="submit" class="modal-confirm-btn" id="confirm-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
          Confirmar pedido
        </button>
      </div>
    </form>`;
}

function showOrderSuccess(pedidoId) {
  if (!modalContent) return;
  modalContent.innerHTML = `
    <div class="success-state">
      <div class="success-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <h3>Pedido confirmado!</h3>
      <p>Seu pedido foi registrado com sucesso.</p>
      <p>Nº do pedido: <strong>#${pedidoId}</strong></p>
      <button class="checkout-btn" style="max-width:200px;margin:0 auto" onclick="closeModal()">
        Continuar comprando
      </button>
    </div>`;
}

async function submitOrder(nome, email) {
  const confirmBtn = document.getElementById('confirm-btn');
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'Processando...'; }

  const itens = cart.map(item => ({ livro_id: item.id, quantidade: item.quantidade }));

  try {
    // 1. Criar pedido
    const res  = await fetch('http://localhost:3000/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cliente_nome: nome, cliente_email: email, itens }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.erro || 'Erro ao processar pedido.');

    // 2. Gerar PIX
    const pixRes = await fetch('http://localhost:3000/payments/pix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: data.pedido_id, cliente_nome: nome, cliente_email: email }),
    });
    const pixData = await pixRes.json();

    cart = [];
    saveCart();
    updateCartUI();

    if (pixRes.ok && pixData.ok) {
      showPixQRCode(data.pedido_id, pixData);
    } else {
      showOrderSuccess(data.pedido_id);
    }
    fetchBooks();

  } catch (err) {
    toast(err.message, 'error');
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg> Confirmar pedido';
    }
  }
}


function showPixQRCode(pedidoId, pixData) {
  if (!modalContent) return;
  const total = typeof pixData.total === 'number'
    ? formatPrice(pixData.total)
    : 'R$ ' + String(pixData.total).replace('.', ',');

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
        <img src="data:image/png;base64,${pixData.qr_code_base64}" alt="QR Code PIX" class="pix-qr-img"/>
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
      const r = await fetch('http://localhost:3000/payments/status/' + pedidoId);
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
if (cartBtn)      cartBtn.addEventListener('click', openCart);

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