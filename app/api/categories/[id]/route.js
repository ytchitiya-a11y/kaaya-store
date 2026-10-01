const { NextResponse } = require('next/server');
const { deleteCategory } = require('../../../../lib/db');
const { requireAdmin } = require('../../../../lib/requireAdmin');

async function DELETE(request, { params }) {
  const session = requireAdmin(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await deleteCategory(id);
  return NextResponse.json({ ok: true });
}

module.exports = { DELETE };
