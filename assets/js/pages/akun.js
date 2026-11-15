/* Pengaturan akun: ganti password (email hanya ditampilkan) */
(async function () {
  const user = await AdminLayout.init({ active: "akun" });
  if (!user) return;
  const db = window.db, $ = id => document.getElementById(id);
  $("email").textContent = user.email;

  document.querySelectorAll(".pw-toggle").forEach(b => b.addEventListener("click", () => {
    const f = $(b.dataset.target), show = f.type === "password";
    f.type = show ? "text" : "password"; b.textContent = show ? "Sembunyi" : "Lihat";
  }));

  $("form").addEventListener("submit", async e => {
    e.preventDefault();
    const msg = (t, type) => AdminUI.formMessage($("form-msg"), t, type || "bad");
    const lama = $("f-lama").value, baru = $("f-baru").value, konf = $("f-konf").value;
    if (!lama) return msg("Isi password saat ini.");
    const problem = AdminAuth.passwordProblem(baru, konf);
    if (problem) return msg(problem);
    if (baru === lama) return msg("Password baru harus berbeda dari password saat ini.");

    const btn = $("btn-save"); AdminUI.setBusy(btn, true, "Menyimpan...");
    const check = await db.auth.signInWithPassword({ email: user.email, password: lama });   // memastikan yang mengganti adalah pemilik akun
    if (check.error) { AdminUI.setBusy(btn, false); return msg("Password saat ini salah."); }
    const { error } = await db.auth.updateUser({ password: baru });
    if (error) {
      AdminUI.setBusy(btn, false);
      return msg(/same|different/i.test(error.message || "") ? "Password baru harus berbeda dari yang lama." : "Gagal mengganti password. Silakan coba lagi.");
    }
    try { await db.auth.signOut({ scope: "others" }); } catch (x) { /* abaikan */ }       // keluarkan perangkat lain
    AdminUI.setBusy(btn, false);
    ["f-lama", "f-baru", "f-konf"].forEach(id => { $(id).value = ""; });
    msg("");
    AdminUI.toast("Password berhasil diganti. Perangkat lain dikeluarkan.", "ok");
  });
})();
