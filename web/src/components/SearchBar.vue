<template>
  <div class="search-bar-row">
    <div class="search-container" style="flex: 1; margin-bottom: 0;">
      <span style="margin-right: 8px; font-size: 18px; opacity: 0.8;">🔎</span>
      <input
        :value="modelValue"
        @input="$emit('update:modelValue', $event.target.value)"
        type="text"
        class="search-input"
        placeholder="Ketik kata kunci pencarian (kode material, nama barang, rak)..."
      />
      <button
        v-if="modelValue"
        @click="$emit('update:modelValue', '')"
        type="button"
        class="btn-search-clear"
        title="Hapus Pencarian"
      >
        ✕
      </button>
    </div>

    <!-- Quick Action Buttons: Scan Barcode & Export CSV -->
    <div class="search-actions">
      <button
        type="button"
        @click="$emit('open-scanner')"
        class="btn-tool"
        title="Pindai Barcode / QR Code dengan Kamera"
      >
        <span style="font-size: 16px;">📷</span>
        <span class="btn-tool-label">Scan Barcode</span>
      </button>

      <button
        type="button"
        @click="$emit('export-csv')"
        class="btn-tool"
        title="Ekspor data hasil pencarian ke file CSV / Excel"
      >
        <span style="font-size: 16px;">📥</span>
        <span class="btn-tool-label">Ekspor CSV</span>
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  modelValue: {
    type: String,
    default: ''
  }
});

defineEmits(['update:modelValue', 'open-scanner', 'export-csv']);
</script>

<style scoped>
.search-bar-row {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 24px;
}

@media (max-width: 640px) {
  .search-bar-row {
    flex-direction: column;
    align-items: stretch;
  }
  .search-actions {
    justify-content: stretch;
  }
  .btn-tool {
    flex: 1;
  }
}

.search-actions {
  display: flex;
  gap: 8px;
}

.btn-tool {
  background: var(--card-bg);
  border: 1px solid var(--border);
  color: #fff;
  padding: 10px 16px;
  border-radius: 24px;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  transition: all 0.2s ease;
  white-space: nowrap;
}

.btn-tool:hover {
  background: rgba(255, 255, 255, 0.18);
  border-color: rgba(255, 255, 255, 0.4);
}
</style>
