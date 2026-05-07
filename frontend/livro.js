
  const API = 'http://localhost:3000';
  let currentBook = null;
  let qty = 1;
  let cart = loadCart();
  let selectedRating = 0;
  let descExpanded = false;
  let appliedDiscount = 0;
  let wishlist = loadWishlist();

  /* ── Utils ─────────────────────────────────────────── */
  function loadCart(){ try{ return JSON.parse(localStorage.getItem('beaver_cart')||'[]'); } catch{ return []; } }
  function saveCart(){ localStorage.setItem('beaver_cart', JSON.stringify(cart)); }
  function loadWishlist(){ try{ return JSON.parse(localStorage.getItem('beaver_wishlist')||'[]'); } catch{ return []; } }
  function saveWishlist(){ localStorage.setItem('beaver_wishlist', JSON.stringify(wishlist)); }
  function loadReviews(id){ try{ return JSON.parse(localStorage.getItem('reviews_'+id)||'[]'); } catch{ return []; } }
  function saveReviews(id, r){ localStorage.setItem('reviews_'+id, JSON.stringify(r)); }
  function cartCount(){ return cart.reduce((s,i)=>s+i.quantidade,0); }
  function cartTotal(){ return cart.reduce((s,i)=>s+i.preco*i.quantidade,0); }
  function fmtPrice(v){ return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v); }
  function escHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function getBookId(){ return new URLSearchParams(window.location.search).get('id'); }

  function toast(msg, type='success'){
    const c = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(()=>el.remove(), 3200);
  }

  /* ── Load book ─────────────────────────────────────── */
  async function loadBook(){
    const id = getBookId();
    if(!id){ showError(); return; }
    try {
      const [bookRes, relRes] = await Promise.all([
        fetch(`${API}/books/${id}`),
        fetch(`${API}/books?limite=8`)
      ]);
      if(!bookRes.ok){ showError(); return; }
      const book = await bookRes.json();
      const rel  = await relRes.json();
      currentBook = book;
      renderBook(book);
      renderRelated(rel.livros||[], book);
      renderReviews(id);
      document.getElementById('loading-state').style.display = 'none';
      document.getElementById('book-content').style.display  = 'grid';
    } catch(e){ showError(); }
  }

  function showError(){
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('error-state').style.display   = 'block';
  }

  /* ── Render book ───────────────────────────────────── */
  function renderBook(b){
    document.title = `${b.titulo} — Beaver Books`;
    document.getElementById('bc-title').textContent = b.titulo;

    // Genre
    const genreEl = document.getElementById('book-genre');
    if(b.genero){ genreEl.textContent = b.genero; } else { genreEl.style.display='none'; }

    // Title & author
    document.getElementById('book-title').textContent  = b.titulo;
    document.getElementById('book-author').textContent = b.autor || 'Autor desconhecido';

    // Sales badge (simulado)
    const salesNums = [23,47,15,89,31,12,58,7];
    document.getElementById('sales-count').textContent = `${salesNums[b.id % salesNums.length]} vendas este mês`;

    // Viewers (simulado, atualiza a cada 8s)
    const baseViewers = 5 + (b.id * 7 % 20);
    document.getElementById('viewers-count').textContent = baseViewers;
    setInterval(()=>{
      const delta = Math.random() > 0.5 ? 1 : -1;
      const el = document.getElementById('viewers-count');
      if(!el) return;
      const v = Math.max(3, parseInt(el.textContent) + delta);
      el.textContent = v;
    }, 8000);

    // Cover
    const cc = document.getElementById('cover-container');
    if(b.capa){
      cc.innerHTML = `<img src="${escHtml(b.capa)}" alt="${escHtml(b.titulo)}" style="width:100%;height:100%;object-fit:cover">`;
    } else {
      cc.innerHTML = `<div class="cover-placeholder">
        <div class="cover-initials">${b.titulo.charAt(0)}</div>
        <span>${escHtml(b.titulo)}</span>
      </div>`;
    }

    // Rating (mistura avaliações salvas + simulado)
    const reviews = loadReviews(b.id);
    let avgRating, totalReviews;
    if(reviews.length){
      avgRating = reviews.reduce((s,r)=>s+r.nota,0) / reviews.length;
      totalReviews = reviews.length;
    } else {
      const rs = [4,4.5,5,3.5,4.2,4.8,3.8,4.3];
      avgRating = rs[b.id % rs.length];
      totalReviews = [12,28,7,45,19,33,8,52][b.id % 8];
    }
    const full = Math.floor(avgRating);
    const half = avgRating % 1 >= 0.5;
    document.getElementById('stars-container').innerHTML =
      Array.from({length:5},(_,i)=>{
        if(i<full) return '<span class="star">★</span>';
        if(i===full&&half) return '<span class="star" style="opacity:.55">★</span>';
        return '<span class="star empty">★</span>';
      }).join('');
    document.getElementById('rating-count').textContent = `${avgRating.toFixed(1)} (${totalReviews} avaliações)`;

    // Price
    const preco = parseFloat(b.preco);
    document.getElementById('book-price').textContent = fmtPrice(preco);
    document.getElementById('book-installment').textContent =
      preco > 30 ? `ou 3× de ${fmtPrice(preco/3)} sem juros` : '';

    // Stock + urgência
    const stockEl = document.getElementById('stock-info');
    if(b.estoque > 10){
      stockEl.innerHTML = `<span class="stock-dot in"></span> Em estoque (${b.estoque} disponíveis)`;
    } else if(b.estoque > 0){
      stockEl.innerHTML = `<span class="stock-dot low"></span> <strong>Restam apenas ${b.estoque} unidades!</strong> Garanta o seu agora.`;
      stockEl.classList.add('urgency');
    } else {
      stockEl.innerHTML = `<span class="stock-dot out"></span> Esgotado`;
      document.getElementById('btn-add-cart').disabled = true;
      document.getElementById('btn-add-cart').textContent = 'Esgotado';
      document.getElementById('btn-buy-now').disabled = true;
      document.getElementById('qty-plus').disabled = true;
    }

    updateQtyUI();

    // Wishlist state
    updateWishlistBtn();

    // Metadata expandido
    const isbn = `978-85-${String(b.id).padStart(3,'0')}-${Math.floor(Math.random()*9000+1000)}-${b.id%10}`;
    const pages = [180, 240, 312, 128, 280, 364, 196, 420][b.id % 8];
    const year  = 2020 + (b.id % 5);
    const edicao = ['1ª Edição', '2ª Edição', '3ª Edição'][b.id % 3];
    const meta = [
      { label: 'ISBN',            value: isbn },
      { label: 'Páginas',         value: `${pages} páginas` },
      { label: 'Publicação',      value: `${year}` },
      { label: 'Edição',          value: edicao },
      { label: 'Gênero',          value: b.genero || '—' },
      { label: 'Editora',         value: b.editora || 'Beaver Books' },
      { label: 'Idioma',          value: 'Português (Brasil)' },
      { label: 'Formato',         value: 'Impresso / E-book' },
    ];
    document.getElementById('book-meta').innerHTML = meta.map(m=>
      `<div class="meta-item">
        <span class="meta-label">${escHtml(m.label)}</span>
        <span class="meta-value">${escHtml(m.value)}</span>
      </div>`
    ).join('');

    // Description com "ler mais"
    const desc = b.descricao || 'Uma obra que convida o leitor a refletir sobre os grandes temas da existência humana. Com uma narrativa rica e personagens profundamente desenvolvidos, este livro é uma experiência literária completa que ficará em sua memória por muito tempo após a última página.';
    const descEl = document.getElementById('book-description');
    descEl.innerHTML = `<p>${escHtml(desc)}</p>`;
    if(desc.length > 200){
      descEl.classList.add('truncated');
      document.getElementById('read-more-btn').style.display = 'flex';
    }

    // Biografia do autor (simulada)
    document.getElementById('author-name-bio').textContent = b.autor || 'Autor';
    document.getElementById('author-description').textContent =
      `${b.autor || 'Este autor'} é uma voz singular na literatura brasileira contemporânea. Com formação em Letras e anos dedicados à escrita, seus trabalhos exploram a complexidade das relações humanas com sensibilidade e profundidade. "${b.titulo}" é mais uma demonstração do seu talento único de transformar experiências cotidianas em narrativas universais.`;
    const initials = (b.autor||'A').split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
    document.getElementById('author-avatar').textContent = initials;

    // Eventos
    document.getElementById('btn-add-cart').addEventListener('click', addToCart);
    document.getElementById('btn-buy-now').addEventListener('click', buyNow);
    document.getElementById('btn-wishlist').addEventListener('click', toggleWishlist);
  }

  /* ── Description toggle ─────────────────────────────── */
  function toggleDescription(){
    const el  = document.getElementById('book-description');
    const btn = document.getElementById('read-more-btn');
    descExpanded = !descExpanded;
    el.classList.toggle('truncated', !descExpanded);
    btn.innerHTML = descExpanded
      ? 'Ler menos <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 15l-6-6-6 6"/></svg>'
      : 'Ler mais <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
  }

  /* ── Coupon ─────────────────────────────────────────── */
  function applyCoupon(){
    const code = document.getElementById('coupon-input').value.trim().toUpperCase();
    const msg  = document.getElementById('coupon-msg');
    const coupons = { 'PRIMEIRACOMPRA': 10, 'BEAVER20': 20, 'LEITOR15': 15 };
    if(coupons[code]){
      appliedDiscount = coupons[code];
      msg.textContent = `✓ Cupom aplicado! ${coupons[code]}% de desconto`;
      msg.className = 'coupon-msg success';
      toast(`Cupom ${code} aplicado! ${coupons[code]}% de desconto`);
    } else if(code){
      appliedDiscount = 0;
      msg.textContent = '✕ Cupom inválido ou expirado';
      msg.className = 'coupon-msg error';
    }
  }

  /* ── CEP / Frete ────────────────────────────────────── */
  function calcFrete(){
    let cep = document.getElementById('cep-input').value.replace(/\D/g,'');
    const result = document.getElementById('shipping-result');
    if(cep.length < 8){ toast('Digite um CEP válido (8 dígitos)','error'); return; }
    result.innerHTML = '<span class="shipping-loading">Calculando...</span>';
    // Simulação de frete
    setTimeout(()=>{
      const primeiroDigito = parseInt(cep[0]);
      let frete, prazo;
      if(primeiroDigito <= 1){       frete = 0;     prazo = '2–3 dias úteis'; }
      else if(primeiroDigito <= 3){  frete = 12.90; prazo = '3–5 dias úteis'; }
      else if(primeiroDigito <= 6){  frete = 18.90; prazo = '5–8 dias úteis'; }
      else {                         frete = 24.90; prazo = '7–12 dias úteis'; }
      const total = cart.reduce((s,i)=>s+i.preco*i.quantidade, currentBook ? parseFloat(currentBook.preco) : 0);
      if(total >= 150) frete = 0;
      result.innerHTML = `
        <div class="shipping-option ${frete===0?'free':''}">
          <span>${frete===0?'🎉 Frete Grátis':fmtPrice(frete)}</span>
          <span>PAC • ${prazo}</span>
        </div>
        ${frete > 0 ? `<p class="shipping-tip">Adicione mais ${fmtPrice(150-parseFloat(currentBook?.preco||0))} para frete grátis</p>` : ''}
      `;
    }, 800);
    // Máscara CEP
    document.getElementById('cep-input').value = cep.replace(/(\d{5})(\d{3})/,'$1-$2');
  }

  /* ── Related ────────────────────────────────────────── */
  function renderRelated(livros, current){
    const filtered = livros.filter(l=>l.id!=current.id).slice(0,4);
    if(!filtered.length) return;
    document.getElementById('related-section').style.display = 'block';
    document.getElementById('related-grid').innerHTML = filtered.map(l=>`
      <div class="related-card" onclick="window.location.href='livro.html?id=${l.id}'">
        <div class="related-cover">
          ${l.capa ? `<img src="${escHtml(l.capa)}" alt="${escHtml(l.titulo)}">` : `<div class="related-cover-ph">${l.titulo.charAt(0)}</div>`}
        </div>
        <div class="related-info">
          <div class="related-title">${escHtml(l.titulo)}</div>
          <div class="related-author">${escHtml(l.autor)}</div>
          <div class="related-price">${fmtPrice(parseFloat(l.preco))}</div>
        </div>
      </div>`).join('');
  }

  /* ── Reviews ────────────────────────────────────────── */
  function renderReviews(bookId){
    let reviews = loadReviews(bookId);

    // Avaliações simuladas se não tiver nenhuma
    if(!reviews.length){
      const nomes = ['Ana Paula','Carlos M.','Fernanda L.','Roberto S.','Juliana C.'];
      const comentarios = [
        'Leitura incrível! Me prendeu do início ao fim. Recomendo muito para quem aprecia boa literatura brasileira.',
        'Obra primorosa. O autor tem uma habilidade única de criar personagens que parecem reais. Já li duas vezes.',
        'Fiquei surpresa com a profundidade da narrativa. Um livro que faz pensar muito após terminar.',
        'Comprei para presentear minha esposa e ela amou! Já pediu mais livros do mesmo autor.',
        'Excelente! A escrita é fluida e envolvente. Terminei em dois dias, não conseguia parar de ler.'
      ];
      const notas = [5,5,4,5,4];
      reviews = nomes.map((n,i)=>({
        nome: n,
        nota: notas[i],
        comentario: comentarios[i],
        data: new Date(Date.now() - (i+1)*7*24*3600*1000).toLocaleDateString('pt-BR')
      }));
    }

    // Distribuição de notas
    const dist = {5:0,4:0,3:0,2:0,1:0};
    reviews.forEach(r=>dist[r.nota]++);
    const total = reviews.length;
    const avgR = reviews.reduce((s,r)=>s+r.nota,0)/total;
    document.getElementById('rating-distribution').innerHTML = `
      <div class="dist-summary">
        <div class="dist-big">${avgR.toFixed(1)}</div>
        <div class="dist-stars">${'★'.repeat(Math.round(avgR))}${'☆'.repeat(5-Math.round(avgR))}</div>
        <div class="dist-total">${total} avaliações</div>
      </div>
      <div class="dist-bars">
        ${[5,4,3,2,1].map(n=>`
          <div class="dist-row">
            <span class="dist-label">${n}★</span>
            <div class="dist-bar-wrap"><div class="dist-bar" style="width:${total?Math.round(dist[n]/total*100):0}%"></div></div>
            <span class="dist-num">${dist[n]}</span>
          </div>`).join('')}
      </div>`;

    // Lista
    document.getElementById('reviews-list').innerHTML = reviews.map(r=>`
      <div class="review-card">
        <div class="review-header">
          <div class="review-avatar">${r.nome.charAt(0)}</div>
          <div>
            <div class="review-name">${escHtml(r.nome)}</div>
            <div class="review-date">${r.data || 'Recente'}</div>
          </div>
          <div class="review-stars">${'★'.repeat(r.nota)}${'☆'.repeat(5-r.nota)}</div>
        </div>
        <p class="review-comment">${escHtml(r.comentario)}</p>
      </div>`).join('');
  }

  /* ── Star picker ────────────────────────────────────── */
  document.querySelectorAll('.star-pick').forEach(s=>{
    s.addEventListener('mouseover',()=>highlightStars(+s.dataset.val));
    s.addEventListener('mouseout', ()=>highlightStars(selectedRating));
    s.addEventListener('click',   ()=>{ selectedRating=+s.dataset.val; highlightStars(selectedRating); });
  });
  function highlightStars(n){
    document.querySelectorAll('.star-pick').forEach((s,i)=>{
      s.style.color = i<n ? 'var(--gold)' : 'var(--border-light)';
    });
  }
  highlightStars(0);

  /* ── Submit review ──────────────────────────────────── */
  function submitReview(){
    const nome = document.getElementById('review-name').value.trim();
    const comentario = document.getElementById('review-comment').value.trim();
    if(!nome){ toast('Digite seu nome','error'); return; }
    if(!selectedRating){ toast('Selecione uma nota de 1 a 5 estrelas','error'); return; }
    if(!comentario || comentario.length < 10){ toast('Escreva um comentário com pelo menos 10 caracteres','error'); return; }
    const id = getBookId();
    const reviews = loadReviews(id);
    reviews.unshift({ nome, nota: selectedRating, comentario, data: new Date().toLocaleDateString('pt-BR') });
    saveReviews(id, reviews);
    renderReviews(id);
    document.getElementById('review-name').value = '';
    document.getElementById('review-comment').value = '';
    selectedRating = 0;
    highlightStars(0);
    toast('Avaliação publicada! Obrigado 🎉');
  }

  /* ── Qty ────────────────────────────────────────────── */
  function changeQty(delta){
    if(!currentBook) return;
    qty = Math.max(1, Math.min(currentBook.estoque, qty+delta));
    updateQtyUI();
  }
  function updateQtyUI(){
    document.getElementById('qty-value').textContent = qty;
    document.getElementById('qty-minus').disabled = qty<=1;
    document.getElementById('qty-plus').disabled  = !currentBook || qty>=currentBook.estoque;
  }

  /* ── Add to cart ────────────────────────────────────── */
  function addToCart(){
    if(!currentBook) return;
    const b = currentBook;
    const existing = cart.find(i=>i.id===b.id);
    if(existing){ existing.quantidade = Math.min(b.estoque, existing.quantidade+qty); }
    else { cart.push({id:b.id, titulo:b.titulo, autor:b.autor, preco:parseFloat(b.preco), capa:b.capa||null, quantidade:qty}); }
    saveCart(); updateCartUI();
    const btn = document.getElementById('btn-add-cart');
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Adicionado!`;
    btn.style.background = '#166534';
    setTimeout(()=>{
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0"/></svg> Adicionar ao carrinho`;
      btn.style.background = '';
    }, 2000);
    toast(`"${b.titulo}" adicionado ao carrinho`);
  }

  /* ── Buy now ────────────────────────────────────────── */
  function buyNow(){
    addToCart();
    setTimeout(openCheckout, 300);
  }

  /* ── Wishlist ───────────────────────────────────────── */
  function toggleWishlist(){
    if(!currentBook) return;
    const id = currentBook.id;
    const idx = wishlist.indexOf(id);
    if(idx >= 0){ wishlist.splice(idx,1); toast('Removido dos favoritos'); }
    else { wishlist.push(id); toast('Adicionado aos favoritos ❤️'); }
    saveWishlist(); updateWishlistBtn();
  }
  function updateWishlistBtn(){
    if(!currentBook) return;
    const inWishlist = wishlist.includes(currentBook.id);
    const icon = document.getElementById('wishlist-icon');
    if(icon){ icon.style.fill = inWishlist ? 'var(--red)' : 'none'; icon.style.stroke = inWishlist ? 'var(--red)' : 'currentColor'; }
  }

  /* ── Share ──────────────────────────────────────────── */
  function shareWhatsApp(){
    const txt = encodeURIComponent(`Confira "${currentBook?.titulo}" na Beaver Books: ${window.location.href}`);
    window.open(`https://wa.me/?text=${txt}`, '_blank');
  }
  function shareInstagram(){
    navigator.clipboard.writeText(window.location.href);
    toast('Link copiado! Cole no Instagram Stories 📸');
  }
  function shareLink(){
    navigator.clipboard.writeText(window.location.href);
    toast('Link copiado para a área de transferência!');
  }

  /* ── Scroll helpers ─────────────────────────────────── */
  function scrollToReviews(){ document.getElementById('reviews-section').scrollIntoView({behavior:'smooth',block:'start'}); }
  function scrollToAuthor(){   document.getElementById('author-section').scrollIntoView({behavior:'smooth',block:'start'}); }

  /* ── Cart UI ────────────────────────────────────────── */
  function updateCartUI(){
    const count = cartCount();
    const badge = document.getElementById('cart-badge');
    if(badge){ badge.textContent=count; badge.classList.toggle('hidden',count===0); }
    document.getElementById('cart-total-value').textContent = fmtPrice(cartTotal());
    document.getElementById('checkout-btn').disabled = !cart.length;
    renderCartItems();
  }

  function renderCartItems(){
    const list = document.getElementById('cart-items');
    if(!cart.length){
      list.innerHTML = `<div class="cart-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0"/></svg>
        <p>Carrinho vazio.<br>Explore nosso catálogo!</p>
      </div>`; return;
    }
    list.innerHTML = cart.map(item=>`
      <div class="cart-item">
        ${item.capa ? `<img class="cart-item-thumb" src="${escHtml(item.capa)}" alt="">` : `<div class="cart-item-thumb-placeholder"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 004 17V5a2 2 0 012-2h14a2 2 0 012 2v12"/></svg></div>`}
        <div class="cart-item-body">
          <div class="cart-item-title">${escHtml(item.titulo)}</div>
          <div class="cart-item-author">${escHtml(item.autor)}</div>
          <div class="cart-item-controls">
            <button class="qty-btn" onclick="cartChange(${item.id},-1)">−</button>
            <span class="qty-display">${item.quantidade}</span>
            <button class="qty-btn" onclick="cartChange(${item.id},1)">+</button>
            <span class="cart-item-price">${fmtPrice(item.preco*item.quantidade)}</span>
            <button class="remove-item-btn" onclick="cartRemove(${item.id})"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
          </div>
        </div>
      </div>`).join('');
  }

  function cartChange(id,delta){ const item=cart.find(i=>i.id===id); if(!item)return; item.quantidade=Math.max(1,item.quantidade+delta); saveCart(); updateCartUI(); }
  function cartRemove(id){ cart=cart.filter(i=>i.id!==id); saveCart(); updateCartUI(); toast('Item removido.'); }
  function openCart(){ document.getElementById('cart-overlay').classList.add('open'); document.getElementById('cart-sidebar').classList.add('open'); document.body.style.overflow='hidden'; renderCartItems(); }
  function closeCart(){ document.getElementById('cart-overlay').classList.remove('open'); document.getElementById('cart-sidebar').classList.remove('open'); document.body.style.overflow=''; }

  /* ── Checkout ───────────────────────────────────────── */
  function openCheckout(){
    closeCart();
    const mc = document.getElementById('modal-content');
    const summaryLines = cart.map(i=>`<div class="order-summary-line"><span>${escHtml(i.titulo)} × ${i.quantidade}</span><span>${fmtPrice(i.preco*i.quantidade)}</span></div>`).join('');
    const total = cartTotal();
    const desconto = appliedDiscount ? total * appliedDiscount/100 : 0;
    const totalFinal = total - desconto;
    mc.innerHTML = `
      <h2>Finalizar pedido</h2>
      <p class="modal-subtitle">Preencha seus dados para confirmar.</p>
      <div class="order-summary">
        ${summaryLines}
        ${desconto ? `<div class="order-summary-line" style="color:#22c55e"><span>Desconto (${appliedDiscount}%)</span><span>− ${fmtPrice(desconto)}</span></div>` : ''}
        <div class="order-summary-line total"><span>Total</span><span>${fmtPrice(totalFinal)}</span></div>
      </div>
      <form id="checkout-form" novalidate>
        <div class="form-group"><label>Nome completo *</label><input type="text" id="cn" placeholder="Seu nome" required></div>
        <div class="form-group"><label>E-mail *</label><input type="email" id="ce" placeholder="seu@email.com" required></div>
        <div class="modal-actions">
          <button type="button" class="modal-cancel-btn" onclick="closeModal()">Cancelar</button>
          <button type="submit" class="modal-confirm-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            Confirmar pedido
          </button>
        </div>
      </form>`;
    document.getElementById('modal-overlay').classList.add('open');
    document.body.style.overflow='hidden';
    document.getElementById('checkout-form').addEventListener('submit', async(e)=>{
      e.preventDefault();
      const nome=document.getElementById('cn').value.trim();
      const email=document.getElementById('ce').value.trim();
      if(!nome||!email||!email.includes('@')){ toast('Preencha todos os campos.','error'); return; }
      const btn=e.target.querySelector('.modal-confirm-btn');
      btn.disabled=true; btn.textContent='Processando…';
      try{
        const res=await fetch(`${API}/orders`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cliente_nome:nome,cliente_email:email,itens:cart.map(i=>({livro_id:i.id,quantidade:i.quantidade}))})});
        const data=await res.json();
        if(!res.ok||!data.ok) throw new Error(data.erro||'Erro ao processar.');
        cart=[]; saveCart(); updateCartUI(); appliedDiscount=0;
        mc.innerHTML=`<div class="success-state"><div class="success-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></div><h3>Pedido confirmado!</h3><p>Obrigado, ${escHtml(nome)}!</p><p style="margin-bottom:24px">Entraremos em contato em breve.</p><p style="font-size:13px;color:var(--text-dim);margin-bottom:24px">Nº do pedido: <strong>#${data.pedido_id}</strong></p><button onclick="closeModal()" style="background:var(--red);border:none;border-radius:var(--radius);padding:11px 24px;color:#fff;font-weight:600;cursor:pointer">Continuar comprando</button></div>`;
      }catch(err){ toast(err.message,'error'); btn.disabled=false; btn.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg> Confirmar pedido'; }
    });
  }
  function closeModal(){ document.getElementById('modal-overlay').classList.remove('open'); document.body.style.overflow=''; }

  /* ── Events ─────────────────────────────────────────── */
  document.getElementById('cart-btn').addEventListener('click', openCart);
  document.getElementById('cart-close-btn').addEventListener('click', closeCart);
  document.getElementById('cart-overlay').addEventListener('click', closeCart);
  document.getElementById('checkout-btn').addEventListener('click', openCheckout);
  document.getElementById('modal-overlay').addEventListener('click', e=>{ if(e.target===document.getElementById('modal-overlay')) closeModal(); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ closeCart(); closeModal(); }});
  window.addEventListener('storage', e=>{ if(e.key==='beaver_cart'){ cart=loadCart(); updateCartUI(); }});
  // CEP mask
  document.getElementById('cep-input').addEventListener('input', e=>{
    e.target.value = e.target.value.replace(/\D/g,'').replace(/(\d{5})(\d{1,3})/,'$1-$2');
  });

  /* ── Init ────────────────────────────────────────────── */
  updateCartUI();
  loadBook();