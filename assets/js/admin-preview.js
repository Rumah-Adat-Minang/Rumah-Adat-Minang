/* admin-preview.js - pratinjau produk persis seperti kartu di halaman pengunjung.
   Kartu digambar di dalam iframe terisolasi yang memuat assets/css/style.css (CSS pengunjung),
   tanpa skrip (sandbox), dan semua teks dimasukkan lewat textContent. */
(function () {
  const SRC = '<!DOCTYPE html><html lang="id"><head><meta charset="utf-8">' +
    '<link rel="stylesheet" href="../assets/css/style.css"><link rel="stylesheet" href="../assets/css/tambahan.css">' +
    '<style>html,body{margin:0}body{padding:14px;background:#fbf6ec}.product-grid{display:grid;grid-template-columns:minmax(0,340px);justify-content:center}</style>' +
    '</head><body><div class="product-grid" id="g"></div></body></html>';

  // data: { nama, ukuran, harga (angka|null), kategori, deskripsi, imageUrl, aktif }
  function create() {
    const frame = document.createElement("iframe");
    frame.className = "preview-frame";
    frame.title = "Pratinjau produk seperti di halaman pengunjung";
    frame.setAttribute("sandbox", "allow-same-origin");
    frame.srcdoc = SRC;
    let ready = false, pending = null;

    function render(d) {
      const doc = frame.contentDocument;
      const g = doc && doc.getElementById("g");
      if (!g) return;
      const mk = (tag, cls, text) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
      const art = mk("article", "product-card");
      const vis = mk("div", "product-visual visual-cassava");
      if (d.aktif === false) vis.append(mk("span", "product-tag", "TERSEMBUNYI"));
      if (d.imageUrl) {
        vis.classList.add("has-photo");
        const img = mk("img", "product-image"); img.src = d.imageUrl; img.alt = d.nama || "Foto produk"; vis.append(img);
      } else {
        vis.append(mk("span", "product-emoji", "❋"), mk("span", "visual-caption", (d.nama || "NAMA PRODUK").toUpperCase()));
      }
      const info = mk("div", "product-info");
      info.append(mk("span", "product-category", d.kategori || "Tanpa kategori"));
      info.append(mk("h3", "", (d.nama || "Nama produk") + (d.ukuran ? " – " + d.ukuran : "")));
      const price = mk("h3", ""); price.append(mk("strong", "", d.harga == null ? "Harga belum diisi" : AdminLogic.hargaPublik(d.harga))); info.append(price);
      if (d.deskripsi) info.append(mk("p", "", d.deskripsi));
      const bottom = mk("div", "product-bottom"); bottom.append(mk("span", "text-link", "Tanya toko ↗")); info.append(bottom);
      art.append(vis, info);
      g.textContent = ""; g.append(art);
      const fit = () => { try { frame.style.height = Math.max(360, doc.documentElement.scrollHeight + 4) + "px"; } catch (e) { /* abaikan */ } };
      fit(); const img = g.querySelector("img"); if (img) img.addEventListener("load", fit);
      setTimeout(fit, 150);
    }

    frame.addEventListener("load", () => { ready = true; if (pending) render(pending); });
    return { el: frame, update(d) { pending = d; if (ready) render(d); } };
  }

  window.AdminPreview = { create };
})();
