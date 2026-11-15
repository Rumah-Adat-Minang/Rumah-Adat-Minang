/* admin-storage.js - upload, preview, dan hapus gambar di Supabase Storage.
   Dimuat SETELAH supabase-client.js dan admin-ui.js. Hasil: window.AdminStorage
   Aturan: hanya JPG/JPEG, PNG, WebP; maksimal APP_CONFIG.MAX_UPLOAD_MB (bawaan 2 MB).
   Format dicek dari ISI file (bukan hanya nama/ekstensi). Nama file di Storage
   selalu acak dan unik, jadi mengganti gambar tidak bentrok dengan cache. */
(function () {
  const cfg = () => window.APP_CONFIG || {};
  const maxMB = () => Number(cfg().MAX_UPLOAD_MB) || 2;
  const allowed = () => (cfg().ALLOWED_IMAGE_TYPES && cfg().ALLOWED_IMAGE_TYPES.length)
    ? cfg().ALLOWED_IMAGE_TYPES : ["image/jpeg", "image/png", "image/webp"];
  const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  const buckets = () => ({
    produk: cfg().BUCKET_PRODUK || "produk",
    banner: cfg().BUCKET_BANNER || "banner",
    toko: cfg().BUCKET_TOKO || "toko",
    beranda: cfg().BUCKET_BERANDA || "beranda"
  });
  const bucketName = k => buckets()[k] || k;

  function fmtSize(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }

  // Membaca byte awal file untuk memastikan benar-benar gambar JPEG/PNG/WebP
  async function sniffType(file) {
    const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const at = (sig, off) => sig.every((v, i) => b[(off || 0) + i] === v);
    if (at([0xFF, 0xD8, 0xFF])) return "image/jpeg";
    if (at([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) return "image/png";
    if (at([0x52, 0x49, 0x46, 0x46]) && at([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
    return null;
  }

  // Mengecilkan gambar yang terlalu besar (hanya di browser). Mengembalikan null jika gagal.
  async function optimize(file, maxBytes) {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(bmp, 0, 0, w, h);
    for (const [type, q] of [["image/webp", 0.85], ["image/webp", 0.7], ["image/jpeg", 0.8], ["image/jpeg", 0.6]]) {
      const blob = await new Promise(res => canvas.toBlob(res, type, q));
      if (blob && blob.type === type && blob.size <= maxBytes) return { blob, type };
    }
    return null;
  }

  // Validasi + (jika perlu) pengecilan. Hasil: {ok, blob, type, optimized, originalSize} atau {ok:false, message}
  async function prepare(file) {
    if (!file) return { ok: false, message: "Pilih file gambar terlebih dahulu." };
    const sniffed = await sniffType(file);
    if (!sniffed || !allowed().includes(sniffed))
      return { ok: false, message: "Format tidak didukung. Gunakan gambar JPG, JPEG, PNG, atau WebP." };
    const maxBytes = maxMB() * 1024 * 1024;
    let blob = file, type = sniffed, optimized = false;
    if (file.size > maxBytes) {
      try {
        const out = await optimize(file, maxBytes);
        if (out) { blob = out.blob; type = out.type; optimized = true; }
      } catch (e) { /* lanjut: ditolak di bawah */ }
    }
    if (blob.size > maxBytes)
      return { ok: false, message: "Ukuran file terlalu besar (" + fmtSize(file.size) + "). Maksimal " + maxMB() + " MB." };
    return { ok: true, blob, type, optimized, originalSize: file.size };
  }

  function newName() {
    const id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    return id;
  }

  function friendly(error) {
    const m = ((error && (error.message || error.error)) || "").toLowerCase();
    const s = Number(error && (error.statusCode || error.status));
    if (m.includes("mime") || m.includes("not supported")) return "Format file ditolak oleh server. Gunakan JPG, PNG, atau WebP.";
    if (s === 413 || m.includes("maximum allowed size") || m.includes("too large") || m.includes("payload")) return "Ukuran file melebihi batas server (" + maxMB() + " MB).";
    if (s === 401 || s === 403 || m.includes("row-level security") || m.includes("unauthorized") || m.includes("not allowed")) return "Tidak ada izin. Pastikan Anda sudah login sebagai admin.";
    if (m.includes("failed to fetch") || m.includes("network")) return "Tidak bisa terhubung ke server. Periksa koneksi internet.";
    if (m.includes("bucket not found")) return "Bucket belum ada. Jalankan supabase/05_storage.sql.";
    return "Gagal mengunggah. Silakan coba lagi.";
  }

  function publicUrl(bucketKey, path) {
    return window.db.storage.from(bucketName(bucketKey)).getPublicUrl(path).data.publicUrl;
  }

  async function uploadPrepared(bucketKey, prep) {
    if (!window.dbReady) return { ok: false, message: "Koneksi database belum siap." };
    if (!prep || !prep.ok) return prep || { ok: false, message: "File belum siap." };
    const bucket = bucketName(bucketKey);
    const path = newName() + "." + EXT[prep.type];              // ekstensi dari isi file, bukan dari nama asli
    const { error } = await window.db.storage.from(bucket).upload(path, prep.blob, {
      contentType: prep.type, cacheControl: "31536000", upsert: false
    });
    if (error) return { ok: false, message: friendly(error) };
    return { ok: true, bucket, path, url: publicUrl(bucketKey, path), optimized: prep.optimized };
  }

  async function upload(bucketKey, file) { return uploadPrepared(bucketKey, await prepare(file)); }

  async function remove(bucketKey, path) {
    if (!window.dbReady) return { ok: false, message: "Koneksi database belum siap." };
    if (!path || /(^|\/)\.\.(\/|$)/.test(path) || path.startsWith("/")) return { ok: false, message: "Lokasi file tidak valid." };
    const { data, error } = await window.db.storage.from(bucketName(bucketKey)).remove([path]);
    if (error) return { ok: false, message: friendly(error) };
    if (!data || data.length === 0) return { ok: false, message: "File tidak ditemukan atau tidak ada izin menghapus." };
    return { ok: true };
  }

  /* Komponen pilih gambar dengan preview (dipakai di form produk, banner, profil).
     const p = AdminStorage.createPicker(elemen, { currentUrl, onChange });
     p.hasChange()  -> apakah admin memilih gambar baru
     p.uploadTo("produk") -> unggah gambar terpilih, hasil {ok, path, url}
     p.clear() / p.setCurrent(url) */
  function createPicker(root, opts) {
    opts = opts || {};
    root.textContent = "";
    root.classList.add("picker");
    const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
    const frame = mk("div", "picker-frame");
    const img = mk("img", "picker-img"); img.alt = "Pratinjau gambar"; img.hidden = true;
    const empty = mk("span", "picker-empty", "Belum ada gambar");
    frame.append(img, empty);
    const input = document.createElement("input");
    input.type = "file"; input.accept = allowed().join(","); input.hidden = true;
    const row = mk("div", "picker-row");
    const pick = mk("button", "btn btn-ghost", "Pilih gambar"); pick.type = "button";
    const cancel = mk("button", "btn btn-ghost", "Batalkan pilihan"); cancel.type = "button"; cancel.hidden = true;
    row.append(pick, cancel);
    const info = mk("p", "hint");
    const note = mk("div", "msg"); note.setAttribute("role", "alert");
    root.append(frame, row, info, note, input);

    let prepared = null, objectUrl = null, currentUrl = opts.currentUrl || "";
    function show(src) { if (src) { img.src = src; img.hidden = false; empty.hidden = true; } else { img.removeAttribute("src"); img.hidden = true; empty.hidden = false; } }
    function revoke() { if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; } }
    function reset() { revoke(); prepared = null; input.value = ""; cancel.hidden = true; show(currentUrl); info.textContent = currentUrl ? "Gambar saat ini." : ""; }
    show(currentUrl); info.textContent = currentUrl ? "Gambar saat ini." : "JPG, PNG, atau WebP, maksimal " + maxMB() + " MB.";

    pick.addEventListener("click", () => input.click());
    cancel.addEventListener("click", () => { AdminUI.formMessage(note, ""); reset(); if (opts.onChange) opts.onChange(null); });
    input.addEventListener("change", async () => {
      const f = input.files && input.files[0];
      if (!f) return;
      AdminUI.formMessage(note, "");
      info.textContent = "Memeriksa gambar...";
      const prep = await prepare(f);
      if (!prep.ok) { reset(); AdminUI.formMessage(note, prep.message, "bad"); if (opts.onChange) opts.onChange(null); return; }
      revoke(); prepared = prep; objectUrl = URL.createObjectURL(prep.blob);
      show(objectUrl); cancel.hidden = false;
      info.textContent = f.name + " (" + fmtSize(prep.blob.size) + ")" +
        (prep.optimized ? ", dikecilkan dari " + fmtSize(prep.originalSize) : "") + ". Belum disimpan.";
      if (opts.onChange) opts.onChange(f);
    });

    return {
      hasChange: () => !!prepared,
      getPreviewUrl: () => objectUrl || currentUrl,
      uploadTo: (bucketKey) => uploadPrepared(bucketKey, prepared),
      clear: reset,
      setCurrent(url) { currentUrl = url || ""; reset(); }
    };
  }

  window.AdminStorage = { prepare, upload, uploadPrepared, remove, publicUrl, createPicker, sniffType, fmtSize };
})();
