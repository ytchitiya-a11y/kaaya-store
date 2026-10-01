const { NextResponse } = require('next/server');
const { getProductById, updateProduct, deleteProduct } = require('../../../../lib/db');
const { requireAdmin } = require('../../../../lib/requireAdmin');

async function GET(request, { params }) {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(product);
}

async function PUT(request, { params }) {
  const session = requireAdmin(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const updated = await updateProduct(id, body);
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(updated);
}

async function DELETE(request, { params }) {
  const session = requireAdmin(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await deleteProduct(id);
  return NextResponse.json({ ok: true });
}

module.exports = { GET, PUT, DELETE };
