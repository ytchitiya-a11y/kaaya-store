'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

function fmtPrice(n) { return '$' + Number(n).toLocaleString('en-US'); }

export default function AdminDashboard({ initialCategories, initialProducts, initialOrders, initialReviews, adminUsername }) {
  const router = useRouter();
  const [tab, setTab] = useState('categories');
  const [categories, setCategories] = useState(initialCategories);
  const [products, setProducts] = useState(initialProducts);
  const [orders, setOrders] = useState(initialOrders);
  const [reviews, setReviews] = useState(initialReviews);
  const [toast, setToast] = useState('');

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2500); }

  async function refreshAll() {
    const [c, p, o, r] = await Promise.all([
      fetch('/api/categories').then(r => r.json()),
      fetch('/api/products?admin=1').then(r => r.json()),
      fetch('/api/orders').then(r => r.json()),
      fetch('/api/reviews').then(r => r.json()),
    ]);
    setCategories(c); setProducts(p); setOrders(o); setReviews(r);
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  return (
    <div className="admin-shell">
      <div className="admin-top">
        <div className="wordmark">KAAYA <span>ADMIN — {adminUsername}</span></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <a className="icon-btn" style={{ borderColor: '#3B4A60', color: '#EDE7D9' }} href="/">View store</a>
          <button className="icon-btn" style={{ borderColor: '#3B4A60', color: '#EDE7D9' }} onClick={logout}>Log out</button>
        </div>
      </div>
      <div className="admin-body">
        <div className="admin-tabs">
          <button className={tab === 'categories' ? 'active' : ''} onClick={() => setTab('categories')}>Categories</button>
          <button className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}>Products</button>
          <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>Orders</button>
          <button className={tab === 'reviews' ? 'active' : ''} onClick={() => setTab('reviews')}>Reviews</button>
        </div>

        {tab === 'categories' && <CategoriesPanel categories={categories} refreshAll={refreshAll} showToast={showToast} />}
        {tab === 'products' && <ProductsPanel products={products} categories={categories} refreshAll={refreshAll} showToast={showToast} />}
        {tab === 'orders' && <OrdersPanel orders={orders} refreshAll={refreshAll} showToast={showToast} />}
        {tab === 'reviews' && <ReviewsPanel reviews={reviews} refreshAll={refreshAll} showToast={showToast} />}
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

// Uploads a file to Cloudinary via our API route. Returns { url, publicId }.
async function uploadFile(file) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/upload', { method: 'POST', body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return { url: data.url, publicId: data.publicId };
}

function CategoriesPanel({ categories, refreshAll, showToast }) {
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    setError('');
    if (!name.trim()) { setError('Category name is required'); return; }
    setSaving(true);
    try {
      let banner = '';
      if (file) { const up = await uploadFile(file); banner = up.url; }
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), banner }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not save'); setSaving(false); return; }
      setName(''); setFile(null);
      await refreshAll();
      showToast('Category added');
    } catch (e) {
      setError(e.message || 'Upload or save failed, try again');
    }
    setSaving(false);
  }

  async function remove(id) {
    if (!confirm('Delete this category? Its products will move to Uncategorized.')) return;
    await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    await refreshAll();
    showToast('Category removed');
  }

  return (
    <>
      <div className="admin-card">
        <h3>Add a category</h3>
        <div className="a-row">
          <div className="a-field"><label>Category name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Kurtas, Jackets, Sarees" /></div>
          <div className="a-field"><label>Banner image (optional, uploads to Cloudinary)</label><input type="file" accept="image/*" onChange={e => setFile(e.target.files[0])} /></div>
        </div>
        {error && <div className="err" style={{ marginBottom: 10 }}>{error}</div>}
        <button className="save-btn" onClick={save} disabled={saving}>{saving ? 'Uploading…' : 'Add category'}</button>
      </div>
      <div className="admin-card">
        <h3>Existing categories</h3>
        <table className="admin-table">
          <thead><tr><th></th><th>Name</th><th></th></tr></thead>
          <tbody>
            {categories.map(c => (
              <tr key={c.id}>
                <td>{c.banner ? <img src={c.banner} /> : null}</td>
                <td>{c.name}</td>
                <td><button className="del-btn" onClick={() => remove(c.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!categories.length && <div className="empty-admin">No categories yet — add one above before adding products.</div>}
      </div>
    </>
  );
}

const emptyProductForm = { name: '', price: '', comparePrice: '', categoryId: '', stockQty: '', sku: '', description: '', videoUrl: '' };

function ProductsPanel({ products, categories, refreshAll, showToast }) {
  const [form, setForm] = useState(emptyProductForm);
  const [imageFiles, setImageFiles] = useState([]);
  const [existingImages, setExistingImages] = useState([]); // [{url, publicId}]
  const [videoFile, setVideoFile] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function startEdit(p) {
    setEditingId(p.id);
    setForm({
      name: p.name, price: p.price, comparePrice: p.compare_price || '', categoryId: p.category_id || '',
      stockQty: p.stock_qty, sku: p.sku || '', description: p.description || '',
      videoUrl: p.videos?.[0]?.url || '',
    });
    setExistingImages(p.images?.map(i => ({ url: i.url, publicId: i.public_id })) || []);
    setImageFiles([]);
    setVideoFile(null);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function cancelEdit() {
    setEditingId(null);
    setForm(emptyProductForm);
    setImageFiles([]);
    setExistingImages([]);
    setVideoFile(null);
    setError('');
  }

  async function save() {
    setError('');
    if (!form.name.trim() || !form.price) { setError('Name and price are required'); return; }
    if (!form.categoryId) { setError('Please add and select a category first'); return; }
    setSaving(true);
    try {
      let images = [...existingImages];
      for (const f of imageFiles) {
        const up = await uploadFile(f);
        images.push(up);
      }
      let video = form.videoUrl ? { url: form.videoUrl, publicId: null } : null;
      if (videoFile) {
        video = await uploadFile(videoFile);
      }

      const payload = {
        name: form.name.trim(),
        price: Number(form.price),
        comparePrice: form.comparePrice ? Number(form.comparePrice) : null,
        categoryId: form.categoryId,
        stockQty: Number(form.stockQty) || 0,
        sku: form.sku.trim() || null,
        description: form.description.trim(),
        images,
        video,
      };

      const res = editingId
        ? await fetch(`/api/products/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not save product'); setSaving(false); return; }

      showToast(editingId ? 'Product updated' : 'Product added');
      cancelEdit();
      await refreshAll();
    } catch (e) {
      setError(e.message || 'Upload or save failed, try again');
    }
    setSaving(false);
  }

  async function remove(id) {
    if (!confirm('Delete this product?')) return;
    await fetch(`/api/products/${id}`, { method: 'DELETE' });
    await refreshAll();
    showToast('Product deleted');
  }

  return (
    <>
      <div className="admin-card">
        <h3>{editingId ? 'Edit product' : 'Add a new product'}</h3>
        <div className="a-row">
          <div className="a-field"><label>Name</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Indigo kurta" /></div>
          <div className="a-field"><label>Price ($)</label><input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="49" /></div>
        </div>
        <div className="a-row">
          <div className="a-field"><label>Compare-at price (optional)</label><input type="number" value={form.comparePrice} onChange={e => setForm({ ...form, comparePrice: e.target.value })} placeholder="69" /></div>
          <div className="a-field"><label>Stock quantity</label><input type="number" value={form.stockQty} onChange={e => setForm({ ...form, stockQty: e.target.value })} placeholder="20" /></div>
        </div>
        <div className="a-row">
          <div className="a-field">
            <label>Category</label>
            <select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">{categories.length ? 'Select category' : 'Add a category first'}</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="a-field"><label>SKU (optional)</label><input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} placeholder="KY-001" /></div>
        </div>
        <div className="a-field"><label>Description</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Fabric, fit, care instructions..." /></div>

        <div className="a-field">
          <label>Product photos (uploads to Cloudinary, multiple allowed)</label>
          <input type="file" accept="image/*" multiple onChange={e => setImageFiles(Array.from(e.target.files))} />
          {existingImages.length > 0 && (
            <div className="thumb-row">
              {existingImages.map((img, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={img.url} />
                  <button type="button" onClick={() => setExistingImages(existingImages.filter((_, idx) => idx !== i))}
                    style={{ position: 'absolute', top: -6, right: -6, background: 'var(--rust)', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: 11, lineHeight: '18px' }}>✕</button>
                </div>
              ))}
            </div>
          )}
          <div className="hint">First photo becomes the main thumbnail. Existing photos stay unless you remove them.</div>
        </div>

        <div className="a-field">
          <label>Video (optional) — file (uploads to Cloudinary) or link</label>
          <input type="file" accept="video/*" onChange={e => setVideoFile(e.target.files[0])} />
          <input type="text" value={form.videoUrl} onChange={e => setForm({ ...form, videoUrl: e.target.value })} placeholder="Or paste a video link here" style={{ marginTop: 8 }} />
        </div>

        {error && <div className="err" style={{ marginBottom: 10 }}>{error}</div>}
        <button className="save-btn" onClick={save} disabled={saving}>{saving ? 'Uploading…' : (editingId ? 'Update product' : 'Save product')}</button>
        {editingId && <button className="cancel-btn" onClick={cancelEdit}>Cancel edit</button>}
      </div>

      <div className="admin-card">
        <h3>All products</h3>
        <table className="admin-table">
          <thead><tr><th></th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th></th></tr></thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id}>
                <td>{p.images?.[0] ? <img src={p.images[0].url} /> : null}</td>
                <td>{p.name}</td>
                <td>{p.category_name || 'Uncategorized'}</td>
                <td>{fmtPrice(p.price)}</td>
                <td>{p.stock_qty}</td>
                <td>
                  <button className="edit-btn" onClick={() => startEdit(p)}>Edit</button>
                  <button className="del-btn" onClick={() => remove(p.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!products.length && <div className="empty-admin">No products added yet.</div>}
      </div>
    </>
  );
}

function OrdersPanel({ orders, refreshAll, showToast }) {
  async function updateStatus(id, status) {
    await fetch(`/api/orders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    await refreshAll();
    showToast('Order updated');
  }

  return (
    <div className="admin-card">
      <h3>All orders</h3>
      <table className="admin-table">
        <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th></tr></thead>
        <tbody>
          {orders.map(o => (
            <tr key={o.id}>
              <td>{o.order_number}<div className="hint">{new Date(o.created_at).toLocaleDateString()}</div></td>
              <td>{o.customer_name}<div className="hint">{o.customer_phone}</div></td>
              <td>{o.items.map(i => `${i.product_name} x${i.quantity}`).join(', ')}</td>
              <td>{fmtPrice(o.total_amount)}</td>
              <td>
                <select value={o.status} onChange={e => updateStatus(o.id, e.target.value)}>
                  {['New', 'Packing', 'Shipped', 'Delivered', 'Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!orders.length && <div className="empty-admin">No orders yet.</div>}
    </div>
  );
}

function ReviewsPanel({ reviews, refreshAll, showToast }) {
  async function approve(id, approved) {
    await fetch(`/api/reviews/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approved }) });
    await refreshAll();
    showToast(approved ? 'Review approved' : 'Review hidden');
  }
  async function remove(id) {
    if (!confirm('Delete this review?')) return;
    await fetch(`/api/reviews/${id}`, { method: 'DELETE' });
    await refreshAll();
    showToast('Review deleted');
  }

  return (
    <div className="admin-card">
      <h3>Customer reviews</h3>
      <table className="admin-table">
        <thead><tr><th>Product</th><th>Customer</th><th>Rating</th><th>Comment</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {reviews.map(r => (
            <tr key={r.id}>
              <td>{r.product_name}</td>
              <td>{r.customer_name}</td>
              <td>{'★'.repeat(r.rating)}</td>
              <td>{r.comment}</td>
              <td>{r.is_approved ? 'Live' : 'Pending'}</td>
              <td>
                {!r.is_approved && <button className="approve-btn" onClick={() => approve(r.id, true)}>Approve</button>}
                {r.is_approved && <button className="edit-btn" onClick={() => approve(r.id, false)}>Hide</button>}
                <button className="del-btn" onClick={() => remove(r.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!reviews.length && <div className="empty-admin">No reviews yet.</div>}
    </div>
  );
}
