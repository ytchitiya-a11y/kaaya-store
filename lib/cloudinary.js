const { v2: cloudinary } = require('cloudinary');

let configured = false;
function getCloudinary() {
  if (!configured) {
    if (process.env.CLOUDINARY_URL) {
      // CLOUDINARY_URL env var auto-configures the SDK (cloudinary://key:secret@cloud_name)
      cloudinary.config(true);
    } else {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
    }
    configured = true;
  }
  return cloudinary;
}

module.exports = { getCloudinary };
