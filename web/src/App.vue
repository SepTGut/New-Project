<template>
  <div class="app-container">
    <!-- Unauthenticated: Login View -->
    <LoginForm v-if="!currentUser" @login-success="onLoginSuccess" />

    <!-- Authenticated: Main Application -->
    <div v-else>
      <!-- Top Navigation -->
      <header class="top-nav">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="brand-badge">🧰 Stock Opname</span>
          <span v-if="isOffline" class="offline-badge" title="Mode Offline: Menggunakan cache lokal">
            ⚡ Offline
          </span>
        </div>

        <div class="user-badge">
          <div class="user-info">
            <div class="user-avatar">
              {{ currentUser.username.charAt(0).toUpperCase() }}
            </div>
            <div class="user-text">
              <div class="user-name">{{ currentUser.username }}</div>
              <div class="user-role">{{ currentUser.role }}</div>
            </div>
          </div>
          <button @click="handleLogout" class="btn-logout" title="Keluar">
            Keluar
          </button>
        </div>
      </header>

      <!-- Greeting Banner -->
      <h1 class="greeting-text">
        Hi {{ capitalizedRole }}, apa yang ingin kamu cari?
      </h1>

      <!-- Navigation Tabs -->
      <nav class="tabs-container">
        <button
          @click="activeTab = 'search'"
          :class="['tab-btn', activeTab === 'search' ? 'active' : '']"
        >
          🔍 Cari Barang
        </button>
        <button
          v-if="canAdd"
          @click="activeTab = 'add'"
          :class="['tab-btn', activeTab === 'add' ? 'active' : '']"
        >
          ➕ Tambah Data Barang
        </button>
      </nav>

      <!-- TAB 1: Search & Inventory Catalog -->
      <main v-if="activeTab === 'search'">
        <SearchBar
          v-model="searchQuery"
          @open-scanner="openScanner('search')"
          @export-csv="handleExport"
        />

        <!-- Loading State -->
        <div v-if="loadingInventory" style="text-align: center; padding: 40px; color: var(--text-muted);">
          <div class="spinner" style="width: 28px; height: 28px; margin-bottom: 12px;"></div>
          <div>Memuat data inventaris dari Google Sheets...</div>
        </div>

        <!-- Error State -->
        <div v-else-if="fetchError" class="alert-box error" style="margin-bottom: 20px;">
          <span>⚠️</span> {{ fetchError }}
          <button @click="loadData" class="btn-secondary" style="margin-left: auto; padding: 4px 10px; font-size: 12px;">
            Coba Lagi
          </button>
        </div>

        <!-- Initial Blank Query State -->
        <div v-else-if="!searchQuery.trim()" class="alert-box" style="background: var(--card-bg); border: 1px solid var(--border); display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <span>👋 Cari apa saja: <b>Nama Barang</b>, <b>Kode Material</b>, <b>Lokasi Rak</b>, atau <b>No</b>.</span>
            <button @click="searchQuery = '*'" class="btn-secondary" style="padding: 4px 10px; font-size: 12px; cursor: pointer;">
              📦 Tampilkan Semua ({{ inventory.length }})
            </button>
          </div>
          <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center; font-size: 12px; color: var(--text-muted);">
            <span>Contoh:</span>
            <button @click="searchQuery = 'wago'" class="btn-chip" type="button">Wago</button>
            <button @click="searchQuery = 'mcb'" class="btn-chip" type="button">MCB</button>
            <button @click="searchQuery = 'san disk'" class="btn-chip" type="button">San Disk</button>
            <button @click="searchQuery = 'relay'" class="btn-chip" type="button">Relay</button>
            <button @click="searchQuery = 'ITEM-1'" class="btn-chip" type="button">ITEM-1</button>
            <button @click="searchQuery = 'RE02.1'" class="btn-chip" type="button">Rak RE02.1</button>
          </div>
        </div>

        <!-- Empty Results -->
        <div v-else-if="filteredItems.length === 0" class="alert-box error">
          Tidak ada data barang yang sesuai dengan pencarian "{{ searchQuery }}".
        </div>

        <!-- Results List -->
        <div v-else>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div style="font-size: 13.5px; color: var(--text-muted);">
              Ditemukan <b>{{ filteredItems.length }}</b> barang
            </div>
            <button
              @click="handleExport"
              style="background: transparent; border: none; color: var(--accent); font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px;"
            >
              📥 Unduh CSV
            </button>
          </div>

          <ItemCard
            v-for="(item, idx) in filteredItems"
            :key="idx"
            :item="item"
            :is-admin="currentUser.role === 'admin' || currentUser.role === 'staff'"
            @item-updated="loadData"
          />
        </div>
      </main>

      <!-- TAB 2: Add New Item -->
      <main v-else-if="activeTab === 'add' && canAdd">
        <AddItemForm
          ref="addItemFormRef"
          @item-added="onItemAdded"
          @scan-code="openScanner('material')"
        />
      </main>

      <!-- Barcode & QR Code Camera Scanner Modal -->
      <BarcodeScannerModal
        :is-open="isScannerOpen"
        @close="isScannerOpen = false"
        @scan-success="onScanSuccess"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import LoginForm from './components/LoginForm.vue';
import SearchBar from './components/SearchBar.vue';
import ItemCard from './components/ItemCard.vue';
import AddItemForm from './components/AddItemForm.vue';
import BarcodeScannerModal from './components/BarcodeScannerModal.vue';
import { getCurrentUser, logout } from './services/auth';
import { fetchInventory } from './services/api';
import { exportInventoryToCSV } from './utils/exportUtils';

const currentUser = ref(getCurrentUser());
const activeTab = ref('search');
const searchQuery = ref('');

const inventory = ref([]);
const loadingInventory = ref(false);
const fetchError = ref('');

// Scanner & Export state
const isScannerOpen = ref(false);
const scannerTarget = ref('search'); // 'search' | 'material'
const addItemFormRef = ref(null);

// Network Status
const isOffline = ref(!navigator.onLine);

function updateOnlineStatus() {
  isOffline.value = !navigator.onLine;
}

const capitalizedRole = computed(() => {
  if (!currentUser.value) return 'Pengguna';
  const r = currentUser.value.role || '';
  return r.charAt(0).toUpperCase() + r.slice(1);
});

const canAdd = computed(() => {
  return currentUser.value && ['admin', 'staff'].includes(currentUser.value.role);
});

const filteredItems = computed(() => {
  const rawQ = String(searchQuery.value || '').trim().toLowerCase();
  if (!rawQ) return [];
  if (rawQ === '*' || rawQ === 'all' || rawQ === 'semua') return inventory.value;

  // Split query into tokens by whitespace and common delimiters
  const tokens = rawQ.split(/[\s,;|/]+/).filter(Boolean);
  if (tokens.length === 0) return [];

  return inventory.value.filter((item) => {
    // Collect all values into a single searchable string
    const fields = Object.values(item).map((val) => String(val || '').toLowerCase());
    const combined = fields.join(' ');
    const strippedCombined = combined.replace(/[^a-z0-9]/g, '');

    // Every token must match either substring in combined text or stripped alphanumeric
    return tokens.every((token) => {
      if (combined.includes(token)) return true;
      const strippedToken = token.replace(/[^a-z0-9]/g, '');
      if (strippedToken && strippedCombined.includes(strippedToken)) return true;
      return false;
    });
  });
});

async function loadData() {
  loadingInventory.value = true;
  fetchError.value = '';

  try {
    const data = await fetchInventory();
    inventory.value = data;
  } catch (err) {
    console.error(err);
    fetchError.value = 'Gagal memuat database Google Sheets: ' + err.message;
  } finally {
    loadingInventory.value = false;
  }
}

function openScanner(target = 'search') {
  scannerTarget.value = target;
  isScannerOpen.value = true;
}

function onScanSuccess(code) {
  if (!code) return;

  if (scannerTarget.value === 'search') {
    searchQuery.value = code;
    activeTab.value = 'search';
  } else if (scannerTarget.value === 'material') {
    if (addItemFormRef.value && addItemFormRef.value.setMaterialCode) {
      addItemFormRef.value.setMaterialCode(code);
    }
  }
}

function handleExport() {
  const exportItems = filteredItems.value.length > 0 ? filteredItems.value : inventory.value;
  exportInventoryToCSV(exportItems, 'stock_opname_audit');
}

function onLoginSuccess(user) {
  currentUser.value = user;
  loadData();
}

function handleLogout() {
  logout();
  currentUser.value = null;
  inventory.value = [];
  searchQuery.value = '';
}

function onItemAdded() {
  loadData();
  activeTab.value = 'search';
}

onMounted(() => {
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);

  if (currentUser.value) {
    loadData();
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('online', updateOnlineStatus);
  window.removeEventListener('offline', updateOnlineStatus);
});
</script>

<style scoped>
.offline-badge {
  background: rgba(239, 68, 68, 0.25);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #fca5a5;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.btn-chip {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--border);
  color: var(--text-muted);
  border-radius: 12px;
  padding: 2px 8px;
  font-size: 11.5px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.btn-chip:hover {
  background: rgba(139, 92, 246, 0.25);
  color: #fff;
  border-color: var(--accent);
}
</style>
