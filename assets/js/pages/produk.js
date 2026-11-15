/* Kelola produk: tambah, ubah, hapus, tampil/sembunyikan, foto, pratinjau, cari, filter */
(async function () {
  const user = await AdminLayout.init({ active: "produk" });
  if (!user) return;
  const { el } = AdminUI, L = window.AdminLogic, db = window.db, $ = id => document.getElementById(id);
  const KEYS = ["nama", "harga", "ukuran", "deskripsi", "urutan"];
  let kategori = [], rows = [], editing = null, timer = null, seq = 0;

  const picker = AdminStorage.createPicker($("picker"), { onChange: () => refreshPreview() });
  const preview = AdminPreview.create();
  $("preview-slot").append(preview.el);

  const imgUrl = p => AdminStorage.publicUrl("produk", p);
  const catName = id => { const k = kategori.find(x => x.id === id); return k ? k.nama : ""; };

  // ---------- Pratinjau ----------
  function currentData() {
    const h = L.parseHarga($("f-harga").value);
    let img = picker.getPreviewUrl();
    if (editing && !picker.hasChange() && $("f-hapus-gambar").checked) img = "";
    return { nama: $("f-nama").value.trim(), ukuran: $("f-ukuran").value.trim(), harga: h.ok ? h.value : null,
      kategori: catName($("f-kategori_id").value), deskripsi: $("f-deskripsi").value.trim(), imageUrl: img, aktif: $("f-aktif").checked };
  }
  function refreshPreview() {
    $("remove-row").hidden = !(editing && editing.gambar_path && !picker.hasChange());
    preview.update(currentData());
  }
  ["f-nama", "f-harga", "f-ukuran", "f-deskripsi"].forEach(id => $(id).addEventListener("input", refreshPreview));
  ["f-kategori_id", "f-aktif", "f-hapus-gambar"].forEach(id => $(id).addEventListener("change", refreshPreview));

  function showRowPreview(p) {
    const pv = AdminPreview.create();
    pv.update({ nama: p.nama, ukuran: p.ukuran || "", harga: p.harga, kategori: p.kategori ? p.kategori.nama : "", deskripsi: p.deskripsi || "",
      imageUrl: p.gambar_path ? imgUrl(p.gambar_path) : "", aktif: p.aktif });
    AdminUI.showModal(pv.el, { title: "Pratinjau produk" });
  }

  // ---------- Data ----------
  async function loadKategori() {
    const { data } = await db.from("kategori").select("id,nama,aktif").order("urutan").order("nama");
    kategori = data || [];
    kategori.forEach(k => {
      const label = k.nama + (k.aktif ? "" : " (tersembunyi)");
      $("f-kategori_id").append(el("option", { value: k.id, text: label }));
      $("kat").append(el("option", { value: k.id, text: label }));
    });
    $("kat-hint").textContent = kategori.length ? "" : "Belum ada kategori. Buat dulu di menu Kelola Kategori.";
  }

  async function load() {
    const mine = ++seq;
    let q = db.from("produk").select("*, kategori:kategori_id(nama)").order("urutan").order("nama");
    const term = $("q").value.trim();
    if (term) q = q.ilike("nama", "%" + term.replace(/[\\%_]/g, "\\$&") + "%");
    const cat = $("kat").value;
    if (cat === "none") q = q.is("kategori_id", null); else if (cat) q = q.eq("kategori_id", cat);
    const st = $("st").value;
    if (st === "1") q = q.eq("aktif", true); else if (st === "0") q = q.eq("aktif", false);
    const { data, error } = await q;
    if (mine !== seq) return;                                   // abaikan hasil yang sudah usang
    const body = $("rows"); body.textContent = "";
    if (error) { AdminUI.toast(L.dbError(error), "bad"); $("empty").textContent = "Gagal memuat produk."; return; }
    rows = data || [];
    $("count").textContent = rows.length + " produk";
    $("empty").textContent = rows.length ? "" : (term || cat || st ? "Tidak ada produk yang cocok dengan pencarian." : "Belum ada produk. Klik \"Tambah produk\" untuk membuat yang pertama.");
    rows.forEach(p => {
      const img = p.gambar_path ? el("img", { class: "thumb", src: imgUrl(p.gambar_path), alt: "Foto " + p.nama, loading: "lazy" })
                                : el("div", { class: "thumb-empty", text: "Tanpa foto" });
      body.append(el("tr", {},
        el("td", {}, img),
        el("td", {}, el("strong", { text: p.nama }), p.ukuran ? el("div", { class: "hint", text: p.ukuran }) : null),
        el("td", { text: p.kategori ? p.kategori.nama : "Tanpa kategori" }),
        el("td", { text: L.rupiah(p.harga) }),
        el("td", {}, el("span", { class: "badge " + (p.aktif ? "on" : "off"), text: p.aktif ? "Tampil" : "Tersembunyi" })),
        el("td", {}, el("div", { class: "actions" },
          el("button", { class: "btn btn-ghost btn-sm", type: "button", text: "Pratinjau", onclick: () => showRowPreview(p) }),
          el("button", { class: "btn btn-ghost btn-sm", type: "button", text: "Ubah", onclick: () => openForm(p) }),
          el("button", { class: "btn btn-ghost btn-sm", type: "button", text: p.aktif ? "Sembunyikan" : "Tampilkan", onclick: () => toggle(p) }),
          el("button", { class: "btn btn-danger btn-sm", type: "button", text: "Hapus", onclick: () => remove(p) })))));
    });
  }

  // ---------- Form ----------
  function openForm(p) {
    editing = p || null;
    $("form-title").textContent = p ? "Ubah produk" : "Tambah produk";
    $("f-nama").value = p ? p.nama : ""; $("f-harga").value = p ? String(p.harga) : "";
    $("f-ukuran").value = p ? (p.ukuran || "") : ""; $("f-deskripsi").value = p ? (p.deskripsi || "") : "";
    $("f-kategori_id").value = p && p.kategori_id ? p.kategori_id : "";
    $("f-urutan").value = p ? p.urutan : (rows.length ? Math.max(...rows.map(x => x.urutan)) + 1 : 0);
    $("f-aktif").checked = p ? p.aktif : true;
    $("f-hapus-gambar").checked = false;
    picker.setCurrent(p && p.gambar_path ? imgUrl(p.gambar_path) : "");
    AdminUI.showErrors({}, KEYS); AdminUI.formMessage($("form-msg"), "");
    $("form-panel").hidden = false; refreshPreview(); $("f-nama").focus();
    $("form-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function closeForm() { $("form-panel").hidden = true; editing = null; picker.clear(); }

  async function toggle(p) {
    const { data, error } = await db.from("produk").update({ aktif: !p.aktif }).eq("id", p.id).select();
    if (error || !data || !data.length) return AdminUI.toast(error ? L.dbError(error) : "Perubahan ditolak. Pastikan Anda login sebagai admin.", "bad");
    AdminUI.toast(p.aktif ? "Produk disembunyikan dari website." : "Produk ditampilkan di website.", "ok");
    load();
  }

  async function remove(p) {
    if (!(await AdminUI.confirm("Hapus produk \"" + p.nama + "\"?" + (p.gambar_path ? " Fotonya juga akan dihapus." : "") + " Tindakan ini tidak bisa dibatalkan. Jika hanya ingin menyembunyikan dari website, gunakan tombol Sembunyikan.", { title: "Hapus produk", confirmText: "Ya, hapus", danger: true }))) return;
    const { data, error } = await db.from("produk").delete().eq("id", p.id).select();
    if (error || !data || !data.length) return AdminUI.toast(error ? L.dbError(error) : "Penghapusan ditolak. Pastikan Anda login sebagai admin.", "bad");
    let fileOk = true;
    if (p.gambar_path) fileOk = (await AdminStorage.remove("produk", p.gambar_path)).ok;
    AdminUI.toast(fileOk ? "Produk berhasil dihapus." : "Produk dihapus, tetapi file fotonya belum terhapus dari Storage.", fileOk ? "ok" : "info");
    load();
  }

  $("btn-add").addEventListener("click", () => openForm(null));
  $("btn-cancel").addEventListener("click", closeForm);

  $("form").addEventListener("submit", async e => {
    e.preventDefault();
    const v = L.validateProduk({ nama: $("f-nama").value, harga: $("f-harga").value, kategori_id: $("f-kategori_id").value, ukuran: $("f-ukuran").value,
      deskripsi: $("f-deskripsi").value, urutan: $("f-urutan").value, aktif: $("f-aktif").checked });
    AdminUI.showErrors(v.errors, KEYS);
    if (!v.ok) return AdminUI.formMessage($("form-msg"), "Periksa isian yang bertanda merah.", "bad");

    const btn = $("btn-save"); AdminUI.setBusy(btn, true, "Menyimpan...");
    const fail = t => { AdminUI.setBusy(btn, false); AdminUI.formMessage($("form-msg"), t, "bad"); };
    let newPath = null;
    if (picker.hasChange()) {
      const up = await picker.uploadTo("produk");
      if (!up.ok) return fail(up.message);
      newPath = up.path;
    }
    const dropImage = !!(editing && editing.gambar_path && !newPath && $("f-hapus-gambar").checked);
    const payload = Object.assign({}, v.data);
    if (newPath) payload.gambar_path = newPath; else if (dropImage) payload.gambar_path = null;

    const res = editing
      ? await db.from("produk").update(payload).eq("id", editing.id).select()
      : await db.from("produk").insert(payload).select();
    if (res.error || !res.data || !res.data.length) {
      if (newPath) await AdminStorage.remove("produk", newPath);            // batalkan unggahan agar tidak jadi file yatim
      return fail(res.error ? L.dbError(res.error) : "Penyimpanan ditolak. Pastikan Anda login sebagai admin.");
    }
    if (editing && editing.gambar_path && (newPath || dropImage)) {          // foto lama dihapus SETELAH data baru tersimpan
      const f = await AdminStorage.remove("produk", editing.gambar_path);
      if (!f.ok) AdminUI.toast("Produk tersimpan, tetapi file foto lama belum terhapus.", "info");
    }
    AdminUI.setBusy(btn, false);
    AdminUI.toast(editing ? "Produk berhasil diperbarui." : "Produk berhasil ditambahkan.", "ok");
    closeForm(); load();
  });

  $("q").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(load, 300); });
  $("kat").addEventListener("change", load);
  $("st").addEventListener("change", load);
  await loadKategori();
  await load();
})();
