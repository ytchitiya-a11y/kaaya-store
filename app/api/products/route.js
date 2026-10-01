const { NextResponse } = require('next/server');
const { getProducts, createProduct } = require('../../../lib/db');
const { requireAdmin } = require('../../../lib/requireAdmin');

async function GET(request) {
  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get('categoryId') || undefined;
  const search = searchParams.get('search') || undefined;
  const adminView = searchParams.get('admin') === '1';

  const products = await getProducts({ categoryId, search, activeOnly: !adminView });
  return NextResponse.json(products);
}

async function POST(request) {
  const session = requireAdmin(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (!body.name || !body.price) {
    return NextResponse.json({ error: 'Name and price are required' }, { status: 400 });
  }
  const product = await createProduct(body);
  return NextResponse.json(product, { status: 201 });
}

module.exports = { GET, POST };
