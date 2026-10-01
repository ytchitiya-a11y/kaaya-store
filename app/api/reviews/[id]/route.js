const { NextResponse } = require('next/server');
const { createReview, getAllReviews, getApprovedReviews } = require('../../../lib/db');
const { requireAdmin } = require('../../../lib/requireAdmin');

async function GET(request) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get('productId');

  if (productId) {
    return NextResponse.json(await getApprovedReviews(productId));
  }

  const session = requireAdmin(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await getAllReviews());
}

async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { productId, customerName, rating, comment } = body;

  if (!productId || !customerName || !rating) {
    return NextResponse.json({ error: 'Name and rating are required' }, { status: 400 });
  }
  if (rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
  }

  await createReview({ productId, customerName, rating, comment });
  return NextResponse.json({ ok: true, message: 'Thanks! Your review will appear after admin approval.' }, { status: 201 });
}

module.exports = { GET, POST };
