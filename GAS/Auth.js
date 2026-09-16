/**
 * Authentication & Request Verification Service
 */
function authenticateRequest(payload) {
  // If API_KEY is not configured in CONFIG, skip auth (backward compatible)
  if (!CONFIG.API_KEY || CONFIG.API_KEY.trim() === '') {
    return { authorized: true };
  }

  if (payload && payload.apiKey === CONFIG.API_KEY) {
    return { authorized: true };
  }

  return {
    authorized: false,
    message: 'Akses ditolak: API Key tidak valid atau tidak disertakan.'
  };
}
