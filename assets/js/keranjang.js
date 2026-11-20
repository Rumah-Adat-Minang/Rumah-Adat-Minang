/* keranjang.js - tombol "Tambahkan ke Keranjang" dan "Pesan Sekarang" di halaman produk.
   - Tombol disuntikkan ke setiap .product-card, baik kartu bawaan HTML maupun kartu dari database
     (MutationObserver memantau #product-grid, jadi tidak perlu mengubah site.js).
   - Keranjang disimpan di localStorage (tetap ada setelah halaman dimuat ulang).
   - Pesanan dikirim lewat WhatsApp toko, sama seperti formulir kontak.
   - Semua teks dimasukkan lewat textContent (aman dari injeksi HTML). */
(function () {
  "use strict";
  var STORE_KEY = "ram_keranjang_v1";
  var WA_DEFAULT = "6282260438462";   // cadangan; nomor dari database dipakai jika tersedia (window.SiteState)

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function mk(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function rupiah(n) { return "Rp. " + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, "."); }

  /* ---------- Penyimpanan ---------- */
  var cart = [];   // [{ key, nama, harga, qty }]
  function load() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      cart = Array.isArray(arr) ? arr.filter(function (i) {
        return i && typeof i.key === "string" && typeof i.nama === "string" && isFinite(i.harga) && isFinite(i.qty) && i.qty > 0;
      }).map(function (i) { return { key: i.key, nama: i.nama.slice(0, 200), harga: Number(i.harga), qty: Math.min(99, Math.floor(i.qty)) }; }) : [];
    } catch (e) { cart = []; }
  }
  function save() { try { window.localStorage.setItem(STORE_KEY, JSON.stringify(cart)); } catch (e) { /* abaikan */ } }

  /* ---------- Data produk dari kartu ---------- */
  function readCard(card) {
    var titles = $$(".product-info h3", card);
    var nama = titles[0] ? titles[0].textContent.replace(/\s+/g, " ").trim() : "";
    var strong = $(".product-info h3 strong", card);
    var harga = strong ? parseInt(strong.textContent.replace(/\D/g, ""), 10) : NaN;
    if (!nama || !isFinite(harga)) return null;
    return { key: nama.toLowerCase(), nama: nama, harga: harga };
  }

  /* ---------- Aksi keranjang ---------- */
  function addItem(p, qty) {
    var found = cart.filter(function (i) { return i.key === p.key; })[0];
    if (found) { found.qty = Math.min(99, found.qty + (qty || 1)); found.harga = p.harga; }
    else cart.push({ key: p.key, nama: p.nama, harga: p.harga, qty: qty || 1 });
    save(); renderCart();
  }
  function setQty(key, qty) {
    cart = cart.map(function (i) { return i.key === key ? { key: i.key, nama: i.nama, harga: i.harga, qty: Math.min(99, qty) } : i; })
               .filter(function (i) { return i.qty > 0; });
    save(); renderCart();
  }
  function total() { return cart.reduce(function (s, i) { return s + i.harga * i.qty; }, 0); }
  function count() { return cart.reduce(function (s, i) { return s + i.qty; }, 0); }

  /* ---------- WhatsApp ---------- */
  function waNumber() {
    var st = window.SiteState || {};
    return (st.wa && /^62\d{8,13}$/.test(st.wa)) ? st.wa : WA_DEFAULT;
  }
  function tokoName() { return (window.SiteState && window.SiteState.nama) || "Rumah Adat Minang"; }
  function openWhatsApp(items) {
    var lines = items.map(function (i, n) { return (n + 1) + ". " + i.nama + " x" + i.qty + " = " + rupiah(i.harga * i.qty); });
    var sum = items.reduce(function (s, i) { return s + i.harga * i.qty; }, 0);
    var teks = "Halo " + tokoName() + ", saya ingin memesan:\n\n" + lines.join("\n") + "\n\nTotal: " + rupiah(sum) + "\n\nMohon info ketersediaan dan cara pembayarannya. Terima kasih.";
    var url = "https://wa.me/" + waNumber() + "?text=" + encodeURIComponent(teks);
    var w = window.open(url, "_blank", "noopener");
    if (!w) window.location.href = url;   // popup diblokir: buka di tab yang sama
  }

  /* ---------- Notifikasi singkat ---------- */
  var toastTimer = null;
  function toast(msg) {
    var t = $("#cart-toast");
    if (!t) { t = mk("div", "cart-toast"); t.id = "cart-toast"; t.setAttribute("role", "status"); t.setAttribute("aria-live", "polite"); document.body.append(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2200);
  }

  /* ---------- Tombol di kartu produk ---------- */
  function enhanceCard(card) {
    if (card.dataset.cart) return;
    var p = readCard(card); if (!p) return;
    card.dataset.cart = "1";
    var box = mk("div", "cart-actions");
    var add = mk("button", "btn btn-outline cart-add", "🛒 Tambahkan ke Keranjang"); add.type = "button";
    var buy = mk("button", "btn btn-primary cart-buy", "Pesan Sekarang"); buy.type = "button";
    add.addEventListener("click", function () {
      var cur = readCard(card) || p; addItem(cur, 1); toast("“" + cur.nama + "” ditambahkan ke keranjang");
      var fab = $("#cart-fab"); if (fab) { fab.classList.remove("bump"); void fab.offsetWidth; fab.classList.add("bump"); }
    });
    buy.addEventListener("click", function () { var cur = readCard(card) || p; openWhatsApp([{ key: cur.key, nama: cur.nama, harga: cur.harga, qty: 1 }]); });
    box.append(add, buy);
    var info = $(".product-info", card); if (!info) return;
    var bottom = $(".product-bottom", info);
    if (bottom) bottom.before(box); else info.append(box);
  }
  function enhanceAll() { $$("#product-grid .product-card").forEach(enhanceCard); }

  /* ---------- Panel keranjang ---------- */
  var fab, panel, overlay, listEl, totalEl, emptyEl, footEl, lastFocus = null;
  function buildUI() {
    fab = mk("button", "cart-fab"); fab.id = "cart-fab"; fab.type = "button"; fab.setAttribute("aria-label", "Buka keranjang"); fab.setAttribute("aria-haspopup", "dialog");
    fab.append(mk("span", "cart-fab-icon", "🛒"), mk("span", "cart-fab-label", "Keranjang"), mk("span", "cart-badge", "0"));
    overlay = mk("div", "cart-overlay"); overlay.hidden = true;
    panel = mk("aside", "cart-panel"); panel.id = "cart-panel"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true"); panel.setAttribute("aria-label", "Keranjang belanja"); panel.hidden = true;
    var head = mk("div", "cart-head"); var h = mk("h2", "", "Keranjang Anda");
    var close = mk("button", "cart-close", "✕"); close.type = "button"; close.setAttribute("aria-label", "Tutup keranjang"); head.append(h, close);
    listEl = mk("ul", "cart-list");
    emptyEl = mk("p", "cart-empty", "Keranjang masih kosong. Pilih produk lalu tekan “Tambahkan ke Keranjang”.");
    footEl = mk("div", "cart-foot");
    var row = mk("div", "cart-total"); row.append(mk("span", "", "Total"), totalEl = mk("strong", "", "Rp. 0"));
    var order = mk("button", "btn btn-primary cart-order", "Pesan lewat WhatsApp ↗"); order.type = "button";
    var clear = mk("button", "cart-clear", "Kosongkan keranjang"); clear.type = "button";
    footEl.append(row, order, clear);
    panel.append(head, listEl, emptyEl, footEl);
    document.body.append(fab, overlay, panel);

    fab.addEventListener("click", openPanel);
    close.addEventListener("click", closePanel);
    overlay.addEventListener("click", closePanel);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) closePanel(); });
    order.addEventListener("click", function () { if (cart.length) openWhatsApp(cart); });
    clear.addEventListener("click", function () { if (cart.length && window.confirm("Kosongkan semua isi keranjang?")) { cart = []; save(); renderCart(); } });
    listEl.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-act]"); if (!b) return;
      var key = b.dataset.key, item = cart.filter(function (i) { return i.key === key; })[0]; if (!item) return;
      if (b.dataset.act === "plus") setQty(key, item.qty + 1);
      else if (b.dataset.act === "minus") setQty(key, item.qty - 1);
      else if (b.dataset.act === "del") setQty(key, 0);
    });
  }
  function openPanel() { lastFocus = document.activeElement; overlay.hidden = false; panel.hidden = false; document.documentElement.classList.add("cart-open"); requestAnimationFrame(function () { panel.classList.add("open"); overlay.classList.add("open"); }); var c = $(".cart-close", panel); if (c) c.focus(); }
  function closePanel() { panel.classList.remove("open"); overlay.classList.remove("open"); document.documentElement.classList.remove("cart-open"); setTimeout(function () { panel.hidden = true; overlay.hidden = true; }, 220); if (lastFocus && lastFocus.focus) lastFocus.focus(); }

  function renderCart() {
    if (!listEl) return;
    listEl.textContent = "";
    cart.forEach(function (i) {
      var li = mk("li", "cart-item");
      var info = mk("div", "cart-item-info"); info.append(mk("strong", "", i.nama), mk("span", "", rupiah(i.harga) + " / item"));
      var ctl = mk("div", "cart-qty");
      var minus = mk("button", "", "−"); minus.type = "button"; minus.dataset.act = "minus"; minus.dataset.key = i.key; minus.setAttribute("aria-label", "Kurangi jumlah " + i.nama);
      var q = mk("span", "", String(i.qty)); q.setAttribute("aria-label", "Jumlah");
      var plus = mk("button", "", "+"); plus.type = "button"; plus.dataset.act = "plus"; plus.dataset.key = i.key; plus.setAttribute("aria-label", "Tambah jumlah " + i.nama);
      ctl.append(minus, q, plus);
      var sub = mk("div", "cart-item-sub", rupiah(i.harga * i.qty));
      var del = mk("button", "cart-del", "Hapus"); del.type = "button"; del.dataset.act = "del"; del.dataset.key = i.key; del.setAttribute("aria-label", "Hapus " + i.nama + " dari keranjang");
      li.append(info, ctl, sub, del); listEl.append(li);
    });
    var n = count();
    totalEl.textContent = rupiah(total());
    emptyEl.hidden = n > 0; footEl.hidden = n === 0; listEl.hidden = n === 0;
    var badge = $(".cart-badge", fab); badge.textContent = String(n); badge.hidden = n === 0;
    fab.setAttribute("aria-label", "Buka keranjang, " + n + " item");
  }

  /* ---------- Jalankan ---------- */
  function init() {
    var grid = $("#product-grid"); if (!grid) return;
    load(); buildUI(); renderCart(); enhanceAll();
    new MutationObserver(enhanceAll).observe(grid, { childList: true });   // kartu dari database muncul belakangan
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
