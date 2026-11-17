/* site.js - menghubungkan halaman pengunjung dengan data Supabase (hanya MEMBACA).
   - Memakai kunci anon lewat REST (fetch). Pengunjung tidak bisa mengubah data (RLS).
   - Jika database tidak terjangkau atau config belum diisi, isi HTML bawaan tetap tampil.
   - Semua teks dari database dimasukkan lewat textContent (aman dari injeksi HTML). */
(function () {
  "use strict";
  const cfg = window.APP_CONFIG || {};
  const BASE = String(cfg.SUPABASE_URL || "").replace(/\/+$/, "");
  const KEY = String(cfg.SUPABASE_ANON_KEY || "");
  const CONFIGURED = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(BASE) && KEY && !/GANTI/.test(BASE + KEY);
  const state = { wa: null, nama: "Rumah Adat Minang" };

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  function mk(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  const done = () => document.documentElement.classList.remove("site-wait");

  const safeLink = u => (u && /^(https?:\/\/\S+|[a-z0-9_-]+\.html(#\S*)?)$/i.test(u)) ? u : null;
  const safeUrl = u => (u && /^https?:\/\/\S+$/i.test(u)) ? u : null;
  const hargaPublik = n => "Rp. " + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const imgUrl = (bucket, path) => BASE + "/storage/v1/object/public/" + bucket + "/" + encodeURI(path);
  const isExternal = u => /^https?:\/\//i.test(u);

  async function api(path) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
    try {
      const r = await fetch(BASE + "/rest/v1/" + path, { headers: { apikey: KEY, Authorization: "Bearer " + KEY, Accept: "application/json" }, signal: ctl.signal });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }

  // ---------- Teks umum: bilah atas, footer, judul ----------
  function keepPrefix(el, value) {            // pertahankan simbol hias di awal teks (mis. "✦ ")
    const m = (el.textContent || "").match(/^([^\p{L}\p{N}]+)/u);
    const pre = m ? m[1] : "";
    el.textContent = pre && !value.startsWith(pre.trim()) ? pre + value : value;
  }
  function applySettings(s) {
    if (!s) return;
    const spans = $$(".topbar-inner span");
    if (s.teks_topbar_kiri && spans[0]) keepPrefix(spans[0], s.teks_topbar_kiri);
    if (s.teks_topbar_kanan && spans[spans.length - 1] && spans.length > 1) keepPrefix(spans[spans.length - 1], s.teks_topbar_kanan);
    const fp = $(".footer-main > p");
    if (fp && (s.teks_footer_1 || s.teks_footer_2)) {
      fp.textContent = "";
      if (s.teks_footer_1) fp.append(s.teks_footer_1);
      if (s.teks_footer_1 && s.teks_footer_2) fp.append(document.createElement("br"));
      if (s.teks_footer_2) fp.append(mk("strong", "", s.teks_footer_2));
    }
    if (s.judul_situs && document.title.includes("|")) document.title = document.title.split("|")[0].trim() + " | " + s.judul_situs;
    const md = $('meta[name="description"]'); if (md && s.deskripsi_situs && $(".h-hero")) md.setAttribute("content", s.deskripsi_situs);   // hanya beranda; halaman lain punya deskripsi sendiri
  }

  // ---------- Profil toko: logo, lokasi, kontak ----------
  function contactItem(icon, label, node) {
    const it = mk("div", "contact-item"); const box = mk("div"); box.append(mk("strong", "", label)); box.append(document.createElement("br")); box.append(node);
    it.append(mk("span", "contact-icon", icon), box); return it;
  }
  function applyProfil(p) {
    if (!p) return;
    if (p.nama_toko) state.nama = p.nama_toko;
    if (p.whatsapp && /^62\d{8,13}$/.test(p.whatsapp)) state.wa = p.whatsapp;
    if (p.logo_path) $$(".brand-mark img").forEach(i => { i.src = imgUrl("toko", p.logo_path); });

    const set = (sel, txt) => { const e = $(sel); if (e && txt) e.textContent = txt; };
    set('[data-site="alamat"]', p.alamat);
    set('[data-site="jam"]', p.jam_operasional);
    const wa = $('[data-site="wa"]');
    if (wa && state.wa) { wa.href = "https://wa.me/" + state.wa; wa.textContent = p.telepon || ("0" + state.wa.slice(2)); }
    const maps = safeUrl(p.maps_url);
    if (maps) $$('[data-site="maps"]').forEach(a => { a.href = maps; });

    const list = $(".contact-list");                       // email dan media sosial (hanya jika diisi)
    if (list && !list.dataset.extra) {
      list.dataset.extra = "1";
      if (p.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) { const a = mk("a", "", p.email); a.href = "mailto:" + p.email; list.append(contactItem("✉", "Email", a)); }
      [["instagram_url", "Instagram", "◎"], ["facebook_url", "Facebook", "◍"], ["tiktok_url", "TikTok", "♪"]].forEach(([k, label, ic]) => {
        const u = safeUrl(p[k]); if (!u) return;
        const a = mk("a", "", label); a.href = u; a.target = "_blank"; a.rel = "noopener noreferrer"; list.append(contactItem(ic, label, a));
      });
    }
  }

  // ---------- Formulir kontak -> WhatsApp toko ----------
  function setupContactForm() {
    const form = $("#contact-form"); if (!form) return;
    const fb = $("#form-feedback");
    if (!state.wa) { const a = $('a[href^="https://wa.me/"]'); const m = a && a.getAttribute("href").match(/wa\.me\/(62\d{8,13})/); if (m) state.wa = m[1]; }
    form.addEventListener("submit", e => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      fb.textContent = "";
      if (!state.wa) { fb.textContent = "Nomor WhatsApp toko belum tersedia. Silakan hubungi lewat kontak yang tertera di atas."; return; }
      const nama = form.elements.name.value.trim(), email = (form.elements.email.value || "").trim(), pesan = form.elements.message.value.trim();
      const teks = "Halo " + state.nama + ", saya " + nama + ".\n\n" + pesan + (email ? "\n\nEmail: " + email : "");
      const url = "https://wa.me/" + state.wa + "?text=" + encodeURIComponent(teks);
      const w = window.open(url, "_blank", "noopener");
      fb.append("Membuka WhatsApp... Jika belum terbuka, ");
      const a = mk("a", "", "klik di sini"); a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; fb.append(a, ".");
      if (!w) { /* popup diblokir: tautan di atas tetap bisa diklik */ }
      form.reset();
    });
  }

  // ---------- Katalog produk ----------
  const filt = { term: "", cat: "" };
  function applyFilter() {
    const grid = $("#product-grid"); if (!grid) return;
    let visible = 0;
    $$(".product-card", grid).forEach(c => {
      const ok = (!filt.term || (c.dataset.name || "").toLowerCase().includes(filt.term)) && (!filt.cat || c.dataset.category === filt.cat);
      c.hidden = !ok; if (ok) visible++;
    });
    const nr = $("#no-results"); if (nr) nr.hidden = visible !== 0 || !$(".product-card", grid);
  }
  function setupSearch() {
    const s = $("#product-search"); if (!s) return;
    s.addEventListener("input", () => { filt.term = s.value.trim().toLowerCase(); applyFilter(); });
  }
  function productCard(p, catName) {
    const art = mk("article", "product-card"); art.dataset.name = p.nama.toLowerCase(); art.dataset.category = p.kategori_id || "";
    const vis = mk("div", "product-visual visual-cassava");
    if (p.gambar_path) {
      vis.classList.add("has-photo");
      const img = mk("img", "product-image"); img.src = imgUrl("produk", p.gambar_path); img.alt = p.nama; img.loading = "lazy"; img.decoding = "async"; vis.append(img);
    } else { vis.append(mk("span", "product-emoji", "❋"), mk("span", "visual-caption", p.nama.toUpperCase())); }
    const info = mk("div", "product-info");
    if (catName) info.append(mk("span", "product-category", catName));
    info.append(mk("h3", "", p.nama + (p.ukuran ? " – " + p.ukuran : "")));
    const price = mk("h3"); price.append(mk("strong", "", hargaPublik(p.harga))); info.append(price);
    if (p.deskripsi) info.append(mk("p", "", p.deskripsi));
    const bottom = mk("div", "product-bottom"); const a = mk("a", "text-link", "Tanya toko ↗"); a.href = "lokasi.html"; bottom.append(a); info.append(bottom);
    art.append(vis, info); return art;
  }
  function renderCategories(cats, used) {
    const old = $("#category-filter"); if (old) old.remove();
    const list = cats.filter(c => used.has(c.id));
    if (list.length < 1) return;
    const box = mk("div", "category-filter"); box.id = "category-filter"; box.setAttribute("role", "group"); box.setAttribute("aria-label", "Filter kategori");
    const mkChip = (label, id) => { const b = mk("button", "cat-chip", label); b.type = "button"; b.dataset.cat = id; b.setAttribute("aria-pressed", String(id === filt.cat)); return b; };
    box.append(mkChip("Semua", ""), ...list.map(c => mkChip(c.nama, c.id)));
    box.addEventListener("click", e => {
      const b = e.target.closest(".cat-chip"); if (!b) return;
      filt.cat = b.dataset.cat; $$(".cat-chip", box).forEach(x => x.setAttribute("aria-pressed", String(x === b))); applyFilter();
    });
    $("#product-grid").before(box);
  }
  async function loadProducts() {
    const grid = $("#product-grid"); if (!grid) return;
    const note = mk("p", "loading-note", "Memuat produk..."); grid.before(note);
    try {
      const [prods, cats] = await Promise.all([
        api("produk?select=id,nama,harga,ukuran,deskripsi,gambar_path,kategori_id,urutan&aktif=eq.true&order=urutan.asc,nama.asc"),
        api("kategori?select=id,nama,slug,urutan&aktif=eq.true&order=urutan.asc,nama.asc").catch(() => [])
      ]);
      const catMap = new Map(cats.map(c => [c.id, c.nama]));
      grid.textContent = "";
      prods.forEach(p => { if (!catMap.has(p.kategori_id)) p.kategori_id = null; grid.append(productCard(p, catMap.get(p.kategori_id))); });   // kategori tersembunyi dianggap tanpa kategori
      if (!prods.length) { const em = mk("p", "empty-state", "Produk belum tersedia. Silakan kunjungi kembali nanti."); em.id = "catalog-empty"; grid.append(em); }
      renderCategories(cats, new Set(prods.map(p => p.kategori_id).filter(Boolean)));
      applyFilter();
    } catch (e) { /* database tidak terjangkau: katalog bawaan di HTML tetap tampil */ }
    note.remove();
  }

  // ---------- Beranda: gambar, kartu pilihan, banner ----------
  function revertOnError(img, fallback) { img.addEventListener("error", () => { if (img.src !== fallback) img.src = fallback; }, { once: true }); }
  function applySlot(selector, row) {
    const img = $(selector); if (!img || !row) return;
    const fallback = img.getAttribute("src");
    revertOnError(img, new URL(fallback, document.baseURI).href);
    img.src = imgUrl("beranda", row.gambar_path);
    const alt = row.alt_text || row.judul; if (alt) img.alt = alt;
  }
  function pilihanCard(r) {
    const art = mk("article", "h-product");
    const ph = mk("div", "h-photo"); const img = mk("img"); img.src = imgUrl("beranda", r.gambar_path); img.alt = r.alt_text || r.judul || "Gambar pilihan"; img.loading = "lazy"; img.decoding = "async"; ph.append(img);
    const body = mk("div", "h-pbody");
    if (r.label) body.append(mk("small", "", r.label));
    if (r.judul) body.append(mk("h3", "", r.judul));
    if (r.deskripsi) body.append(mk("p", "", r.deskripsi));
    const href = safeLink(r.tautan) || "produk.html"; const a = mk("a", "", isExternal(href) ? "Selengkapnya ↗" : "Lihat katalog ↗"); a.href = href;
    if (isExternal(href)) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
    body.append(a); art.append(ph, body); return art;
  }
  function renderBanners(rows) {
    const hero = $(".h-hero"); if (!hero || !rows.length || $("#promo")) return;
    const wrap = mk("section", "promo-wrap"); wrap.id = "promo"; const c = mk("div", "container");
    const box = mk("div", "promo" + (rows.length === 1 ? " single" : "")); box.setAttribute("role", "region"); box.setAttribute("aria-roledescription", "carousel"); box.setAttribute("aria-label", "Promo");
    const track = mk("div", "promo-track");
    rows.forEach(r => {
      const href = safeLink(r.tautan); const slide = href ? mk("a", "promo-slide") : mk("div", "promo-slide");
      if (href) { slide.href = href; if (isExternal(href)) { slide.target = "_blank"; slide.rel = "noopener noreferrer"; } }
      const img = mk("img"); img.src = imgUrl("banner", r.gambar_path); img.alt = r.judul || "Promo"; img.loading = "lazy"; slide.append(img);
      const tx = mk("div", "promo-text"); tx.append(mk("strong", "", r.judul)); if (r.subjudul) tx.append(mk("span", "", r.subjudul)); slide.append(tx); track.append(slide);
    });
    box.append(track); c.append(box); wrap.append(c); hero.after(wrap);
    if (rows.length < 2) return;
    const dots = mk("div", "promo-dots"); const btns = rows.map((r, i) => { const b = mk("button"); b.type = "button"; b.setAttribute("aria-label", "Promo " + (i + 1)); dots.append(b); return b; });
    const prev = mk("button", "promo-nav prev", "‹"), next = mk("button", "promo-nav next", "›"); prev.type = next.type = "button"; prev.setAttribute("aria-label", "Sebelumnya"); next.setAttribute("aria-label", "Berikutnya");
    box.append(prev, next, dots);
    let idx = 0, timer = null;
    const go = i => { idx = (i + rows.length) % rows.length; track.scrollTo({ left: idx * track.clientWidth, behavior: "smooth" }); };
    const sync = () => { idx = Math.round(track.scrollLeft / (track.clientWidth || 1)); btns.forEach((b, i) => b.setAttribute("aria-current", String(i === idx))); };
    track.addEventListener("scroll", () => { clearTimeout(sync.t); sync.t = setTimeout(sync, 60); });
    btns.forEach((b, i) => b.addEventListener("click", () => { go(i); restart(); }));
    prev.addEventListener("click", () => { go(idx - 1); restart(); }); next.addEventListener("click", () => { go(idx + 1); restart(); });
    const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stop = () => { clearInterval(timer); timer = null; };
    function restart() { stop(); if (!reduce && !document.hidden) timer = setInterval(() => go(idx + 1), 5500); }
    box.addEventListener("mouseenter", stop); box.addEventListener("mouseleave", restart); box.addEventListener("focusin", stop); box.addEventListener("focusout", restart);
    document.addEventListener("visibilitychange", restart); sync(); restart();
  }
  async function loadBeranda(settings) {
    if (!$(".h-hero")) return;
    const [gam, ban] = await Promise.all([
      api("beranda_gambar?select=*&aktif=eq.true&order=urutan.asc,created_at.asc").catch(() => []),
      (!settings || settings.tampilkan_banner !== false) ? api("banner?select=judul,subjudul,gambar_path,tautan,urutan&aktif=eq.true&order=urutan.asc").catch(() => []) : Promise.resolve([])
    ]);
    applySlot(".h-logo img", gam.find(r => r.slot === "hero"));
    applySlot(".h-story-img img", gam.find(r => r.slot === "cerita"));
    const pil = gam.filter(r => r.slot === "pilihan"), box = $(".h-products");
    if (box && pil.length) { box.textContent = ""; pil.forEach(r => box.append(pilihanCard(r))); }
    renderBanners(ban);
  }

  // ---------- Jalankan ----------
  async function init() {
    setupSearch(); setupContactForm();
    if (!CONFIGURED) { done(); return; }
    let settings = null;
    try {
      const [s, p] = await Promise.all([
        api("pengaturan_website?select=*&id=eq.1").catch(() => []),
        api("profil_toko?select=*&id=eq.1").catch(() => [])
      ]);
      settings = s[0] || null; applySettings(settings); applyProfil(p[0] || null);
    } catch (e) { /* abaikan */ }
    await Promise.all([loadProducts(), loadBeranda(settings).catch(() => {})]);
    done();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
