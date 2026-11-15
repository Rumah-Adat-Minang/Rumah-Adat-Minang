/* Kelola banner promosi: tambah, ubah (termasuk ganti gambar), tampil/sembunyikan, hapus */
(async function () {
  const user = await AdminLayout.init({ active: "banner" });
  if (!user) return;
  const { el } = AdminUI, L = window.AdminLogic, db = window.db, $ = id => document.getElementById(id);
  const KEYS = ["judul", "subjudul", "tautan", "urutan"];
  let rows = [], editing = null;
  const picker = AdminStorage.createPicker($("picker"));

  async function load() {
    const { data, error } = await db.from("banner").select("*").order("urutan").order("created_at");
    if (error) { AdminUI.toast(L.dbError(error), "bad"); $("empty").textContent = "Gagal memuat banner."; return; }
    rows = data || []; render();
  }

  function render() {
    const body = $("rows"); body.textContent = "";
    $("empty").textContent = rows.length ? "" : "Belum ada banner. Klik \"Tambah banner\" untuk membuat yang pertama.";
    rows.forEach(r => body.append(el("tr", {},
      el("td", {}, el("img", { class: "thumb", style: "width:96px;height:54px", src: AdminStorage.publicUrl("banner", r.gambar_path), alt: "Banner " + r.judul, loading: "lazy" })),
      el("td", {}, el("strong", { text: r.judul }), r.subjudul ? el("div", { class: "hint", text: r.subjudul }) : null),
      el("td", { text: r.tautan || "-" }),
      el("td", { text: String(r.urutan) }),
      el("td", {}, el("span", { class: "badge " + (r.aktif ? "on" : "off"), text: r.aktif ? "Tampil" : "Tersembunyi" })),
      el("td", {}, el("div", { class: "actions" },
        el("button", { class: "btn btn-ghost btn-sm", type: "button", text: "Ubah", onclick: () => openForm(r) }),
        el("button", { class: "btn btn-ghost btn-sm", type: "button", text: r.aktif ? "Sembunyikan" : "Tampilkan", onclick: () => toggle(r) }),
        el("button", { class: "btn btn-danger btn-sm", type: "button", text: "Hapus", onclick: () => remove(r) }))))));
  }

  function openForm(r) {
    editing = r || null;
    $("form-title").textContent = r ? "Ubah banner" : "Tambah banner";
    $("f-judul").value = r ? r.judul : ""; $("f-subjudul").value = r ? (r.subjudul || "") : "";
    $("f-tautan").value = r ? (r.tautan || "") : "";
    $("f-urutan").value = r ? r.urutan : (rows.length ? Math.max(...rows.map(x => x.urutan)) + 1 : 0);
    $("f-aktif").checked = r ? r.aktif : true;
    picker.setCurrent(r ? AdminStorage.publicUrl("banner", r.gambar_path) : "");
    $("e-gambar").textContent = "";
    AdminUI.showErrors({}, KEYS); AdminUI.formMessage($("form-msg"), "");
    $("form-panel").hidden = false; $("f-judul").focus();
    $("form-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function closeForm() { $("form-panel").hidden = true; editing = null; picker.clear(); }

  async function toggle(r) {
    const { data, error } = await db.from("banner").update({ aktif: !r.aktif }).eq("id", r.id).select();
    if (error || !data || !data.length) return AdminUI.toast(error ? L.dbError(error) : "Perubahan ditolak. Pastikan Anda login sebagai admin.", "bad");
    AdminUI.toast(r.aktif ? "Banner disembunyikan dari website." : "Banner ditampilkan di website.", "ok");
    load();
  }

  async function remove(r) {
    if (!(await AdminUI.confirm("Hapus banner \"" + r.judul + "\"? Gambarnya juga akan dihapus dan tindakan ini tidak bisa dibatalkan.", { title: "Hapus banner", confirmText: "Ya, hapus", danger: true }))) return;
    const { data, error } = await db.from("banner").delete().eq("id", r.id).select();
    if (error || !data || !data.length) return AdminUI.toast(error ? L.dbError(error) : "Penghapusan ditolak. Pastikan Anda login sebagai admin.", "bad");
    const f = await AdminStorage.remove("banner", r.gambar_path);
    AdminUI.toast(f.ok ? "Banner berhasil dihapus." : "Banner dihapus, tetapi file gambarnya belum terhapus dari Storage.", f.ok ? "ok" : "info");
    load();
  }

  $("btn-add").addEventListener("click", () => openForm(null));
  $("btn-cancel").addEventListener("click", closeForm);

  $("form").addEventListener("submit", async e => {
    e.preventDefault();
    const v = L.validateBanner({ judul: $("f-judul").value, subjudul: $("f-subjudul").value, tautan: $("f-tautan").value, urutan: $("f-urutan").value, aktif: $("f-aktif").checked });
    AdminUI.showErrors(v.errors, KEYS);
    const needImage = !editing && !picker.hasChange();
    $("e-gambar").textContent = needImage ? "Gambar banner wajib dipilih." : "";
    if (!v.ok || needImage) return AdminUI.formMessage($("form-msg"), "Periksa isian yang bertanda merah.", "bad");

    const btn = $("btn-save"); AdminUI.setBusy(btn, true, "Menyimpan...");
    const msg = t => { AdminUI.setBusy(btn, false); AdminUI.formMessage($("form-msg"), t, "bad"); };
    let newPath = null;
    if (picker.hasChange()) {
      const up = await picker.uploadTo("banner");
      if (!up.ok) return msg(up.message);
      newPath = up.path;
    }
    const payload = Object.assign({}, v.data);
    if (newPath) payload.gambar_path = newPath;
    const res = editing
      ? await db.from("banner").update(payload).eq("id", editing.id).select()
      : await db.from("banner").insert(payload).select();
    if (res.error || !res.data || !res.data.length) {
      if (newPath) await AdminStorage.remove("banner", newPath);          // batalkan unggahan agar tidak jadi file yatim
      return msg(res.error ? L.dbError(res.error) : "Penyimpanan ditolak. Pastikan Anda login sebagai admin.");
    }
    if (editing && newPath && editing.gambar_path) {                      // gambar lama dihapus SETELAH data baru tersimpan
      const f = await AdminStorage.remove("banner", editing.gambar_path);
      if (!f.ok) AdminUI.toast("Banner tersimpan, tetapi file gambar lama belum terhapus.", "info");
    }
    AdminUI.setBusy(btn, false);
    AdminUI.toast(editing ? "Banner berhasil diperbarui." : "Banner berhasil ditambahkan.", "ok");
    closeForm(); load();
  });

  await load();
})();
