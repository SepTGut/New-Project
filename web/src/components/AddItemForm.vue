<template>
  <div class="form-wrap">
    <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 18px;">
      ➕ Tambah Data Barang Baru
    </h2>

    <div v-if="statusMessage" :class="['alert-box', isSuccess ? 'success' : 'error']">
      <span>{{ isSuccess ? '✅' : '⚠️' }}</span> {{ statusMessage }}
    </div>

    <form @submit.prevent="handleSubmit">
      <div class="form-grid">
        <!-- Left Column -->
        <div>
          <div class="form-group">
            <label class="form-label">Lokasi Rak *</label>
            <input
              v-model="form.lokasiRak"
              type="text"
              class="form-input"
              placeholder="Contoh: A-01-02"
              required
            />
          </div>

          <div class="form-group">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <label class="form-label" style="margin-bottom: 0;">Kode Material *</label>
              <button
                type="button"
                @click="$emit('scan-code')"
                class="btn-scan-link"
                title="Pindai barcode untuk mengisi kode material"
              >
                📷 Scan
              </button>
            </div>
            <input
              v-model="form.kodeMaterial"
              type="text"
              class="form-input"
              placeholder="Contoh: MAT-1002"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label">Nama Barang *</label>
            <input
              v-model="form.namaBarang"
              type="text"
              class="form-input"
              placeholder="Contoh: Bearing 6204"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label">Qty</label>
            <input
              v-model.number="form.qty"
              type="number"
              min="0"
              class="form-input"
              placeholder="0"
            />
          </div>
        </div>

        <!-- Right Column -->
        <div>
          <div class="form-group">
            <label class="form-label">UoM (PCS, BOX, SET, dll) *</label>
            <input
              v-model="form.uom"
              type="text"
              class="form-input"
              placeholder="Contoh: PCS"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label">Deskripsi</label>
            <textarea
              v-model="form.deskripsi"
              class="form-textarea"
              placeholder="Keterangan spesifikasi barang..."
            ></textarea>
          </div>

          <!-- Foto 1 -->
          <div class="form-group">
            <label class="form-label">Foto 1</label>
            <input
              type="file"
              accept="image/*"
              @change="onFoto1Change"
              class="form-input"
              ref="foto1Input"
            />
            <div v-if="foto1File" class="file-hint">
              📎 {{ (foto1File.size / 1024).toFixed(0) }} KB (dikompres otomatis)
            </div>
            <div v-if="foto1Preview" class="preview-box">
              <img :src="foto1Preview" class="preview-img" alt="Pratinjau Foto 1" />
            </div>
          </div>

          <!-- Foto 2 -->
          <div class="form-group">
            <label class="form-label">Foto 2 (opsional)</label>
            <input
              type="file"
              accept="image/*"
              @change="onFoto2Change"
              class="form-input"
              ref="foto2Input"
            />
            <div v-if="foto2File" class="file-hint">
              📎 {{ (foto2File.size / 1024).toFixed(0) }} KB (dikompres otomatis)
            </div>
            <div v-if="foto2Preview" class="preview-box">
              <img :src="foto2Preview" class="preview-img" alt="Pratinjau Foto 2" />
            </div>
          </div>
        </div>
      </div>

      <!-- Canvas Side-by-Side Merged Preview -->
      <div v-if="mergedPreview" class="preview-box" style="margin: 20px 0;">
        <label class="form-label">Pratinjau Foto Gabungan (Otomatis dari Foto 1 + 2)</label>
        <img :src="mergedPreview" class="preview-img" style="max-height: 240px;" alt="Pratinjau Gabungan" />
      </div>

      <div style="margin-top: 20px;">
        <button type="submit" class="btn-primary" style="width: 100%;" :disabled="submitting">
          <span v-if="submitting" class="spinner"></span>
          <span v-else>💾 Simpan Data</span>
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { compressImageFile, mergeTwoImageFiles } from '../utils/imageUtils';
import { submitNewItem } from '../services/api';

const emit = defineEmits(['item-added', 'scan-code']);

function setMaterialCode(code) {
  form.kodeMaterial = code;
}

defineExpose({ setMaterialCode });

const form = reactive({
  lokasiRak: '',
  kodeMaterial: '',
  namaBarang: '',
  qty: 0,
  uom: '',
  deskripsi: ''
});

const submitting = ref(false);
const statusMessage = ref('');
const isSuccess = ref(false);

const foto1File = ref(null);
const foto1Preview = ref('');
const foto2File = ref(null);
const foto2Preview = ref('');
const mergedPreview = ref('');

const foto1Input = ref(null);
const foto2Input = ref(null);

async function onFoto1Change(e) {
  const file = e.target.files[0];
  if (file) {
    foto1File.value = file;
    foto1Preview.value = URL.createObjectURL(file);
    await checkMergedPreview();
  }
}

async function onFoto2Change(e) {
  const file = e.target.files[0];
  if (file) {
    foto2File.value = file;
    foto2Preview.value = URL.createObjectURL(file);
    await checkMergedPreview();
  }
}

async function checkMergedPreview() {
  if (foto1File.value && foto2File.value) {
    const merged = await mergeTwoImageFiles(foto1File.value, foto2File.value);
    if (merged) {
      mergedPreview.value = merged.previewUrl;
    }
  } else {
    mergedPreview.value = '';
  }
}

async function handleSubmit() {
  if (!form.lokasiRak || !form.kodeMaterial || !form.namaBarang || !form.uom) {
    statusMessage.value = 'Mohon lengkapi semua kolom bertanda *.';
    isSuccess.value = false;
    return;
  }

  submitting.value = true;
  statusMessage.value = 'Mengupload foto & menyimpan data ke Google Sheets...';
  isSuccess.value = true;

  try {
    let f1Payload = null;
    let f2Payload = null;
    let fGabunganPayload = null;

    if (foto1File.value) {
      f1Payload = await compressImageFile(foto1File.value);
    }
    if (foto2File.value) {
      f2Payload = await compressImageFile(foto2File.value);
    }
    if (foto1File.value && foto2File.value) {
      fGabunganPayload = await mergeTwoImageFiles(foto1File.value, foto2File.value);
    }

    const res = await submitNewItem({
      lokasiRak: form.lokasiRak,
      kodeMaterial: form.kodeMaterial,
      namaBarang: form.namaBarang,
      qty: form.qty,
      uom: form.uom,
      deskripsi: form.deskripsi,
      foto1: f1Payload,
      foto2: f2Payload,
      fotoGabungan: fGabunganPayload
    });

    if (res.success) {
      isSuccess.value = true;
      statusMessage.value = res.message || 'Data berhasil disimpan!';

      // Reset form
      form.lokasiRak = '';
      form.kodeMaterial = '';
      form.namaBarang = '';
      form.qty = 0;
      form.uom = '';
      form.deskripsi = '';
      foto1File.value = null;
      foto1Preview.value = '';
      foto2File.value = null;
      foto2Preview.value = '';
      mergedPreview.value = '';
      if (foto1Input.value) foto1Input.value.value = '';
      if (foto2Input.value) foto2Input.value.value = '';

      emit('item-added');
    } else {
      isSuccess.value = false;
      statusMessage.value = res.message || 'Gagal menyimpan data.';
    }
  } catch (err) {
    isSuccess.value = false;
    statusMessage.value = 'Terjadi kesalahan: ' + err.message;
  } finally {
    submitting.value = false;
  }
}
</script>
