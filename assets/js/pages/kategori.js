/* Kelola kategori: tambah, ubah, tampil/sembunyikan, hapus */
(async function () {
  const user = await AdminLayout.init({ active: "kategori" });
  if (!user) return;
  const { el } = AdminUI, L = window.AdminLogic, db = window.db, $ = id => document.getElementById(id);
  const KEYS = ["nama", "slug", "deskripsi", "urutan"];
  let rows = [], counts = {}, editingId = null, slugTouched = false;

  async function load() {
    const [k, p] = await Promise.all([
      db.from("kategori").select("*").order("urutan").order("nama"),
      db.from("produk").select("kategori_id")
    ]);
    if (k.error || p.error) { AdminUI.toast(L.dbError(k.error || p.error), "bad"); $("empty").textContent = "Gagal memuat kategori."; return; }
    rows = k.data || []; counts = {};
    (p.data || []).forEach(r => { if (r.kategori_id) counts[r.kategori_id] = (counts[r.kategori_id] || 0) + 1; });
    render();
  }

  function render() {
    const body = $("rows"); body.textContent = "";
    $("empty").textContent = rows.length ? "" : "Belum ada kategori. Klik \"Tambah kategori\" untuk membuat yang pertama.";
    rows.forEach(r => body.append(el("tr", {},
      el("td", {}, el("strong", { text: r.nama }), r.deskripsi ? el("div", { class: "hint", text: r.deskripsi }) : null),
      el("td", { text: r.slug }),
      el("td", { text: String(r.urutan) }),
      el("td", { text: String(counts[r.id] || 0) }),
      el("td", {}, el("span", { class: "badge " + (r.aktif ? "on" : "off"), text: r.aktif ? "Tampil" : "Tersembunyi" })),
      el("td", {}, el("div", { class: "actions" },
        el("button", { class: "btn btn-ghost btn-sm", type: "button", text: "Ubah", onclick: () => openForm(r) }),
        el("button", { class: "btn btn-ghost btn-sm", type: "button", text: r.aktif ? "Sembunyikan" : "Tampilkan", onclick: () => toggle(r) }),
        el("button", { class: "btn btn-danger btn-sm", type: "button", text: "Hapus", onclick: () => remove(r) }))))));
  }

  function openForm(r) {
    editingId = r ? r.id : null; slugTouched = !!r;
    $("form-title").textContent = r ? "Ubah kategori" : "Tambah kategori";
    $("f-nama").value = r ? r.nama : ""; $("f-slug").value = r ? r.slug : ""; $("f-deskripsi").value = r ? (r.deskripsi || "") : "";
    $("f-urutan").value = r ? r.urutan : (rows.length ? Math.max(...rows.map(x => x.urutan)) + 1 : 0);
    $("f-aktif").checked = r ? r.aktif : true;
    AdminUI.showErrors({}, KEYS); AdminUI.formMessage($("form-msg"), "");
    $("form-panel").hidden = false; $("f-nama").focus();
    $("form-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function closeForm() { $("form-panel").hidden = true; editingId = null; }

  async function toggle(r) {
    const { data, error } = await db.from("kategori").update({ aktif: !r.aktif }).eq("id", r.id).select();
    if (error || !data || !data.length) return AdminUI.toast(error ? L.dbError(error) : "Perubahan ditolak. Pastikan Anda login sebagai admin.", "bad");
    AdminUI.toast(r.aktif ? "Kategori disembunyikan dari website." : "Kategori ditampilkan di website.", "ok");
    load();
  }

  async function remove(r) {
    const n = counts[r.id] || 0;
    const msg = "Hapus kategori \"" + r.nama + "\"?" + (n ? " " + n + " produk di kategori ini akan menjadi tanpa kategori (produknya tidak ikut terhapus)." : "") + " Tindakan ini tidak bisa dibatalkan.";
    if (!(await AdminUI.confirm(msg, { title: "Hapus kategori", confirmText: "Ya, hapus", danger: true }))) return;
    const { data, error } = await db.from("kategori").delete().eq("id", r.id).select();
    if (error || !data || !data.length) return AdminUI.toast(error ? L.dbError(error) : "Penghapusan ditolak. Pastikan Anda login sebagai admin.", "bad");
    AdminUI.toast("Kategori berhasil dihapus.", "ok");
    load();
  }

  $("btn-add").addEventListener("click", () => openForm(null));
  $("btn-cancel").addEventListener("click", closeForm);
  $("f-nama").addEventListener("input", () => { if (!slugTouched) $("f-slug").value = L.slugify($("f-nama").value); });
  $("f-slug").addEventListener("input", () => { slugTouched = true; });

  $("form").addEventListener("submit", async e => {
    e.preventDefault();
    const v = L.validateKategori({ nama: $("f-nama").value, slug: $("f-slug").value, deskripsi: $("f-deskripsi").value, urutan: $("f-urutan").value, aktif: $("f-aktif").checked });
    AdminUI.showErrors(v.errors, KEYS);
    if (!v.ok) return AdminUI.formMessage($("form-msg"), "Periksa isian yang bertanda merah.", "bad");
    const btn = $("btn-save"); AdminUI.setBusy(btn, true, "Menyimpan...");
    const res = editingId
      ? await db.from("kategori").update(v.data).eq("id", editingId).select()
      : await db.from("kategori").insert(v.data).select();
    AdminUI.setBusy(btn, false);
    if (res.error || !res.data || !res.data.length) return AdminUI.formMessage($("form-msg"), res.error ? L.dbError(res.error) : "Penyimpanan ditolak. Pastikan Anda login sebagai admin.", "bad");
    AdminUI.toast(editingId ? "Kategori berhasil diperbarui." : "Kategori berhasil ditambahkan.", "ok");
    closeForm(); load();
  });

  await load();
})();
