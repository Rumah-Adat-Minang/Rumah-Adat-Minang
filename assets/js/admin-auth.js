/* admin-auth.js - semua logika login/logout/penjaga halaman admin.
   Dimuat SETELAH supabase-client.js. Hasil: window.AdminAuth
   CATATAN KEAMANAN: penjaga halaman di sini hanya mengatur tampilan.
   Perlindungan data yang sebenarnya dilakukan RLS di database (Tahap 3). */
(function () {
  const LOGIN_PAGE = "login.html";
  const HOME_PAGE = "index.html";
  const MIN_PASSWORD = 8;

  const ready = () => window.dbReady === true && !!window.db;

  function friendly(error) {
    const m = ((error && error.message) || "").toLowerCase();
    const s = error && error.status;
    if (s === 429 || m.includes("rate limit") || m.includes("too many")) return "Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.";
    if (m.includes("invalid login") || m.includes("invalid credentials")) return "Email atau password salah.";
    if (m.includes("email not confirmed")) return "Email akun ini belum dikonfirmasi. Hubungi pengelola website.";
    if (m.includes("failed to fetch") || m.includes("network")) return "Tidak bisa terhubung ke server. Periksa koneksi internet.";
    return "Terjadi kesalahan. Silakan coba lagi.";
  }

  async function isAdmin(userId) {
    const { data, error } = await window.db.from("admin_users").select("user_id").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    return !!data;
  }

  function goLogin(reason) {
    window.location.replace(LOGIN_PAGE + (reason ? "?alasan=" + encodeURIComponent(reason) : ""));
  }

  async function login(email, password) {
    if (!ready()) return { ok: false, message: "Koneksi database belum siap. Periksa assets/js/config.js." };
    email = (email || "").trim();
    if (!email || !password) return { ok: false, message: "Isi email dan password." };
    const { data, error } = await window.db.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, message: friendly(error) };
    try {
      if (!(await isAdmin(data.user.id))) {
        await window.db.auth.signOut();
        return { ok: false, message: "Akun ini tidak terdaftar sebagai admin." };
      }
    } catch (e) {
      await window.db.auth.signOut();
      return { ok: false, message: "Gagal memeriksa hak akses admin. Pastikan SQL Tahap 3 sudah dijalankan." };
    }
    return { ok: true, user: data.user };
  }

  async function logout() {
    if (ready()) { try { await window.db.auth.signOut(); } catch (e) { /* tetap keluar */ } }
    goLogin("keluar");
  }

  // Dipakai di halaman login: jika sudah login sebagai admin, langsung ke dashboard
  async function redirectIfLoggedIn() {
    if (!ready()) return false;
    const { data } = await window.db.auth.getSession();
    if (!data.session) return false;
    try {
      if (await isAdmin(data.session.user.id)) { window.location.replace(HOME_PAGE); return true; }
    } catch (e) { /* abaikan */ }
    return false;
  }

  // Dipakai di semua halaman admin yang terlindungi
  async function requireAdmin() {
    if (!ready()) return goLogin("koneksi");
    const { data } = await window.db.auth.getSession();
    if (!data.session) return goLogin("masuk");
    const u = await window.db.auth.getUser();             // validasi ke server
    if (u.error || !u.data || !u.data.user) { await window.db.auth.signOut(); return goLogin("masuk"); }
    let admin = false;
    try { admin = await isAdmin(u.data.user.id); } catch (e) { admin = false; }
    if (!admin) { await window.db.auth.signOut(); return goLogin("bukan-admin"); }

    document.documentElement.classList.add("auth-ok");     // tampilkan halaman
    window.db.auth.onAuthStateChange((evt) => { if (evt === "SIGNED_OUT") goLogin("keluar"); });
    window.addEventListener("pageshow", (e) => { if (e.persisted) window.location.reload(); }); // tombol Back
    return u.data.user;
  }

  async function sendReset(email) {
    if (!ready()) return { ok: false, message: "Koneksi database belum siap." };
    email = (email || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: "Masukkan alamat email yang valid." };
    const redirectTo = new URL("atur-password.html", window.location.href).href;
    const { error } = await window.db.auth.resetPasswordForEmail(email, { redirectTo });
    if (error && (error.status === 429 || /rate limit|too many/i.test(error.message || "")))
      return { ok: false, message: friendly(error) };
    // Pesan sama untuk email terdaftar maupun tidak (mencegah orang menebak akun)
    return { ok: true, message: "Jika email terdaftar, tautan pemulihan sudah dikirim. Periksa kotak masuk dan folder spam." };
  }

  function passwordProblem(pw, pw2) {
    if (!pw || pw.length < MIN_PASSWORD) return "Password minimal " + MIN_PASSWORD + " karakter.";
    if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "Password harus mengandung huruf dan angka.";
    if (pw !== pw2) return "Konfirmasi password tidak sama.";
    return null;
  }

  async function updatePassword(pw, pw2) {
    const problem = passwordProblem(pw, pw2);
    if (problem) return { ok: false, message: problem };
    const { error } = await window.db.auth.updateUser({ password: pw });
    if (error) return { ok: false, message: /same|different/i.test(error.message || "") ? "Password baru harus berbeda dari yang lama." : friendly(error) };
    await window.db.auth.signOut();
    return { ok: true };
  }

  window.AdminAuth = { login, logout, requireAdmin, redirectIfLoggedIn, sendReset, updatePassword, passwordProblem, goLogin };
})();
