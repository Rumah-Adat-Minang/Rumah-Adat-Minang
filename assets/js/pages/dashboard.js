/* Dashboard utama: ringkasan jumlah data dan hal yang perlu diperhatikan */
(async function () {
  const user = await AdminLayout.init({ active: "dashboard" });
  if (!user) return;
  const { el } = AdminUI, db = window.db, $ = id => document.getElementById(id);

  const count = async (table, filter) => {
    let q = db.from(table).select("id", { count: "exact", head: true });
    if (filter) q = filter(q);
    const { count: c, error } = await q;
    if (error) throw error;
    return c || 0;
  };

  try {
    const [pT, pA, pNoImg, pNoCat, kT, kA, bT, bA, prof, set] = await Promise.all([
      count("produk"), count("produk", q => q.eq("aktif", true)),
      count("produk", q => q.is("gambar_path", null)), count("produk", q => q.is("kategori_id", null)),
      count("kategori"), count("kategori", q => q.eq("aktif", true)),
      count("banner"), count("banner", q => q.eq("aktif", true)),
      db.from("profil_toko").select("*").maybeSingle(), db.from("pengaturan_website").select("*").maybeSingle()
    ]);
    if (prof.error) throw prof.error;
    if (set.error) throw set.error;

    const stat = (n, t, s, href) => el("a", { class: "stat", href, style: "text-decoration:none;color:inherit" },
      el("div", { class: "n", text: String(n) }), el("div", { class: "t", text: t }), el("div", { class: "s", text: s }));
    $("stats").append(
      stat(pT, "Produk", pA + " aktif, " + (pT - pA) + " tersembunyi", "produk.html"),
      stat(kT, "Kategori", kA + " aktif, " + (kT - kA) + " tersembunyi", "kategori.html"),
      stat(bT, "Banner promosi", bA + " aktif, " + (bT - bA) + " tersembunyi", "banner.html"));

    const items = [];
    const p = prof.data || {};
    const kosong = ["alamat", "jam_operasional", "whatsapp", "maps_url"].filter(k => !p[k]);
    if (!prof.data) items.push({ ok: false, text: "Profil toko belum dibuat.", href: "profil.html", link: "Isi profil toko" });
    else if (kosong.length) items.push({ ok: false, text: "Profil toko belum lengkap (" + (4 - kosong.length) + " dari 4 data utama terisi).", href: "profil.html", link: "Lengkapi profil" });
    else items.push({ ok: true, text: "Profil toko sudah lengkap (alamat, jam operasional, WhatsApp, peta)." });

    if (pA === 0) items.push({ ok: false, text: "Belum ada produk aktif, jadi katalog pengunjung masih kosong.", href: "produk.html", link: "Kelola produk" });
    else items.push({ ok: true, text: pA + " produk aktif tampil di katalog." });
    if (pNoImg > 0) items.push({ ok: false, text: pNoImg + " produk belum punya gambar.", href: "produk.html", link: "Kelola produk" });
    if (pNoCat > 0) items.push({ ok: false, text: pNoCat + " produk belum punya kategori.", href: "produk.html", link: "Kelola produk" });
    const s = set.data || {};
    if (s.tampilkan_banner && bA === 0) items.push({ ok: false, text: "Banner diaktifkan di pengaturan, tetapi belum ada banner aktif.", href: "banner.html", link: "Kelola banner" });
    if (s.tampilkan_banner === false) items.push({ ok: false, text: "Banner sedang dimatikan di pengaturan website.", href: "pengaturan.html", link: "Buka pengaturan" });

    items.forEach(i => $("todo").append(el("li", {},
      el("span", { class: "dot " + (i.ok ? "good" : "warn"), "aria-hidden": "true", text: i.ok ? "✓" : "!" }),
      el("span", {}, i.text, i.href ? " " : null, i.href ? el("a", { href: i.href, text: i.link }) : null))));
  } catch (e) {
    $("todo").append(el("li", {}, el("span", { class: "dot warn", text: "!" }), el("span", { text: "Gagal memuat ringkasan: " + AdminLogic.dbError(e) })));
  }
})();
