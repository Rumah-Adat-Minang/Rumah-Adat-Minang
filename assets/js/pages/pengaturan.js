/* Pengaturan website: satu baris data (id = 1) */
(async function () {
  const user = await AdminLayout.init({ active: "pengaturan" });
  if (!user) return;
  const L = window.AdminLogic, db = window.db, $ = id => document.getElementById(id);
  const KEYS = ["judul_situs", "deskripsi_situs", "teks_topbar_kiri", "teks_topbar_kanan", "teks_footer_1", "teks_footer_2"];

  const { data, error } = await db.from("pengaturan_website").select("*").eq("id", 1).maybeSingle();
  if (error) AdminUI.formMessage($("form-msg"), "Gagal memuat pengaturan: " + L.dbError(error), "bad");
  const row = data || { tampilkan_banner: true };
  KEYS.forEach(k => { $("f-" + k).value = row[k] == null ? "" : row[k]; });
  $("f-tampilkan_banner").checked = row.tampilkan_banner !== false;

  $("form").addEventListener("submit", async e => {
    e.preventDefault();
    const input = { tampilkan_banner: $("f-tampilkan_banner").checked };
    KEYS.forEach(k => { input[k] = $("f-" + k).value; });
    const v = L.validatePengaturan(input);
    AdminUI.showErrors(v.errors, KEYS);
    if (!v.ok) return AdminUI.formMessage($("form-msg"), "Periksa isian yang bertanda merah.", "bad");
    const btn = $("btn-save"); AdminUI.setBusy(btn, true, "Menyimpan...");
    const res = await db.from("pengaturan_website").upsert(Object.assign({ id: 1 }, v.data), { onConflict: "id" }).select();
    AdminUI.setBusy(btn, false);
    if (res.error || !res.data || !res.data.length) return AdminUI.formMessage($("form-msg"), res.error ? L.dbError(res.error) : "Penyimpanan ditolak. Pastikan Anda login sebagai admin.", "bad");
    AdminUI.formMessage($("form-msg"), "");
    AdminUI.toast("Pengaturan website berhasil disimpan.", "ok");
  });
})();
