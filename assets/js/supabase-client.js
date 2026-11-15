/* ============================================================
   supabase-client.js — Membuat satu klien Supabase untuk seluruh situs
   Dimuat SETELAH: library supabase-js (CDN) dan config.js
   Hasil: window.db (klien) dan window.dbReady (true/false)
   ============================================================ */
(function () {
  const cfg = window.APP_CONFIG || {};
  window.dbReady = false;
  window.dbError = null;

  // Mengambil isi (payload) JWT untuk mendeteksi kunci service_role
  function jwtRole(key) {
    try {
      const part = key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(atob(part)).role || null;
    } catch (e) { return null; }
  }

  const url = (cfg.SUPABASE_URL || "").trim();
  const key = (cfg.SUPABASE_ANON_KEY || "").trim();

  if (!url || !key || url.includes("GANTI") || key.includes("GANTI")) {
    window.dbError = "Konfigurasi belum diisi. Edit assets/js/config.js.";
  } else if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
    window.dbError = "SUPABASE_URL tidak valid. Contoh: https://abcdefgh.supabase.co";
  } else if (key.startsWith("sb_secret_") || jwtRole(key) === "service_role") {
    window.dbError = "BERBAHAYA: ini kunci rahasia (service_role/secret). Ganti dengan kunci anon/publishable.";
  } else if (!window.supabase || !window.supabase.createClient) {
    window.dbError = "Library supabase-js gagal dimuat (cek koneksi internet / tag script).";
  } else {
    window.db = window.supabase.createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    window.dbReady = true;
  }

  if (window.dbError) console.warn("[Supabase]", window.dbError);
})();
