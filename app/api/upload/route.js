const { NextResponse } = require('next/server');
const { requireAdmin } = require('../../../lib/requireAdmin');
const { getCloudinary } = require('../../../lib/cloudinary');

const MAX_SIZE = 15 * 1024 * 1024; // 15MB

function uploadBuffer(cloudinary, buffer, resourceType) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'kaaya-store', resource_type: resourceType },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
}

async function POST(request) {
  const session = requireAdmin(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!process.env.CLOUDINARY_CLOUD_NAME && !process.env.CLOUDINARY_URL) {
    return NextResponse.json({ error: 'Cloudinary is not configured. Set CLOUDINARY_URL (or CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET) in .env.local.' }, { status: 500 });
  }

  const formData = await request.formData();
  const file = formData.get('file');

  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file received' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File is too large (max 15MB)' }, { status: 400 });
  }
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime'];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
  }

  const resourceType = file.type.startsWith('video') ? 'video' : 'image';
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const cloudinary = getCloudinary();
    const result = await uploadBuffer(cloudinary, buffer, resourceType);
    return NextResponse.json({ url: result.secure_url, publicId: result.public_id });
  } catch (e) {
    console.error('Cloudinary upload failed:', e.message);
    return NextResponse.json({ error: 'Upload to Cloudinary failed. Check your Cloudinary credentials in .env.local.' }, { status: 502 });
  }
}

module.exports = { POST };
