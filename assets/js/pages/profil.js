/* Profil toko: satu baris data (id = 1) beserta logo */
(async function () {
  const user = await AdminLayout.init({ active: "profil" });
  if (!user) return;
  const L = window.AdminLogic, db = window.db, $ = id => document.getElementById(id);
  const KEYS = ["nama_toko", "tagline", "deskripsi", "alamat", "jam_operasional", "whatsapp", "telepon", "email", "maps_url", "instagram_url", "facebook_url", "tiktok_url"];
  let oldLogo = null;
  const picker = AdminStorage.createPicker($("logo-picker"));

  const { data, error } = await db.from("profil_toko").select("*").eq("id", 1).maybeSingle();
  if (error) AdminUI.formMessage($("form-msg"), "Gagal memuat profil: " + L.dbError(error), "bad");
  const row = data || {};
  KEYS.forEach(k => { $("f-" + k).value = row[k] == null ? "" : row[k]; });
  oldLogo = row.logo_path || null;
  if (oldLogo) picker.setCurrent(AdminStorage.publicUrl("toko", oldLogo));

  $("form").addEventListener("submit", async e => {
    e.preventDefault();
    const input = {}; KEYS.forEach(k => { input[k] = $("f-" + k).value; });
    const v = L.validateProfil(input);
    AdminUI.showErrors(v.errors, KEYS);
    if (!v.ok) return AdminUI.formMessage($("form-msg"), "Periksa isian yang bertanda merah.", "bad");

    const btn = $("btn-save"); AdminUI.setBusy(btn, true, "Menyimpan...");
    const fail = t => { AdminUI.setBusy(btn, false); AdminUI.formMessage($("form-msg"), t, "bad"); };
    let newLogo = null;
    if (picker.hasChange()) {
      const up = await picker.uploadTo("toko");
      if (!up.ok) return fail(up.message);
      newLogo = up.path;
    }
    const payload = Object.assign({ id: 1 }, v.data);
    if (newLogo) payload.logo_path = newLogo;
    const res = await db.from("profil_toko").upsert(payload, { onConflict: "id" }).select();
    if (res.error || !res.data || !res.data.length) {
      if (newLogo) await AdminStorage.remove("toko", newLogo);
      return fail(res.error ? L.dbError(res.error) : "Penyimpanan ditolak. Pastikan Anda login sebagai admin.");
    }
    if (newLogo && oldLogo) {
      const f = await AdminStorage.remove("toko", oldLogo);
      if (!f.ok) AdminUI.toast("Profil tersimpan, tetapi file logo lama belum terhapus.", "info");
    }
    if (newLogo) { oldLogo = newLogo; picker.setCurrent(AdminStorage.publicUrl("toko", newLogo)); }
    $("f-whatsapp").value = v.data.whatsapp || "";                       // tampilkan format yang tersimpan
    AdminUI.setBusy(btn, false);
    AdminUI.formMessage($("form-msg"), "");
    AdminUI.toast("Profil toko berhasil disimpan.", "ok");
  });
})();
