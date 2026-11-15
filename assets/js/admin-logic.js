/* admin-logic.js - fungsi murni (tanpa tampilan): validasi form, normalisasi, pesan error.
   Aturannya mengikuti batasan di database (supabase/01_tabel.sql). */
(function (root) {
  const L = {};
  const one = v => (v == null ? "" : String(v)).replace(/\s+/g, " ").trim();   // satu baris
  const multi = v => (v == null ? "" : String(v)).trim();                       // boleh banyak baris
  const nul = s => (s === "" ? null : s);
  const intOrNull = v => { const s = String(v == null ? "" : v).trim(); if (s === "") return 0; const n = Number(s); return Number.isInteger(n) ? n : NaN; };

  L.slugify = t => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "");

  L.rupiah = n => "Rp " + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  L.isHttpUrl = s => /^https?:\/\/\S+$/i.test(s);

  L.normalizeWhatsapp = input => {
    const raw = String(input == null ? "" : input).trim();
    if (!raw) return { ok: true, value: null };
    let d = raw.replace(/[\s\-().]/g, "");
    if (d.startsWith("+")) d = d.slice(1);
    if (!/^\d+$/.test(d)) return { ok: false, message: "Nomor WhatsApp hanya boleh berisi angka." };
    if (d.startsWith("0")) d = "62" + d.slice(1); else if (d.startsWith("8")) d = "62" + d;
    if (!/^62\d{8,13}$/.test(d)) return { ok: false, message: "Nomor WhatsApp tidak valid. Contoh: 0822xxxxxxx atau 62822xxxxxxx." };
    return { ok: true, value: d };
  };

  function finish(errors, data) { return { ok: Object.keys(errors).length === 0, errors, data }; }

  L.validateKategori = i => {
    const e = {}, nama = one(i.nama), slug = (multi(i.slug).toLowerCase() || L.slugify(nama)), desk = multi(i.deskripsi), urutan = intOrNull(i.urutan);
    if (nama.length < 2 || nama.length > 80) e.nama = "Nama kategori 2 sampai 80 karakter.";
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) e.slug = "Slug hanya huruf kecil, angka, dan tanda hubung (contoh: keripik-ubi).";
    if (desk.length > 500) e.deskripsi = "Deskripsi maksimal 500 karakter.";
    if (Number.isNaN(urutan)) e.urutan = "Urutan harus berupa bilangan bulat.";
    return finish(e, { nama, slug, deskripsi: nul(desk), urutan, aktif: !!i.aktif });
  };

  L.validateBanner = i => {
    const e = {}, judul = one(i.judul), sub = one(i.subjudul), link = multi(i.tautan), urutan = intOrNull(i.urutan);
    if (judul.length < 2 || judul.length > 120) e.judul = "Judul banner 2 sampai 120 karakter.";
    if (sub.length > 300) e.subjudul = "Subjudul maksimal 300 karakter.";
    if (link && !/^(https?:\/\/\S+|[a-z0-9_-]+\.html(#\S*)?)$/i.test(link)) e.tautan = "Tautan harus diawali http:// atau https://, atau nama halaman seperti produk.html.";
    if (Number.isNaN(urutan)) e.urutan = "Urutan harus berupa bilangan bulat.";
    return finish(e, { judul, subjudul: nul(sub), tautan: nul(link), urutan, aktif: !!i.aktif });
  };


  // Harga: boleh "15000", "15.000", "Rp 15.000". Koma/desimal ditolak (rupiah bulat).
  L.parseHarga = v => {
    let s = String(v == null ? "" : v).trim();
    if (!s) return { ok: false, message: "Harga wajib diisi." };
    s = s.replace(/^rp\.?\s*/i, "").replace(/\s+/g, "");
    if (s.includes(",")) return { ok: false, message: "Gunakan angka bulat tanpa koma, contoh: 15000 atau 15.000." };
    if (!/^(\d{1,3}(\.\d{3})+|\d+)$/.test(s)) return { ok: false, message: "Harga harus berupa angka, contoh: 15000 atau 15.000." };
    const n = Number(s.replace(/\./g, ""));
    if (n > 2000000000) return { ok: false, message: "Harga terlalu besar." };
    return { ok: true, value: n };
  };
  // Format harga seperti di halaman pengunjung: "Rp. 15.000"
  L.hargaPublik = n => "Rp. " + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  L.validateProduk = i => {
    const e = {}, nama = one(i.nama), ukuran = one(i.ukuran), desk = multi(i.deskripsi), urutan = intOrNull(i.urutan);
    if (nama.length < 2 || nama.length > 120) e.nama = "Nama produk 2 sampai 120 karakter.";
    const h = L.parseHarga(i.harga); if (!h.ok) e.harga = h.message;
    if (ukuran.length > 40) e.ukuran = "Ukuran maksimal 40 karakter.";
    if (desk.length > 2000) e.deskripsi = "Deskripsi maksimal 2000 karakter.";
    if (Number.isNaN(urutan)) e.urutan = "Urutan harus berupa bilangan bulat.";
    return finish(e, { nama, harga: h.ok ? h.value : null, kategori_id: multi(i.kategori_id) || null, ukuran: nul(ukuran), deskripsi: nul(desk), urutan, aktif: !!i.aktif });
  };


  L.validateBerandaSlot = i => {
    const e = {}, alt = one(i.alt_text);
    if (alt.length > 160) e.alt_text = "Teks pengganti gambar maksimal 160 karakter.";
    return finish(e, { alt_text: nul(alt) });
  };
  L.validateBerandaPilihan = i => {
    const e = {}, label = one(i.label), judul = one(i.judul), desk = one(i.deskripsi), link = multi(i.tautan), urutan = intOrNull(i.urutan);
    if (label.length > 60) e.label = "Label maksimal 60 karakter.";
    if (judul.length < 2 || judul.length > 120) e.judul = "Judul 2 sampai 120 karakter.";
    if (desk.length > 300) e.deskripsi = "Deskripsi maksimal 300 karakter.";
    if (link && !/^(https?:\/\/\S+|[a-z0-9_-]+\.html(#\S*)?)$/i.test(link)) e.tautan = "Tautan harus diawali http:// atau https://, atau nama halaman seperti produk.html.";
    if (Number.isNaN(urutan)) e.urutan = "Urutan harus berupa bilangan bulat.";
    return finish(e, { label: nul(label), judul, deskripsi: nul(desk), tautan: nul(link), urutan, aktif: !!i.aktif });
  };

  L.validateProfil = i => {
    const e = {}, d = {};
    d.nama_toko = one(i.nama_toko);
    if (d.nama_toko.length < 2 || d.nama_toko.length > 120) e.nama_toko = "Nama toko 2 sampai 120 karakter.";
    const lim = (k, max, label, single) => { const v = single ? one(i[k]) : multi(i[k]); if (v.length > max) e[k] = label + " maksimal " + max + " karakter."; d[k] = nul(v); };
    lim("tagline", 200, "Tagline", true); lim("deskripsi", 1000, "Deskripsi", false); lim("alamat", 300, "Alamat", false);
    lim("jam_operasional", 120, "Jam operasional", true); lim("telepon", 30, "Telepon", true);
    const wa = L.normalizeWhatsapp(i.whatsapp); if (!wa.ok) e.whatsapp = wa.message; d.whatsapp = wa.ok ? wa.value : null;
    const mail = one(i.email); if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) e.email = "Alamat email tidak valid."; d.email = nul(mail);
    ["maps_url", "instagram_url", "facebook_url", "tiktok_url"].forEach(k => {
      const v = multi(i[k]); if (v && !L.isHttpUrl(v)) e[k] = "Tautan harus diawali http:// atau https://."; d[k] = nul(v);
    });
    return finish(e, d);
  };

  L.validatePengaturan = i => {
    const e = {}, d = {};
    d.judul_situs = one(i.judul_situs);
    if (d.judul_situs.length < 2 || d.judul_situs.length > 120) e.judul_situs = "Judul situs 2 sampai 120 karakter.";
    [["deskripsi_situs", 300, "Deskripsi situs"], ["teks_topbar_kiri", 200, "Teks"], ["teks_topbar_kanan", 200, "Teks"],
     ["teks_footer_1", 200, "Teks"], ["teks_footer_2", 200, "Teks"]].forEach(([k, max, label]) => {
      const v = one(i[k]); if (v.length > max) e[k] = label + " maksimal " + max + " karakter."; d[k] = nul(v);
    });
    d.tampilkan_banner = !!i.tampilkan_banner;
    return finish(e, d);
  };

  L.dbError = err => {
    if (!err) return "";
    const c = err.code, m = (err.message || "").toLowerCase();
    if (c === "23505") return "Data dengan nama atau slug yang sama sudah ada.";
    if (c === "23514") return "Data tidak memenuhi aturan database. Periksa isian form.";
    if (c === "23503") return "Data masih dipakai oleh data lain.";
    if (c === "42501" || /row-level security|permission denied/.test(m)) return "Tidak ada izin. Pastikan Anda masih login sebagai admin.";
    if (/failed to fetch|network/.test(m)) return "Tidak bisa terhubung ke server. Periksa koneksi internet.";
    return "Terjadi kesalahan pada database. Silakan coba lagi.";
  };

  if (typeof module !== "undefined" && module.exports) module.exports = L; else root.AdminLogic = L;
})(typeof window !== "undefined" ? window : globalThis);
