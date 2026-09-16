/**
 * Image Utilities: Browser-based Canvas Compression & Side-by-Side Stitching
 */

const MAX_PHOTO_DIMENSION = 1600;
const JPEG_QUALITY = 0.75;

/**
 * Loads a File object into an HTMLImageElement
 */
function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Gagal memuat gambar.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Gagal membaca file.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Resizes and compresses an image to JPEG using HTML5 Canvas
 */
export async function compressImageFile(file, maxDim = MAX_PHOTO_DIMENSION, quality = JPEG_QUALITY) {
  if (!file) return null;

  try {
    const img = await loadImageFromFile(file);
    let width = img.width;
    let height = img.height;

    // Calculate aspect-ratio scaling
    if (width > maxDim || height > maxDim) {
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    // White background for JPEG conversion
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const base64 = dataUrl.split(',')[1];
    const baseName = file.name.replace(/\.[^/.]+$/, '');

    return {
      base64,
      mimeType: 'image/jpeg',
      fileName: `${baseName}.jpg`,
      previewUrl: dataUrl
    };
  } catch (err) {
    console.error('Error compressing image:', err);
    // Fallback: Read raw base64 if canvas fails
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          base64: reader.result.split(',')[1],
          mimeType: file.type || 'image/jpeg',
          fileName: file.name,
          previewUrl: reader.result
        });
      };
      reader.readAsDataURL(file);
    });
  }
}

/**
 * Merges two images side-by-side into a single composite image using HTML5 Canvas
 */
export async function mergeTwoImageFiles(file1, file2, gap = 14, quality = JPEG_QUALITY) {
  if (!file1 || !file2) return null;

  try {
    const [img1, img2] = await Promise.all([
      loadImageFromFile(file1),
      loadImageFromFile(file2)
    ]);

    const targetH = Math.min(img1.height, img2.height, 900);

    const w1 = Math.max(Math.round(img1.width * (targetH / img1.height)), 1);
    const w2 = Math.max(Math.round(img2.width * (targetH / img2.height)), 1);
    const totalW = w1 + gap + w2;

    const canvas = document.createElement('canvas');
    canvas.width = totalW;
    canvas.height = targetH;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, totalW, targetH);

    ctx.drawImage(img1, 0, 0, w1, targetH);
    ctx.drawImage(img2, w1 + gap, 0, w2, targetH);

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const base64 = dataUrl.split(',')[1];

    return {
      base64,
      mimeType: 'image/jpeg',
      fileName: 'gabungan.jpg',
      previewUrl: dataUrl
    };
  } catch (err) {
    console.error('Error merging images:', err);
    return null;
  }
}

/**
 * Extracts Google Drive ID and formats into direct thumbnail URL
 */
export function getDirectDriveUrl(driveUrl) {
  if (!driveUrl) return '';
  const match = String(driveUrl).match(/(?:\/d\/|id=)([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://lh3.googleusercontent.com/d/${match[1]}`;
  }
  return driveUrl;
}

/**
 * Normalizes text for search indexing
 */
export function normalizeText(text) {
  if (!text) return '';
  return String(text).toLowerCase().replace(/[\s\-_]+/g, '');
}
