/**
 * Barcode & QR Code Decoder Engine (barcodeService.js)
 * Automatically scans and decodes 1D barcodes (Code128, Code39, EAN) and 2D QR Codes
 * from uploaded photo buffers taken with smartphone cameras.
 */

const sharp = require('sharp');
const {
  QRCodeReader,
  Code128Reader,
  Code39Reader,
  EAN13Reader,
  MultiFormatOneDReader,
  RGBLuminanceSource,
  BinaryBitmap,
  HybridBinarizer,
  DecodeHintType
} = require('@zxing/library');

/**
 * Normalizes an image buffer into a grayscale luminance bitmap suitable for ZXing
 * @param {Buffer} imageBuffer - Raw image buffer (JPEG, PNG, WEBP)
 * @param {number} rotationAngle - Degrees to rotate (0, 90, 180, 270)
 * @returns {Promise<{ binaryBitmap: BinaryBitmap, width: number, height: number }>}
 */
async function createBinaryBitmap(imageBuffer, rotationAngle = 0) {
  let pipeline = sharp(imageBuffer).rotate(); // auto-orient by EXIF

  if (rotationAngle !== 0) {
    pipeline = pipeline.rotate(rotationAngle);
  }

  // Downscale giant camera photos (e.g. 12MP-48MP) to 1200px max for speed & reliability
  const { data, info } = await pipeline
    .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const luminanceSource = new RGBLuminanceSource(
    new Uint8ClampedArray(data),
    info.width,
    info.height
  );

  const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));
  return { binaryBitmap, width: info.width, height: info.height };
}

/**
 * Scans an image buffer for any 1D barcode or 2D QR code
 * Tries normal orientation first, then rotated 90 degrees if initially undetected.
 * @param {Buffer} imageBuffer - Raw image buffer from WhatsApp message
 * @returns {Promise<{ success: boolean, text?: string, format?: string, error?: string }>}
 */
async function scanBarcodeOrQr(imageBuffer) {
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    return { success: false, error: 'Buffer gambar kosong atau tidak valid.' };
  }

  const readers = [
    { name: 'QR_CODE', reader: new QRCodeReader() },
    { name: 'CODE_128', reader: new Code128Reader() },
    { name: 'CODE_39', reader: new Code39Reader() },
    { name: 'EAN_13', reader: new EAN13Reader() },
    { name: '1D_MULTI', reader: new MultiFormatOneDReader(new Map([[DecodeHintType.TRY_HARDER, true]])) }
  ];

  // Pass 1: Standard orientation
  try {
    const { binaryBitmap } = await createBinaryBitmap(imageBuffer, 0);
    for (const { name, reader } of readers) {
      try {
        const result = reader.decode(binaryBitmap);
        if (result && result.getText && result.getText()) {
          return {
            success: true,
            text: result.getText().trim(),
            format: name
          };
        }
      } catch (e) {
        // Continue trying next reader
      }
    }
  } catch (err) {
    console.warn('[BarcodeScanner] Pass 1 error:', err.message);
  }

  // Pass 2: Rotated 90 degrees (for sideways/vertical barcodes on cards)
  try {
    const { binaryBitmap: rotatedBitmap } = await createBinaryBitmap(imageBuffer, 90);
    for (const { name, reader } of readers) {
      try {
        const result = reader.decode(rotatedBitmap);
        if (result && result.getText && result.getText()) {
          return {
            success: true,
            text: result.getText().trim(),
            format: name
          };
        }
      } catch (e) {
        // Continue trying next reader
      }
    }
  } catch (err) {
    console.warn('[BarcodeScanner] Pass 2 error:', err.message);
  }

  return {
    success: false,
    error: 'Tidak ditemukan barcode atau QR code pada gambar.'
  };
}

/**
 * OCR Fallback to recognize printed text on cards when barcode/QR is blurred or obscured.
 * Uses Tesseract.js (WebAssembly) with image preprocessing via Sharp.
 * @param {Buffer} imageBuffer
 * @returns {Promise<{ success: boolean, text?: string, format?: string, error?: string, rawOcr?: string }>}
 */
async function scanCardWithOcr(imageBuffer) {
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    return { success: false, error: 'Buffer gambar kosong.' };
  }

  try {
    // Preprocess image for OCR: auto-orient, resize to 1200px max, grayscale, normalize contrast
    const preprocessed = await sharp(imageBuffer)
      .rotate()
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .grayscale()
      .normalize()
      .png()
      .toBuffer();

    const Tesseract = require('tesseract.js');
    const { data: { text } } = await Tesseract.recognize(preprocessed, 'eng', {
      logger: () => {} // quiet logger
    });

    if (!text || text.trim().length === 0) {
      return { success: false, error: 'OCR tidak mendeteksi teks apapun pada gambar.' };
    }

    const clean = text.replace(/\r/g, ' ');

    // 1. Label pattern: "Kode Material: ITEM-1", "Kode: ITEM-1", "Item Code: ITEM-1", "Part No: MCB-01"
    const labelMatch = clean.match(/(?:kode(?:\s+material|\s+barang)?|item(?:\s+code)?|part(?:\s+no|\s+number)?|sku|code)\s*[:=-]\s*([A-Za-z0-9_.-]+)/i);
    if (labelMatch && labelMatch[1] && labelMatch[1].length >= 2) {
      return {
        success: true,
        text: labelMatch[1].trim(),
        format: 'OCR_LABEL'
      };
    }

    // 2. Canonical ITEM-\d+ pattern in warehouse
    const itemMatch = clean.match(/\b(ITEM-\d+)\b/i);
    if (itemMatch && itemMatch[1]) {
      return {
        success: true,
        text: itemMatch[1].toUpperCase().trim(),
        format: 'OCR_ITEM_CODE'
      };
    }

    // 3. General product code pattern like ABC-123 or MCB-01
    const codeMatch = clean.match(/\b([A-Z0-9]{2,8}-[A-Z0-9]{1,8})\b/i);
    if (codeMatch && codeMatch[1]) {
      return {
        success: true,
        text: codeMatch[1].toUpperCase().trim(),
        format: 'OCR_DASH_CODE'
      };
    }

    // 4. Rack / Lokasi pattern (e.g. Lokasi: RE02.1 or RE02.1)
    const rackMatch = clean.match(/(?:lokasi|rack|rak)\s*[:=-]\s*([A-Za-z0-9_.]+)/i) ||
                      clean.match(/\b([A-Z]{1,3}\d{1,2}\.\d+)\b/i);
    if (rackMatch && rackMatch[1]) {
      return {
        success: true,
        text: rackMatch[1].toUpperCase().trim(),
        format: 'OCR_RACK'
      };
    }

    return {
      success: false,
      error: 'OCR membaca teks tetapi tidak menemukan pola kode material atau rak.',
      rawOcr: clean.trim().substring(0, 80)
    };
  } catch (err) {
    console.warn('[BarcodeScanner] OCR error:', err.message);
    return { success: false, error: `Gagal OCR: ${err.message}` };
  }
}

/**
 * Unified Material Card Scanner:
 * Step 1: Rapid 1D Barcode & 2D QR Code decoding via ZXing (<50ms)
 * Step 2: OCR Fallback via Tesseract.js if barcode is unreadable/obscured
 * @param {Buffer} imageBuffer
 * @returns {Promise<{ success: boolean, text?: string, format?: string, isOcr?: boolean, error?: string }>}
 */
async function scanMaterialCard(imageBuffer) {
  // Step 1: Try decoding Barcode or QR Code
  const barcodeResult = await scanBarcodeOrQr(imageBuffer);
  if (barcodeResult.success && barcodeResult.text) {
    return {
      ...barcodeResult,
      isOcr: false
    };
  }

  // Step 2: Fallback to OCR text recognition
  const ocrResult = await scanCardWithOcr(imageBuffer);
  if (ocrResult.success && ocrResult.text) {
    return {
      ...ocrResult,
      isOcr: true
    };
  }

  return {
    success: false,
    error: barcodeResult.error || ocrResult.error || 'Barcode/QR tidak terbaca dan teks kode kartu tidak terdeteksi.'
  };
}

/**
 * Extracts a material code or identifier from raw decoded text
 * e.g.:
 * - "ITEM-1" -> "ITEM-1"
 * - "https://warehouse.local/item/ITEM-1" -> "ITEM-1"
 * - "USER:admin:..." -> returns object { isUser: true, ... }
 * @param {string} rawText
 */
function parseDecodedCode(rawText) {
  if (!rawText) return { type: 'unknown', value: '' };

  const trimmed = String(rawText).trim();

  // 1. User login QR code (format: USER:<username>:<role>:<password>)
  if (trimmed.startsWith('USER:')) {
    const parts = trimmed.split(':');
    return {
      type: 'user',
      username: parts[1] || '',
      role: parts[2] || '',
      password: parts[3] || '',
      raw: trimmed
    };
  }

  // 2. URL containing item code (e.g. /item/ITEM-1 or ?kode=ITEM-1)
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const parsedUrl = new URL(trimmed);
      const urlKode = parsedUrl.searchParams.get('kode') || parsedUrl.searchParams.get('code') || parsedUrl.searchParams.get('item');
      if (urlKode) {
        return { type: 'material', value: urlKode };
      }
      const matchPath = parsedUrl.pathname.match(/\/(?:item|barang|kode)\/([A-Za-z0-9_-]+)/i);
      if (matchPath && matchPath[1]) {
        return { type: 'material', value: matchPath[1] };
      }
    } catch (e) {}
  }

  // 3. Direct Material code (e.g. ITEM-1, MCB-01, #12, etc.)
  return {
    type: 'material',
    value: trimmed
  };
}

module.exports = {
  scanMaterialCard,
  scanBarcodeOrQr,
  scanCardWithOcr,
  parseDecodedCode
};
