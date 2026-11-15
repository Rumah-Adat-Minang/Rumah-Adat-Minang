/* admin-layout.js - kerangka dashboard (menu samping, bilah atas HP, tombol keluar).
   Pemakaian di tiap halaman: const user = await AdminLayout.init({ active: "kategori" }); */
(function () {
  const MENU = [
    { key: "dashboard", href: "index.html", label: "Dashboard", icon: "⌂" },
    { key: "produk", href: "produk.html", label: "Kelola Produk", icon: "▣" },
    { key: "kategori", href: "kategori.html", label: "Kelola Kategori", icon: "☰" },
    { key: "banner", href: "banner.html", label: "Banner Promosi", icon: "▭" },
    { key: "beranda", href: "beranda.html", label: "Gambar Beranda", icon: "❖" },
    { key: "profil", href: "profil.html", label: "Profil Toko", icon: "⌖" },
    { key: "pengaturan", href: "pengaturan.html", label: "Pengaturan Website", icon: "⚙" },
    { key: "akun", href: "akun.html", label: "Pengaturan Akun", icon: "☺" },
    { key: "visitor", href: "../index.html", label: "Kembali ke Beranda", icon: "↩" }
  ];

  async function init(opts) {
    const user = await AdminAuth.requireAdmin();
    if (!user) return null;
    const el = AdminUI.el;
    const content = document.getElementById("content");

    const nav = el("nav", { class: "side-nav", "aria-label": "Menu admin" },
      MENU.map(m => el("a", { href: m.href, class: "side-link" + (m.key === opts.active ? " active" : ""), "aria-current": m.key === opts.active ? "page" : null },
        el("span", { class: "side-ico", "aria-hidden": "true", text: m.icon }), el("span", { text: m.label }))));

    const logout = el("button", { class: "side-link side-logout", type: "button", id: "logout-btn", onclick: () => AdminAuth.logout() },
      el("span", { class: "side-ico", "aria-hidden": "true", text: "⎋" }), el("span", { text: "Keluar" }));

    const sidebar = el("aside", { class: "sidebar", id: "sidebar" },
      el("div", { class: "side-brand" }, el("img", { src: "../assets/img/Logo.jpeg", alt: "Logo" }), el("div", {}, el("strong", { text: "Rumah Adat Minang" }), el("small", { text: "Admin Panel" }))),
      nav,
      el("div", { class: "side-foot" }, el("p", { class: "side-user", title: user.email, text: user.email }), logout));

    const shell = el("div", { class: "shell" });
    const overlay = el("div", { class: "side-overlay", onclick: () => shell.classList.remove("open") });
    const menuBtn = el("button", { class: "menu-btn", type: "button", "aria-label": "Buka menu", "aria-controls": "sidebar", "aria-expanded": "false",
      onclick: () => { const o = shell.classList.toggle("open"); menuBtn.setAttribute("aria-expanded", String(o)); } }, "☰");
    const mobilebar = el("header", { class: "mobilebar" }, menuBtn, el("strong", { text: "Admin Rumah Adat Minang" }));
    const main = el("div", { class: "main" }, mobilebar, content);
    shell.append(sidebar, overlay, main);
    document.body.prepend(shell);
    return user;
  }

  window.AdminLayout = { init, MENU };
})();
