<template>
  <div class="login-view">
    <div style="text-align: center; margin-bottom: 20px;">
      <span class="brand-badge">Perencanaan dan Pengendalian Operasi</span>
    </div>

    <div class="login-card">
      <div class="login-icon">🧰</div>
      <h1 class="login-title">Stock Opname</h1>
      <p class="login-subtitle">Masuk untuk melanjutkan</p>

      <div v-if="errorMessage" class="alert-box error">
        <span>⚠️</span> {{ errorMessage }}
      </div>

      <form @submit.prevent="handleLogin">
        <div class="form-group" style="text-align: left;">
          <label class="form-label">Username</label>
          <input
            v-model="username"
            type="text"
            class="form-input"
            placeholder="Ketik username..."
            required
            autocomplete="username"
          />
        </div>

        <div class="form-group" style="text-align: left; margin-bottom: 24px;">
          <label class="form-label">Password</label>
          <input
            v-model="password"
            type="password"
            class="form-input"
            placeholder="Ketik password..."
            required
            autocomplete="current-password"
          />
        </div>

        <button type="submit" class="btn-primary" style="width: 100%;" :disabled="loading">
          <span v-if="loading" class="spinner"></span>
          <span v-else>Masuk</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { login } from '../services/auth';

const emit = defineEmits(['login-success']);

const username = ref('');
const password = ref('');
const loading = ref(false);
const errorMessage = ref('');

async function handleLogin() {
  errorMessage.value = '';
  loading.value = true;

  try {
    const result = await login(username.value, password.value);
    if (result.success) {
      emit('login-success', result.user);
    } else {
      errorMessage.value = result.message;
    }
  } catch (err) {
    errorMessage.value = 'Terjadi kesalahan sistem saat login: ' + err.message;
  } finally {
    loading.value = false;
  }
}
</script>
