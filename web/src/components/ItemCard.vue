<template>
  <div class="item-card">
    <!-- Photo Column: Single main photo of the whole item -->
    <div class="card-photos">
      <div v-if="mainPhotoUrl && !imgLoadFailed">
        <img
          :src="mainPhotoUrl"
          class="card-img"
          alt="Foto Barang"
          loading="lazy"
          @error="handleImgError"
        />
      </div>
      <div v-else class="photo-placeholder">
        {{ imgLoadFailed ? 'Foto Tidak Dapat Dimuat' : 'Tanpa Foto' }}
      </div>
    </div>

    <!-- Content Column -->
    <div class="card-content">
      <h3 class="item-title">{{ namaBarang }}</h3>
      <span class="item-badge">{{ kodeMaterial }}</span>

      <div class="item-row"><b>Lokasi Rak :</b> {{ lokasiRak || '-' }}</div>
      <div class="item-row"><b>Qty :</b> {{ qty }} {{ uom }}</div>
      <div v-if="deskripsi" class="item-row"><b>Deskripsi :</b> {{ deskripsi }}</div>

      <!-- Extra dynamic columns if any -->
      <div v-for="(val, key) in extraColumns" :key="key" class="item-row">
        <b>{{ key }} :</b> {{ val || '-' }}
      </div>

      <!-- Inline Edit Form (Admin Only) -->
      <div v-if="isEditing" class="form-wrap" style="margin-top: 16px;">
        <h4 style="margin-bottom: 14px; font-size: 16px;">✏️ Edit Data Barang</h4>

        <div v-if="saveMessage" :class="['alert-box', saveSuccess ? 'success' : 'error']">
          {{ saveMessage }}
        </div>

        <form @submit.prevent="handleSaveEdit">
          <div class="form-grid">
            <div>
              <div class="form-group">
                <label class="form-label">Lokasi Rak *</label>
                <input v-model="editData.lokasiRak" type="text" class="form-input" required />
              </div>
              <div class="form-group">
                <label class="form-label">Kode Material *</label>
                <input v-model="editData.kodeMaterial" type="text" class="form-input" required />
              </div>
              <div class="form-group">
                <label class="form-label">Nama Barang *</label>
                <input v-model="editData.namaBarang" type="text" class="form-input" required />
              </div>
              <div class="form-group">
                <label class="form-label">Qty</label>
                <input v-model.number="editData.qty" type="number" min="0" class="form-input" />
              </div>
            </div>

            <div>
              <div class="form-group">
                <label class="form-label">UoM *</label>
                <input v-model="editData.uom" type="text" class="form-input" placeholder="PCS, BOX, dll" required />
              </div>
              <div class="form-group">
                <label class="form-label">Deskripsi</label>
                <textarea v-model="editData.deskripsi" class="form-textarea"></textarea>
              </div>

              <!-- Upload Foto 1 -->
              <div class="form-group">
                <label class="form-label">Ganti Foto 1 (opsional)</label>
                <input type="file" accept="image/*" @change="onFoto1Change" class="form-input" />
                <div v-if="foto1Preview" class="preview-box">
                  <img :src="foto1Preview" class="preview-img" />
                </div>
              </div>

              <!-- Upload Foto 2 -->
              <div class="form-group">
                <label class="form-label">Ganti Foto 2 (opsional)</label>
                <input type="file" accept="image/*" @change="onFoto2Change" class="form-input" />
                <div v-if="foto2Preview" class="preview-box">
                  <img :src="foto2Preview" class="preview-img" />
                </div>
              </div>
            </div>
          </div>

          <!-- Canvas Merged Preview -->
          <div v-if="mergedPreview" class="preview-box" style="margin: 14px 0;">
            <label class="form-label">Pratinjau Foto Gabungan Baru (Otomatis dari Foto 1 + 2)</label>
            <img :src="mergedPreview" class="preview-img" />
          </div>

          <div style="display: flex; gap: 10px; margin-top: 14px;">
            <button type="submit" class="btn-primary" :disabled="saving">
              <span v-if="saving" class="spinner"></span>
              <span v-else>💾 Simpan Perubahan</span>
            </button>
            <button type="button" @click="isEditing = false" class="btn-secondary">
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Card Actions -->
    <div class="card-actions">
      <button
        @click="shareToWhatsApp"
        class="btn-wa"
        title="Bagikan data material ke WhatsApp"
      >
        <span>💬</span> WA Share
      </button>
      <button v-if="isAdmin" @click="toggleEdit" class="btn-edit">
        {{ isEditing ? 'Tutup' : '✏️ Edit' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue';
import { getDirectDriveUrl, compressImageFile, mergeTwoImageFiles } from '../utils/imageUtils';
import { submitUpdateItem } from '../services/api';

const props = defineProps({
  item: {
    type: Object,
    required: true
  },
  isAdmin: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['item-updated']);

const isEditing = ref(false);
const saving = ref(false);
const saveMessage = ref('');
const saveSuccess = ref(false);
const imgLoadFailed = ref(false);

const foto1File = ref(null);
const foto1Preview = ref('');
const foto2File = ref(null);
const foto2Preview = ref('');
const mergedPreview = ref('');

// Helper to look up key case-insensitively
function getVal(keywords) {
  for (const [k, v] of Object.entries(props.item)) {
    const cleanK = k.toLowerCase().trim();
    if (keywords.some((kw) => cleanK === kw)) {
      return String(v || '').trim();
    }
  }
  return '';
}

const lokasiRak = computed(() => getVal(['lokasi rak', 'lokasi', 'rak']));
const itemNo = computed(() => getVal(['no', 'nomor', 'number', '#']));
const kodeMaterial = computed(() => {
  const val = getVal(['kode material', 'kode']);
  if (val && val !== '-') return val;
  const num = itemNo.value;
  return num ? `ITEM-${num}` : (val || '-');
});
const namaBarang = computed(() => getVal(['nama barang', 'nama']));
const qty = computed(() => getVal(['qty', 'jumlah']) || '0');
const uom = computed(() => getVal(['uom', 'satuan']) || '');
const deskripsi = computed(() => getVal(['deskripsi', 'keterangan']));

const mainPhotoUrl = computed(() => {
  if (props.item.imageUrl) return props.item.imageUrl;
  if (props.item.fileId) return `https://lh3.googleusercontent.com/d/${props.item.fileId}`;

  // 1. Prioritize Foto 1 (the main photo of the whole item)
  const f1Val = getVal(['link foto', 'link foto 1', 'foto 1', 'foto1', 'foto', 'link1', 'link']);
  if (f1Val) {
    const direct = getDirectDriveUrl(f1Val);
    if (direct) return direct;
  }

  // 2. Fallback to any available photo if Foto 1 is missing
  for (const [k, v] of Object.entries(props.item)) {
    const cleanK = k.toLowerCase();
    if (['foto', 'link', 'drive', 'url'].some((kw) => cleanK.includes(kw))) {
      const driveUrl = String(v || '').trim();
      if (driveUrl) {
        const direct = getDirectDriveUrl(driveUrl);
        if (direct) return direct;
      }
    }
  }

  return '';
});

const extraColumns = computed(() => {
  const exclude = ['no', 'nomor', 'number', '#', 'lokasi rak', 'lokasi', 'rak', 'kode material', 'kode', 'nama barang', 'nama', 'qty', 'uom', 'satuan', 'deskripsi', 'link', 'foto', 'drive', 'url'];
  const res = {};
  for (const [k, v] of Object.entries(props.item)) {
    const cleanK = k.toLowerCase().trim();
    if (!exclude.some((ex) => cleanK.includes(ex)) && v) {
      res[k.trim()] = String(v).trim();
    }
  }
  return res;
});

const editData = reactive({
  lokasiRak: '',
  kodeMaterial: '',
  namaBarang: '',
  qty: 0,
  uom: '',
  deskripsi: ''
});

function toggleEdit() {
  if (!isEditing.value) {
    editData.lokasiRak = lokasiRak.value;
    editData.kodeMaterial = kodeMaterial.value && kodeMaterial.value !== '-' ? kodeMaterial.value : (itemNo.value ? `ITEM-${itemNo.value}` : '');
    editData.namaBarang = namaBarang.value;
    editData.qty = parseInt(qty.value, 10) || 0;
    editData.uom = uom.value;
    editData.deskripsi = deskripsi.value;

    foto1File.value = null;
    foto1Preview.value = '';
    foto2File.value = null;
    foto2Preview.value = '';
    mergedPreview.value = '';
    saveMessage.value = '';
  }
  isEditing.value = !isEditing.value;
}

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
  }
}

async function handleSaveEdit() {
  saving.value = true;
  saveMessage.value = '';

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

    const res = await submitUpdateItem({
      kodeMaterialAsli: kodeMaterial.value,
      no: itemNo.value,
      lokasiRak: editData.lokasiRak,
      kodeMaterial: editData.kodeMaterial,
      namaBarang: editData.namaBarang,
      qty: editData.qty,
      uom: editData.uom,
      deskripsi: editData.deskripsi,
      foto1: f1Payload,
      foto2: f2Payload,
      keepFoto1: !foto1File.value,
      keepFoto2: !foto2File.value,
      fotoGabungan: fGabunganPayload,
      keepFotoGabungan: !fGabunganPayload
    });

    if (res.success) {
      saveSuccess.value = true;
      saveMessage.value = res.message || 'Data berhasil diperbarui!';
      setTimeout(() => {
        isEditing.value = false;
        emit('item-updated');
      }, 1000);
    } else {
      saveSuccess.value = false;
      saveMessage.value = res.error || res.message || 'Gagal memperbarui data.';
    }
  } catch (err) {
    saveSuccess.value = false;
    saveMessage.value = 'Terjadi kesalahan: ' + err.message;
  } finally {
    saving.value = false;
  }
}

function handleImgError() {
  // Graceful fallback to styled placeholder on image load failure
  imgLoadFailed.value = true;
}

function shareToWhatsApp() {
  const infoText =
`📦 *INFO MATERIAL GUDANG*
🏷️ *Kode Material :* ${kodeMaterial.value || '-'}
📝 *Nama Barang   :* ${namaBarang.value || '-'}
📍 *Lokasi Rak    :* ${lokasiRak.value || '-'}
📊 *Jumlah Stok   :* ${qty.value} ${uom.value || ''}
📄 *Deskripsi     :* ${deskripsi.value || '-'}`;

  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(infoText)}`;
  window.open(waUrl, '_blank');
}
</script>
