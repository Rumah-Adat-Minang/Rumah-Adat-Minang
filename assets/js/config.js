/* ============================================================
   config.js — Konfigurasi koneksi Supabase (hanya kunci PUBLIK)
   ------------------------------------------------------------
   ISI dua nilai di bawah dari: Supabase > Project Settings > API
   - SUPABASE_URL      : Project URL
   - SUPABASE_ANON_KEY : kunci "anon public" (atau "publishable")
   JANGAN PERNAH menaruh "service_role" / "secret" key di file ini.
   Kunci anon memang publik; keamanan data dijaga oleh RLS (Tahap 3 & 9).
   ============================================================ */
window.APP_CONFIG = {
  SUPABASE_URL: "https://pcdxzufcmrllpjfjlqqc.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_lBvESJu_Rqtd7-KrdyabUA_3ga1ibGA",

  // Nama bucket Storage (dibuat di Tahap 5)
  BUCKET_PRODUK: "produk",
  BUCKET_BANNER: "banner",

  // Batas upload gambar (dipakai di Tahap 5)
  MAX_UPLOAD_MB: 2,
  ALLOWED_IMAGE_TYPES: ["image/jpeg", "image/png", "image/webp"]
};
