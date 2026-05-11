/* cart-sidebar.js — carrinho lateral compartilhado entre páginas */
(function () {
  const CART_KEY = 'beaver_cart';

  function loadCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); }
    catch { return []; }
  }

  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }

  function formatPrice(v) {
    return 'R$ ' + Number(v).toFixed(2).replace('.', ',');
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function cartTotal(cart) {
    return cart.reduce((s, i) => s + i.preco * i.quantidade, 0);
  }

  function cartCount(cart) {
    return cart.reduce((s, i) => s + i.quantidade, 0);
  }

  function updateBadge() {
    const cart = loadCart();
    const badge = document.querySelector('#cart-btn .cart-badge');
    if (!badge) return;
    const n = cartCount(cart);
    badge.textContent = n;
    badge.classList.toggle('hidden', n === 0);
  }

  function renderItems() {
    const cart = loadCart();
    const list  = document.getElementById('cart-items');
    const total = document.getElementById('cart-total-value');
    const btn   = document.getElementById('checkout-btn');
    if (!list) return;

    if (cart.length === 0) {
      list.innerHTML = `
        <div class="cart-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0"/>
          </svg>
          <p>Seu carrinho está vazio.<br>Adicione livros ao catálogo!</p>
        </div>`;
    } else {
      list.innerHTML = cart.map(item => `
        <div class="cart-item" data-id="${item.id}">
          ${item.capa
            ? `<img class="cart-item-thumb" src="${esc(item.capa)}" alt="${esc(item.titulo)}" loading="lazy"
                 onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
            : ''}
          <div class="cart-item-thumb-placeholder" style="${item.capa ? 'display:none' : ''}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 004 17V5a2 2 0 012-2h14a2 2 0 012 2v12"/>
            </svg>
          </div>
          <div class="cart-item-body">
            <div class="cart-item-title">${esc(item.titulo)}</div>
            <div class="cart-item-author">${esc(item.autor)}</div>
            <div class="cart-item-controls">
              <button class="qty-btn" data-action="dec" data-id="${item.id}" aria-label="Diminuir">−</button>
              <span class="qty-display">${item.quantidade}</span>
              <button class="qty-btn" data-action="inc" data-id="${item.id}" aria-label="Aumentar">+</button>
              <span class="cart-item-price">${formatPrice(item.preco * item.quantidade)}</span>
              <button class="remove-item-btn" data-action="remove" data-id="${item.id}" aria-label="Remover">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>
        </div>`).join('');
    }

    if (total) total.textContent = formatPrice(cartTotal(cart));
    if (btn)   btn.disabled = cart.length === 0;
  }

  function openCart() {
    document.getElementById('cart-overlay')?.classList.add('open');
    document.getElementById('cart-sidebar')?.classList.add('open');
    document.body.style.overflow = 'hidden';
    renderItems();
  }

  function closeCart() {
    document.getElementById('cart-overlay')?.classList.remove('open');
    document.getElementById('cart-sidebar')?.classList.remove('open');
    document.body.style.overflow = '';
  }

  document.addEventListener('DOMContentLoaded', function () {
    updateBadge();

    document.getElementById('cart-btn')?.addEventListener('click', function() {
      const sidebar = document.getElementById('cart-sidebar');
      sidebar?.classList.contains('open') ? closeCart() : openCart();
    });
    document.getElementById('cart-close-btn')?.addEventListener('click', closeCart);
    document.getElementById('cart-overlay')?.addEventListener('click', closeCart);

    document.getElementById('cart-items')?.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const id   = parseInt(btn.dataset.id);
      let cart   = loadCart();
      const item = cart.find(i => i.id === id);
      if (!item) return;

      if (btn.dataset.action === 'remove') {
        cart = cart.filter(i => i.id !== id);
      } else if (btn.dataset.action === 'inc') {
        item.quantidade++;
      } else if (btn.dataset.action === 'dec') {
        item.quantidade = Math.max(1, item.quantidade - 1);
      }

      saveCart(cart);
      updateBadge();
      renderItems();
    });

    document.getElementById('checkout-btn')?.addEventListener('click', function () {
      window.location.href = 'catalogo.html';
    });

    window.addEventListener('storage', function (e) {
      if (e.key === CART_KEY) { updateBadge(); renderItems(); }
    });
  });
})();
