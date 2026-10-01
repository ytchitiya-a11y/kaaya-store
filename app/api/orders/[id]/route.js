const { NextResponse } = require('next/server');
const { updateOrderStatus } = require('../../../../lib/db');
const { requireAdmin } = require('../../../../lib/requireAdmin');

async function PATCH(request, { params }) {
  const session = requireAdmin(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (!body.status) return NextResponse.json({ error: 'Status is required' }, { status: 400 });

  await updateOrderStatus(id, body.status);
  return NextResponse.json({ ok: true });
}

module.exports = { PATCH };
