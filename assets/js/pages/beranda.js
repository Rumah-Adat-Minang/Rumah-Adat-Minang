/* Gambar Beranda: gambar utama, gambar cerita, dan kartu "Pilihan camilan" */
(async function () {
  const user = await AdminLayout.init({ active: "beranda" });
  if (!user) return;
  const { el } = AdminUI, L = window.AdminLogic, db = window.db, $ = id => document.getElementById(id);
  const imgUrl = p => AdminStorage.publicUrl("beranda", p);
  const DEFAULT_IMG = "../assets/img/Logo.jpeg";
  const MAX_KARTU = 8, KEYS = ["label", "judul", "deskripsi", "tautan", "urutan"];
  let rows = [], editing = null;

  function tableMissing(error) {
    return error && /beranda_gambar|schema cache|does not exist/i.test(error.message || "") && !/permission|row-level/i.test(error.message || "");
  }
  async function load() {
    const { data, error } = await db.from("beranda_gambar").select("*").order("urutan").order("created_at");
    if (error) {
      AdminUI.toast(tableMissing(error) ? "Tabel gambar beranda belum ada. Jalankan supabase/06_beranda.sql di Supabase." : L.dbError(error), "bad", 7000);
      $("empty").textContent = tableMissing(error) ? "Jalankan supabase/06_beranda.sql terlebih dahulu." : "Gagal memuat data.";
      return false;
    }
    rows = data || []; return true;
  }

  // ---------- Gambar tunggal (hero dan cerita) ----------
  function slotController(key) {
    const picker = AdminStorage.createPicker($(key + "-picker"), { currentUrl: DEFAULT_IMG });
    const status = $(key + "-status"), msg = $(key + "-msg"), saveBtn = $(key + "-save"), resetBtn = $(key + "-reset");
    let row = null;
    function sync() {
      row = rows.find(r => r.slot === key) || null;
      $("f-" + key + "_alt").value = row ? (row.alt_text || "") : "";
      picker.setCurrent(row ? imgUrl(row.gambar_path) : DEFAULT_IMG);
      status.textContent = row ? "Saat ini memakai gambar yang Anda unggah." : "Saat ini memakai gambar bawaan.";
      resetBtn.hidden = !row;
    }
    saveBtn.addEventListener("click", async () => {
      const v = L.validateBerandaSlot({ alt_text: $("f-" + key + "_alt").value });
      AdminUI.showErrors({ [key + "_alt"]: v.errors.alt_text }, [key + "_alt"]);
      if (!v.ok) return AdminUI.formMessage(msg, "Periksa isian yang bertanda merah.", "bad");
      if (!row && !picker.hasChange()) return AdminUI.formMessage(msg, "Pilih gambar terlebih dahulu.", "bad");
      if (row && !picker.hasChange() && (row.alt_text || null) === v.data.alt_text) return AdminUI.formMessage(msg, "Belum ada perubahan untuk disimpan.", "info");
      AdminUI.setBusy(saveBtn, true, "Menyimpan...");
      const fail = t => { AdminUI.setBusy(saveBtn, false); AdminUI.formMessage(msg, t, "bad"); };
      let newPath = null;
      if (picker.hasChange()) { const up = await picker.uploadTo("beranda"); if (!up.ok) return fail(up.message); newPath = up.path; }
      const payload = Object.assign({}, v.data); if (newPath) payload.gambar_path = newPath;
      const res = row
        ? await db.from("beranda_gambar").update(payload).eq("id", row.id).select()
        : await db.from("beranda_gambar").insert(Object.assign({ slot: key, aktif: true, urutan: 0 }, payload)).select();
      if (res.error || !res.data || !res.data.length) {
        if (newPath) await AdminStorage.remove("beranda", newPath);
        return fail(res.error ? (res.error.code === "23505" ? "Gambar untuk bagian ini sudah ada. Muat ulang halaman lalu coba lagi." : tableMissing(res.error) ? "Tabel belum ada. Jalankan supabase/06_beranda.sql." : L.dbError(res.error)) : "Penyimpanan ditolak. Pastikan Anda login sebagai admin.");
      }
      if (row && newPath && row.gambar_path) {
        const f = await AdminStorage.remove("beranda", row.gambar_path);
        if (!f.ok) AdminUI.toast("Tersimpan, tetapi file gambar lama belum terhapus.", "info");
      }
      AdminUI.setBusy(saveBtn, false); AdminUI.formMessage(msg, "");
      AdminUI.toast("Gambar berhasil disimpan.", "ok");
      await load(); sync();
    });
    resetBtn.addEventListener("click", async () => {
      if (!row) return;
      if (!(await AdminUI.confirm("Kembalikan ke gambar bawaan? Gambar yang Anda unggah akan dihapus.", { title: "Kembalikan gambar bawaan", confirmText: "Ya, kembalikan", danger: true }))) return;
      const { data, error } = await db.from("beranda_gambar").delete().eq("id", row.id).select();
      if (error || !data || !data.length) return AdminUI.toast(error ? L.dbError(error) : "Penghapusan ditolak. Pastikan Anda login sebagai admin.", "bad");
      const f = await AdminStorage.remove("beranda", row.gambar_path);
      AdminUI.toast(f.ok ? "Dikembalikan ke gambar bawaan." : "Dikembalikan, tetapi file lama belum terhapus dari Storage.", f.ok ? "ok" : "info");
      await load(); sync();
    });
    return { sync };
  }

  // ---------- Kartu pilihan ----------
  const picker = AdminStorage.createPicker($("picker"));
  const kartu = () => rows.filter(r => r.slot === "pilihan");

  function render() {
    const body = $("rows"); body.textContent = "";
    const list = kartu();
    $("empty").textContent = list.length ? "" : "Belum ada kartu. Beranda memakai 4 kartu bawaan.";
    list.forEach(r => body.append(el("tr", {},
      el("td", {}, el("img", { class: "thumb", src: imgUrl(r.gambar_path), alt: "Gambar " + (r.judul || "kartu"), loading: "lazy" })),
      el("td", {}, el("strong", { text: r.judul || "(tanpa judul)" }), r.label ? el("div", { class: "hint", text: r.label }) : null, r.deskripsi ? el("div", { class: "hint", text: r.deskripsi }) : null),
      el("td", { text: r.tautan || "produk.html" }),
      el("td", { text: String(r.urutan) }),
      el("td", {}, el("span", { class: "badge " + (r.aktif ? "on" : "off"), text: r.aktif ? "Tampil" : "Tersembunyi" })),
      el("td", {}, el("div", { class: "actions" },
        el("button", { class: "btn btn-ghost btn-sm", type: "button", text: "Ubah", onclick: () => openForm(r) }),
        el("button", { class: "btn btn-ghost btn-sm", type: "button", text: r.aktif ? "Sembunyikan" : "Tampilkan", onclick: () => toggle(r) }),
        el("button", { class: "btn btn-danger btn-sm", type: "button", text: "Hapus", onclick: () => remove(r) }))))));
  }

  function openForm(r) {
    if (!r && kartu().length >= MAX_KARTU) return AdminUI.toast("Maksimal " + MAX_KARTU + " kartu. Hapus salah satu kartu terlebih dahulu.", "info");
    editing = r || null;
    $("form-title").textContent = r ? "Ubah kartu" : "Tambah kartu";
    $("f-label").value = r ? (r.label || "") : ""; $("f-judul").value = r ? (r.judul || "") : "";
    $("f-deskripsi").value = r ? (r.deskripsi || "") : ""; $("f-tautan").value = r ? (r.tautan || "") : "";
    const k = kartu(); $("f-urutan").value = r ? r.urutan : (k.length ? Math.max(...k.map(x => x.urutan)) + 1 : 0);
    $("f-aktif").checked = r ? r.aktif : true;
    picker.setCurrent(r ? imgUrl(r.gambar_path) : "");
    $("e-gambar").textContent = ""; AdminUI.showErrors({}, KEYS); AdminUI.formMessage($("form-msg"), "");
    $("form-panel").hidden = false; $("f-judul").focus();
    $("form-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function closeForm() { $("form-panel").hidden = true; editing = null; picker.clear(); }

  async function toggle(r) {
    const { data, error } = await db.from("beranda_gambar").update({ aktif: !r.aktif }).eq("id", r.id).select();
    if (error || !data || !data.length) return AdminUI.toast(error ? L.dbError(error) : "Perubahan ditolak. Pastikan Anda login sebagai admin.", "bad");
    AdminUI.toast(r.aktif ? "Kartu disembunyikan dari beranda." : "Kartu ditampilkan di beranda.", "ok");
    await load(); render();
  }
  async function remove(r) {
    if (!(await AdminUI.confirm("Hapus kartu \"" + (r.judul || "tanpa judul") + "\"? Gambarnya juga akan dihapus dan tindakan ini tidak bisa dibatalkan.", { title: "Hapus kartu", confirmText: "Ya, hapus", danger: true }))) return;
    const { data, error } = await db.from("beranda_gambar").delete().eq("id", r.id).select();
    if (error || !data || !data.length) return AdminUI.toast(error ? L.dbError(error) : "Penghapusan ditolak. Pastikan Anda login sebagai admin.", "bad");
    const f = await AdminStorage.remove("beranda", r.gambar_path);
    AdminUI.toast(f.ok ? "Kartu berhasil dihapus." : "Kartu dihapus, tetapi file gambarnya belum terhapus dari Storage.", f.ok ? "ok" : "info");
    await load(); render();
  }

  $("btn-add").addEventListener("click", () => openForm(null));
  $("btn-cancel").addEventListener("click", closeForm);
  $("form").addEventListener("submit", async e => {
    e.preventDefault();
    const v = L.validateBerandaPilihan({ label: $("f-label").value, judul: $("f-judul").value, deskripsi: $("f-deskripsi").value, tautan: $("f-tautan").value, urutan: $("f-urutan").value, aktif: $("f-aktif").checked });
    AdminUI.showErrors(v.errors, KEYS);
    const needImage = !editing && !picker.hasChange();
    $("e-gambar").textContent = needImage ? "Gambar kartu wajib dipilih." : "";
    if (!v.ok || needImage) return AdminUI.formMessage($("form-msg"), "Periksa isian yang bertanda merah.", "bad");
    const btn = $("btn-save"); AdminUI.setBusy(btn, true, "Menyimpan...");
    const fail = t => { AdminUI.setBusy(btn, false); AdminUI.formMessage($("form-msg"), t, "bad"); };
    let newPath = null;
    if (picker.hasChange()) { const up = await picker.uploadTo("beranda"); if (!up.ok) return fail(up.message); newPath = up.path; }
    const payload = Object.assign({}, v.data); if (newPath) payload.gambar_path = newPath;
    const res = editing
      ? await db.from("beranda_gambar").update(payload).eq("id", editing.id).select()
      : await db.from("beranda_gambar").insert(Object.assign({ slot: "pilihan" }, payload)).select();
    if (res.error || !res.data || !res.data.length) {
      if (newPath) await AdminStorage.remove("beranda", newPath);
      return fail(res.error ? (tableMissing(res.error) ? "Tabel belum ada. Jalankan supabase/06_beranda.sql." : L.dbError(res.error)) : "Penyimpanan ditolak. Pastikan Anda login sebagai admin.");
    }
    if (editing && newPath && editing.gambar_path) {
      const f = await AdminStorage.remove("beranda", editing.gambar_path);
      if (!f.ok) AdminUI.toast("Kartu tersimpan, tetapi file gambar lama belum terhapus.", "info");
    }
    AdminUI.setBusy(btn, false);
    AdminUI.toast(editing ? "Kartu berhasil diperbarui." : "Kartu berhasil ditambahkan.", "ok");
    closeForm(); await load(); render();
  });

  const hero = slotController("hero"), cerita = slotController("cerita");
  if (await load()) { hero.sync(); cerita.sync(); render(); }
  else { hero.sync(); cerita.sync(); }
})();
