'use client';
import { useState, useEffect, useMemo } from 'react';

function fmtPrice(n) { return '$' + Number(n).toLocaleString('en-US'); }

export default function Storefront({ initialCategories, initialProducts }) {
  const [categories] = useState(initialCategories);
  const [products, setProducts] = useState(initialProducts);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState(null);
  const [toast, setToast] = useState('');
  const [placing, setPlacing] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', address: '' });
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    const saved = localStorage.getItem('kaaya_cart');
    if (saved) { try { setCart(JSON.parse(saved)); } catch (e) {} }
  }, []);
  useEffect(() => {
    localStorage.setItem('kaaya_cart', JSON.stringify(cart));
  }, [cart]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  }

  useEffect(() => {
    const t = setTimeout(async () => {
      const params = new URLSearchParams();
      if (activeCategory !== 'all') params.set('categoryId', activeCategory);
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      try {
        const res = await fetch('/api/products?' + params.toString());
        const data = await res.json();
        setProducts(data);
      } catch (e) {}
    }, 250);
    return () => clearTimeout(t);
  }, [activeCategory, searchTerm]);

  const grouped = useMemo(() => {
    if (activeCategory !== 'all' || searchTerm.trim()) {
      return [{ cat: { id: activeCategory, name: activeCategory === 'all' ? 'Search results' : (categories.find(c => c.id === activeCategory)?.name || 'Products') }, items: products }];
    }
    const groups = categories.map(c => ({ cat: c, items: products.filter(p => p.category_id === c.id) }));
    groups.push({ cat: { id: null, name: 'Uncategorized' }, items: products.filter(p => !p.category_id) });
    return groups.filter(g => g.items.length);
  }, [products, categories, activeCategory, searchTerm]);

  function addToCart(product, qty = 1) {
    setCart(prev => {
      const existing = prev.find(c => c.id === product.id);
      if (existing) return prev.map(c => c.id === product.id ? { ...c, qty: c.qty + qty } : c);
      return [...prev, { id: product.id, name: product.name, price: product.price, image: product.images?.[0]?.url || '', qty }];
    });
    showToast('Added to cart');
  }
  function changeQty(id, delta) {
    setCart(prev => prev.map(c => c.id === id ? { ...c, qty: c.qty + delta } : c).filter(c => c.qty > 0));
  }
  function removeFromCart(id) { setCart(prev => prev.filter(c => c.id !== id)); }
  const cartTotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const cartCount = cart.reduce((s, c) => s + c.qty, 0);

  function validateForm() {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Enter your name';
    if (!/^\d{10}$/.test(form.phone.trim())) errs.phone = 'Enter a valid 10-digit phone number';
    if (!form.address.trim()) errs.address = 'Enter your address';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function placeOrder() {
    if (!validateForm()) return;
    setPlacing(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: form.name.trim(),
          customerPhone: form.phone.trim(),
          customerAddress: form.address.trim(),
          items: cart.map(c => ({ productId: c.id, productName: c.name, price: c.price, quantity: c.qty })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'Could not place order'); setPlacing(false); return; }
      setCart([]); setCheckoutOpen(false); setCartOpen(false);
      setForm({ name: '', phone: '', address: '' });
      showToast(`Order confirmed! Your order number is ${data.orderNumber}`);
    } catch (e) {
      showToast('Network error — please try again');
    }
    setPlacing(false);
  }

  return (
    <div>
      <div className="topbar">
        <div className="wordmark">KAAYA <span>CLOTHING STUDIO</span></div>
        <div className="nav-actions">
          <a className="icon-btn" href="/admin/login">Admin</a>
          <button className="icon-btn" onClick={() => setCartOpen(true)}>Cart<span className="cart-count">{cartCount}</span></button>
        </div>
      </div>

      <div className="searchbar">
        <input placeholder="Search products…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      <div className="catnav">
        <button className={activeCategory === 'all' ? 'active' : ''} onClick={() => setActiveCategory('all')}>All</button>
        {categories.map(c => (
          <button key={c.id} className={activeCategory === c.id ? 'active' : ''} onClick={() => setActiveCategory(c.id)}>{c.name}</button>
        ))}
      </div>

      <div className="hero">
        <h1>Clothes that carry a story</h1>
        <p>Hand-picked fabric, cuts made for everyday wear. Browse by category and find your fit.</p>
      </div>

      {!products.length && <div className="empty-state">No products found.</div>}

      {grouped.map(g => (
        <div key={g.cat.id || 'none'}>
          <div className="cat-section">
            <h2>{g.cat.name}</h2>
            <div className="cat-count">{g.items.length} item{g.items.length !== 1 ? 's' : ''}</div>
          </div>
          <div className="grid">
            {g.items.map(p => (
              <div className="card" key={p.id} onClick={() => setQuickViewProduct(p)}>
                <div className="media-wrap">
                  {p.stock_qty <= 0 && <span className="stock-badge">Out of stock</span>}
                  {p.videos?.[0] ? (
                    <video src={p.videos[0].url} muted loop playsInline poster={p.images?.[0]?.url} />
                  ) : (
                    <img src={p.images?.[0]?.url || ''} alt={p.name} />
                  )}
                </div>
                <div className="card-body">
                  <p className="card-name">{p.name}</p>
                  {p.review_count > 0 && <div className="card-rating">★ {p.review_avg} ({p.review_count})</div>}
                  <div className="card-price">
                    {fmtPrice(p.price)}
                    {p.compare_price ? <span className="compare">{fmtPrice(p.compare_price)}</span> : null}
                  </div>
                  <button className="add-btn" disabled={p.stock_qty <= 0} onClick={(e) => { e.stopPropagation(); addToCart(p); }}>
                    {p.stock_qty <= 0 ? 'Out of stock' : 'Add to cart'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {quickViewProduct && (
        <QuickView product={quickViewProduct} onClose={() => setQuickViewProduct(null)} onAddToCart={addToCart} showToast={showToast} />
      )}

      {cartOpen && (
        <>
          <div className="overlay" onClick={() => setCartOpen(false)} />
          <div className="drawer">
            <div className="drawer-head">
              <h2 style={{ margin: 0, fontSize: 20 }}>Your cart</h2>
              <button className="icon-btn" onClick={() => setCartOpen(false)}>Close</button>
            </div>
            <div className="drawer-items">
              {!cart.length && <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>Your cart is empty.</p>}
              {cart.map(c => (
                <div className="drawer-item" key={c.id}>
                  <img src={c.image} alt={c.name} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14 }}>{c.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{fmtPrice(c.price)}</div>
                    <div className="qty-row">
                      <button className="icon-btn" style={{ padding: '2px 8px' }} onClick={() => changeQty(c.id, -1)}>-</button>
                      <span>{c.qty}</span>
                      <button className="icon-btn" style={{ padding: '2px 8px' }} onClick={() => changeQty(c.id, 1)}>+</button>
                      <button className="rm" onClick={() => removeFromCart(c.id)}>Remove</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="drawer-foot">
              <div className="total-row"><span>Total</span><strong>{fmtPrice(cartTotal)}</strong></div>
              <button className="checkout-btn" disabled={!cart.length} onClick={() => setCheckoutOpen(true)}>Checkout</button>
            </div>
          </div>
        </>
      )}

      {checkoutOpen && (
        <div className="modal">
          <div className="modal-box">
            <h2>Delivery details</h2>
            <div className="field">
              <label>Full name</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Priya Sharma" />
              {formErrors.name && <div className="err">{formErrors.name}</div>}
            </div>
            <div className="field">
              <label>Phone number</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="10-digit number" />
              {formErrors.phone && <div className="err">{formErrors.phone}</div>}
            </div>
            <div className="field">
              <label>Full address</label>
              <textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="House no., street, city, ZIP code" />
              {formErrors.address && <div className="err">{formErrors.address}</div>}
            </div>
            <div className="hint">Payment: Cash on Delivery</div>
            <div className="modal-actions">
              <button onClick={() => setCheckoutOpen(false)} disabled={placing}>Back</button>
              <button className="primary" onClick={placeOrder} disabled={placing}>{placing ? 'Placing…' : 'Confirm order'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function QuickView({ product, onClose, onAddToCart, showToast }) {
  const [activeImg, setActiveImg] = useState(product.images?.[0]?.url || '');
  const [reviewForm, setReviewForm] = useState({ name: '', rating: 5, comment: '' });
  const [submitting, setSubmitting] = useState(false);
  const [approvedReviews, setApprovedReviews] = useState([]);

  useEffect(() => {
    fetch(`/api/reviews?productId=${product.id}`).then(r => r.json()).then(setApprovedReviews).catch(() => {});
  }, [product.id]);

  async function submitReview() {
    if (!reviewForm.name.trim()) { showToast('Enter your name'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, customerName: reviewForm.name.trim(), rating: reviewForm.rating, comment: reviewForm.comment.trim() }),
      });
      const data = await res.json();
      if (res.ok) { showToast(data.message || 'Review submitted'); setReviewForm({ name: '', rating: 5, comment: '' }); }
      else { showToast(data.error || 'Could not submit review'); }
    } catch (e) { showToast('Network error'); }
    setSubmitting(false);
  }

  return (
    <div className="qv-modal" onClick={onClose}>
      <div className="qv-box" onClick={e => e.stopPropagation()}>
        <div>
          <div className="qv-media">
            {product.videos?.[0] ? (
              <video src={product.videos[0].url} controls poster={activeImg} />
            ) : (
              <img src={activeImg} alt={product.name} />
            )}
          </div>
          {product.images?.length > 1 && (
            <div className="qv-thumbs">
              {product.images.map(img => (
                <img key={img.id} src={img.url} className={img.url === activeImg ? 'active' : ''} onClick={() => setActiveImg(img.url)} />
              ))}
            </div>
          )}
        </div>
        <div className="qv-info">
          <button className="qv-close" onClick={onClose}>Close ✕</button>
          <div className="qv-cat">{product.category_name || 'Uncategorized'}</div>
          <h2>{product.name}</h2>
          <div className="qv-price">{fmtPrice(product.price)}</div>
          <div className="qv-desc">{product.description || 'No description provided.'}</div>
          <div className="hint" style={{ marginTop: 10 }}>{product.stock_qty > 0 ? `${product.stock_qty} in stock` : 'Out of stock'}</div>
          <button className="add-btn" style={{ marginTop: 16 }} disabled={product.stock_qty <= 0} onClick={() => { onAddToCart(product); onClose(); }}>
            {product.stock_qty <= 0 ? 'Out of stock' : 'Add to cart'}
          </button>

          <div className="qv-reviews">
            <h3>Reviews {approvedReviews.length > 0 ? `(${approvedReviews.length})` : ''}</h3>
            {approvedReviews.map(r => (
              <div className="review-item" key={r.id}>
                <div className="review-stars">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</div>
                <strong>{r.customer_name}</strong>
                {r.comment && <p style={{ margin: '4px 0 0' }}>{r.comment}</p>}
              </div>
            ))}
            {!approvedReviews.length && <p className="hint">No reviews yet — be the first to review this product.</p>}
            <div className="review-form">
              <input placeholder="Your name" value={reviewForm.name} onChange={e => setReviewForm({ ...reviewForm, name: e.target.value })} />
              <div className="stars-input">
                {[1, 2, 3, 4, 5].map(n => (
                  <span key={n} className={n <= reviewForm.rating ? 'active' : ''} onClick={() => setReviewForm({ ...reviewForm, rating: n })}>★</span>
                ))}
              </div>
              <textarea placeholder="Write a review (optional)" value={reviewForm.comment} onChange={e => setReviewForm({ ...reviewForm, comment: e.target.value })} />
              <button className="add-btn" onClick={submitReview} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit review'}</button>
              <div className="hint">Reviews are shown after admin approval.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
