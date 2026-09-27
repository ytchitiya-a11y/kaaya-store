const { Pool } = require('pg');

if (!global._kaayaPgPool) {
  if (!process.env.DATABASE_URL) {
    console.warn('WARNING: DATABASE_URL is not set. Set it in .env.local (see .env.example).');
  }
  global._kaayaPgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
  });
}
const pool = global._kaayaPgPool;

function slugify(str) {
  return String(str).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// ---------------- ADMIN ----------------
async function getAdminByUsername(username) {
  const { rows } = await pool.query('SELECT * FROM admins WHERE username = $1', [username]);
  return rows[0] || null;
}
async function createAdmin({ username, email, passwordHash }) {
  const { rows } = await pool.query(
    'INSERT INTO admins (username, email, password_hash) VALUES ($1,$2,$3) RETURNING id',
    [username, email, passwordHash]
  );
  return rows[0].id;
}

// ---------------- CATEGORIES ----------------
async function getCategories() {
  const { rows } = await pool.query('SELECT * FROM categories ORDER BY created_at DESC');
  return rows;
}
async function getCategoryById(id) {
  const { rows } = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
  return rows[0] || null;
}
async function createCategory({ name, banner, description }) {
  let slug = slugify(name);
  const exists = await pool.query('SELECT id FROM categories WHERE slug = $1', [slug]);
  if (exists.rows.length) slug = slug + '-' + Date.now().toString(36).slice(-4);
  const { rows } = await pool.query(
    'INSERT INTO categories (name, slug, banner, description) VALUES ($1,$2,$3,$4) RETURNING *',
    [name, slug, banner || null, description || null]
  );
  return rows[0];
}
async function deleteCategory(id) {
  await pool.query('UPDATE products SET category_id = NULL WHERE category_id = $1', [id]);
  await pool.query('DELETE FROM categories WHERE id = $1', [id]);
}

// ---------------- PRODUCTS ----------------
function normalizeProductNumbers(row) {
  if (!row) return row;
  row.price = parseFloat(row.price);
  row.compare_price = row.compare_price != null ? parseFloat(row.compare_price) : null;
  return row;
}

async function attachImagesVideosReviews(product) {
  if (!product) return product;
  normalizeProductNumbers(product);
  const [imgRes, vidRes, catRes, revRes] = await Promise.all([
    pool.query('SELECT * FROM product_images WHERE product_id = $1 ORDER BY sort_order ASC', [product.id]),
    pool.query('SELECT * FROM product_videos WHERE product_id = $1', [product.id]),
    product.category_id ? pool.query('SELECT name FROM categories WHERE id = $1', [product.category_id]) : Promise.resolve({ rows: [] }),
    pool.query('SELECT COUNT(*)::int as count, AVG(rating)::float as avg FROM reviews WHERE product_id = $1 AND is_approved = true', [product.id]),
  ]);
  product.images = imgRes.rows;
  product.videos = vidRes.rows;
  product.category_name = catRes.rows[0]?.name || null;
  product.review_count = revRes.rows[0]?.count || 0;
  product.review_avg = revRes.rows[0]?.avg ? Math.round(revRes.rows[0].avg * 10) / 10 : null;
  return product;
}

async function getProducts({ categoryId, search, activeOnly } = {}) {
  let sql = 'SELECT * FROM products WHERE 1=1';
  const params = [];
  if (activeOnly) sql += ' AND is_active = true';
  if (categoryId) { params.push(categoryId); sql += ` AND category_id = $${params.length}`; }
  if (search) {
    params.push(`%${search}%`);
    sql += ` AND (name ILIKE $${params.length} OR description ILIKE $${params.length})`;
  }
  sql += ' ORDER BY created_at DESC';
  const { rows } = await pool.query(sql, params);
  return Promise.all(rows.map(attachImagesVideosReviews));
}
async function getProductById(id) {
  const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
  return attachImagesVideosReviews(rows[0] || null);
}
async function createProduct(data) {
  let slug = slugify(data.name);
  const exists = await pool.query('SELECT id FROM products WHERE slug = $1', [slug]);
  if (exists.rows.length) slug = slug + '-' + Date.now().toString(36).slice(-4);

  const { rows } = await pool.query(
    `INSERT INTO products (category_id, name, slug, description, price, compare_price, stock_qty, sku, is_active, meta_title, meta_description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [data.categoryId || null, data.name, slug, data.description || '', data.price, data.comparePrice || null,
     data.stockQty ?? 0, data.sku || null, data.isActive === false ? false : true,
     data.metaTitle || data.name, data.metaDescription || (data.description || '').slice(0, 150)]
  );
  const id = rows[0].id;

  const images = data.images || [];
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const url = typeof img === 'string' ? img : img.url;
    const publicId = typeof img === 'string' ? null : img.publicId;
    await pool.query('INSERT INTO product_images (product_id, url, public_id, is_primary, sort_order) VALUES ($1,$2,$3,$4,$5)',
      [id, url, publicId, i === 0, i]);
  }
  if (data.video) {
    const url = typeof data.video === 'string' ? data.video : data.video.url;
    const publicId = typeof data.video === 'string' ? null : data.video.publicId;
    await pool.query('INSERT INTO product_videos (product_id, url, public_id) VALUES ($1,$2,$3)', [id, url, publicId]);
  }
  return getProductById(id);
}
async function updateProduct(id, data) {
  const existing = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
  if (!existing.rows.length) return null;
  const p = existing.rows[0];

  await pool.query(
    `UPDATE products SET category_id=$1, name=$2, description=$3, price=$4, compare_price=$5, stock_qty=$6, sku=$7, is_active=$8, meta_title=$9, meta_description=$10, updated_at=now() WHERE id=$11`,
    [data.categoryId ?? p.category_id, data.name ?? p.name, data.description ?? p.description, data.price ?? p.price,
     data.comparePrice ?? p.compare_price, data.stockQty ?? p.stock_qty, data.sku ?? p.sku,
     data.isActive === false ? false : true, data.metaTitle ?? p.meta_title, data.metaDescription ?? p.meta_description, id]
  );

  if (data.images) {
    await pool.query('DELETE FROM product_images WHERE product_id = $1', [id]);
    for (let i = 0; i < data.images.length; i++) {
      const img = data.images[i];
      const url = typeof img === 'string' ? img : img.url;
      const publicId = typeof img === 'string' ? null : img.publicId;
      await pool.query('INSERT INTO product_images (product_id, url, public_id, is_primary, sort_order) VALUES ($1,$2,$3,$4,$5)',
        [id, url, publicId, i === 0, i]);
    }
  }
  if (data.video !== undefined) {
    await pool.query('DELETE FROM product_videos WHERE product_id = $1', [id]);
    if (data.video) {
      const url = typeof data.video === 'string' ? data.video : data.video.url;
      const publicId = typeof data.video === 'string' ? null : data.video.publicId;
      await pool.query('INSERT INTO product_videos (product_id, url, public_id) VALUES ($1,$2,$3)', [id, url, publicId]);
    }
  }
  return getProductById(id);
}
async function deleteProduct(id) {
  await pool.query('DELETE FROM products WHERE id = $1', [id]);
}

// ---------------- REVIEWS ----------------
async function createReview({ productId, customerName, rating, comment }) {
  await pool.query('INSERT INTO reviews (product_id, customer_name, rating, comment, is_approved) VALUES ($1,$2,$3,$4,false)',
    [productId, customerName, rating, comment || '']);
}
async function getApprovedReviews(productId) {
  const { rows } = await pool.query('SELECT * FROM reviews WHERE product_id = $1 AND is_approved = true ORDER BY created_at DESC', [productId]);
  return rows;
}
async function getAllReviews() {
  const { rows } = await pool.query(
    `SELECT r.*, p.name as product_name FROM reviews r JOIN products p ON p.id = r.product_id ORDER BY r.created_at DESC`
  );
  return rows;
}
async function setReviewApproval(id, approved) {
  await pool.query('UPDATE reviews SET is_approved = $1 WHERE id = $2', [approved, id]);
}
async function deleteReview(id) {
  await pool.query('DELETE FROM reviews WHERE id = $1', [id]);
}

// ---------------- ORDERS ----------------
async function placeOrder(data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const item of data.items) {
      const { rows } = await client.query('SELECT stock_qty FROM products WHERE id = $1 FOR UPDATE', [item.productId]);
      if (rows.length && rows[0].stock_qty < item.quantity) {
        throw new Error(`OUT_OF_STOCK:${item.productName}`);
      }
    }

    const orderNumber = 'KY-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000);
    const orderRes = await client.query(
      `INSERT INTO orders (order_number, customer_name, customer_phone, customer_address, payment_method, status, total_amount)
       VALUES ($1,$2,$3,$4,'COD','New',$5) RETURNING id`,
      [orderNumber, data.customerName, data.customerPhone, data.customerAddress, data.total]
    );
    const orderId = orderRes.rows[0].id;

    for (const item of data.items) {
      await client.query('INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity) VALUES ($1,$2,$3,$4,$5)',
        [orderId, item.productId, item.productName, item.price, item.quantity]);
      if (item.productId) {
        await client.query('UPDATE products SET stock_qty = stock_qty - $1 WHERE id = $2', [item.quantity, item.productId]);
      }
    }

    await client.query('COMMIT');
    return { orderId, orderNumber };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
function normalizeOrderNumbers(order) {
  order.total_amount = parseFloat(order.total_amount);
  if (order.items) {
    order.items.forEach(i => { i.unit_price = parseFloat(i.unit_price); });
  }
  return order;
}

async function getOrders() {
  const { rows: orders } = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
  for (const o of orders) {
    const { rows } = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [o.id]);
    o.items = rows;
    normalizeOrderNumbers(o);
  }
  return orders;
}
async function getOrdersByPhone(phone) {
  const { rows: orders } = await pool.query('SELECT * FROM orders WHERE customer_phone = $1 ORDER BY created_at DESC', [phone]);
  for (const o of orders) {
    const { rows } = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [o.id]);
    o.items = rows;
    normalizeOrderNumbers(o);
  }
  return orders;
}
async function updateOrderStatus(id, status) {
  await pool.query('UPDATE orders SET status = $1, updated_at = now() WHERE id = $2', [status, id]);
}

module.exports = {
  pool,
  getAdminByUsername, createAdmin,
  getCategories, createCategory, getCategoryById, deleteCategory,
  getProducts, getProductById, createProduct, updateProduct, deleteProduct,
  createReview, getApprovedReviews, getAllReviews, setReviewApproval, deleteReview,
  placeOrder, getOrders, getOrdersByPhone, updateOrderStatus,
};
