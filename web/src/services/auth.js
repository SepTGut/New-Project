/**
 * Client-Side Authentication & Role Management
 * Supports dynamic authentication against Google Sheets "Users" tab with offline fallback.
 */
import { authenticateViaApi } from './api';

const DEFAULT_USERS = [
  {
    username: 'admin',
    passwordHash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
    role: 'admin'
  },
  {
    username: 'staff',
    passwordHash: '10176e7b7b24d317acfcf8d2064cfd2f24e154f7b5a96603077d5ef813d6a6b6',
    role: 'staff'
  }
];

const AUTH_KEY = 'stock_opname_auth_user';

/**
 * Computes SHA-256 hash using the Web Crypto API
 */
export async function hashPassword(password) {
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Authenticates user credentials via Google Apps Script with offline fallback
 */
export async function login(username, password) {
  const cleanUsername = String(username).trim();
  const enteredHash = await hashPassword(password);

  // Strategy 1: Remote verification against Google Sheets "Users" tab
  try {
    const res = await authenticateViaApi(cleanUsername, enteredHash);
    if (res && res.success && res.user) {
      const sessionData = {
        username: res.user.username,
        role: res.user.role || 'staff',
        loggedInAt: Date.now()
      };
      localStorage.setItem(AUTH_KEY, JSON.stringify(sessionData));
      return { success: true, user: sessionData };
    } else if (res && res.message && res.message !== 'Koneksi server gagal') {
      return { success: false, message: res.message };
    }
  } catch (apiErr) {
    console.warn('Remote authentication failed or offline, checking local accounts:', apiErr);
  }

  // Strategy 2: Offline fallback with default accounts
  const matchedUser = DEFAULT_USERS.find(
    (u) => u.username.toLowerCase() === cleanUsername.toLowerCase() && u.passwordHash === enteredHash
  );

  if (matchedUser) {
    const sessionData = {
      username: matchedUser.username,
      role: matchedUser.role,
      loggedInAt: Date.now(),
      offline: true
    };
    localStorage.setItem(AUTH_KEY, JSON.stringify(sessionData));
    return { success: true, user: sessionData };
  }

  return { success: false, message: 'Username atau password salah.' };
}

/**
 * Retrieves the currently logged-in user from localStorage
 */
export function getCurrentUser() {
  const sessionStr = localStorage.getItem(AUTH_KEY);
  if (!sessionStr) return null;
  try {
    return JSON.parse(sessionStr);
  } catch {
    return null;
  }
}

/**
 * Logs out current user and clears session
 */
export function logout() {
  localStorage.removeItem(AUTH_KEY);
}
