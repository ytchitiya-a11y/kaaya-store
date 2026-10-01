const { NextResponse } = require('next/server');
const { getCategories, createCategory } = require('../../../lib/db');
const { requireAdmin } = require('../../../lib/requireAdmin');

async function GET() {
  return NextResponse.json(await getCategories());
}

async function POST(request) {
  const session = requireAdmin(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
  }
  const category = await createCategory({ name: body.name.trim(), banner: body.banner, description: body.description });
  return NextResponse.json(category, { status: 201 });
}

module.exports = { GET, POST };
