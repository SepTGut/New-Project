<template>
  <div v-if="isOpen" class="scanner-modal-backdrop" @click.self="close">
    <div class="scanner-modal-card">
      <div class="scanner-modal-header">
        <h3 style="font-size: 17px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
          📷 Pindai Barcode / QR Code
        </h3>
        <button @click="close" class="btn-close-scanner">✕</button>
      </div>

      <div class="scanner-viewport-wrap">
        <div id="interactive-reader" class="scanner-reader"></div>
        <div v-if="loadingCamera" class="scanner-loading-overlay">
          <div class="spinner"></div>
          <div style="margin-top: 10px; font-size: 13px;">Mengaktifkan kamera...</div>
        </div>
        <div v-if="processingFile" class="scanner-loading-overlay">
          <div class="spinner"></div>
          <div style="margin-top: 10px; font-size: 13px;">Memindai foto kartu...</div>
        </div>
      </div>

      <div v-if="errorMessage" class="alert-box error" style="margin: 12px 16px 0 16px; font-size: 13px;">
        {{ errorMessage }}
      </div>

      <div class="scanner-modal-footer">
        <label class="btn-file-scanner">
          📁 <span>Unggah Foto</span>
          <input type="file" accept="image/*" @change="onFileSelected" style="display: none;" />
        </label>
        <button @click="close" class="btn-secondary" style="padding: 8px 16px; font-size: 13px;">
          Tutup
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onBeforeUnmount } from 'vue';
import { Html5Qrcode } from 'html5-qrcode';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close', 'scan-success']);

const loadingCamera = ref(false);
const processingFile = ref(false);
const errorMessage = ref('');
let html5QrCode = null;

async function onFileSelected(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  errorMessage.value = '';
  processingFile.value = true;

  try {
    if (!html5QrCode) {
      html5QrCode = new Html5Qrcode('interactive-reader');
    }
    const decodedText = await html5QrCode.scanFile(file, false);
    if (decodedText) {
      handleSuccess(decodedText);
    } else {
      errorMessage.value = 'Barcode atau QR code tidak terdeteksi pada gambar.';
    }
  } catch (err) {
    console.warn('File scan error:', err);
    errorMessage.value = 'Tidak dapat membaca barcode/QR dari file ini. Pastikan foto fokus dan jelas.';
  } finally {
    processingFile.value = false;
    event.target.value = '';
  }
}

watch(
  () => props.isOpen,
  (newVal) => {
    if (newVal) {
      setTimeout(() => startScanner(), 150);
    } else {
      stopScanner();
    }
  }
);

async function startScanner() {
  loadingCamera.value = true;
  errorMessage.value = '';

  try {
    if (!html5QrCode) {
      html5QrCode = new Html5Qrcode('interactive-reader');
    }

    const config = {
      fps: 15,
      qrbox: { width: 260, height: 160 },
      aspectRatio: 1.0
    };

    await html5QrCode.start(
      { facingMode: 'environment' }, // Default to rear camera on phones
      config,
      (decodedText) => {
        handleSuccess(decodedText);
      },
      () => {
        // Continuous frame analysis without match
      }
    );
  } catch (err) {
    console.error('Scanner error:', err);
    errorMessage.value = 'Tidak dapat mengakses kamera: ' + (err.message || err);
  } finally {
    loadingCamera.value = false;
  }
}

function handleSuccess(decodedText) {
  // Sound / vibration feedback
  if (navigator.vibrate) {
    navigator.vibrate(100);
  }

  emit('scan-success', decodedText);
  close();
}

async function stopScanner() {
  if (html5QrCode) {
    try {
      if (html5QrCode.isScanning) {
        await html5QrCode.stop();
      }
      html5QrCode.clear();
    } catch (err) {
      console.warn('Error stopping scanner:', err);
    }
    html5QrCode = null;
  }
}

function close() {
  stopScanner();
  emit('close');
}

onBeforeUnmount(() => {
  stopScanner();
});
</script>

<style scoped>
.scanner-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 16px;
}

.scanner-modal-card {
  width: 100%;
  max-width: 440px;
  background: #252238;
  border: 1px solid var(--border);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
}

.scanner-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.04);
}

.btn-close-scanner {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: #fff;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.scanner-viewport-wrap {
  position: relative;
  width: 100%;
  min-height: 280px;
  background: #000;
  overflow: hidden;
}

.scanner-reader {
  width: 100% !important;
}

.scanner-loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.scanner-modal-footer {
  padding: 14px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.04);
}

.btn-file-scanner {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px dashed rgba(255, 255, 255, 0.25);
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #fff;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}

.btn-file-scanner:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.4);
}
</style>
