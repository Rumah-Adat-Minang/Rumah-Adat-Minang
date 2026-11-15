/* script.js - fungsi dasar semua halaman pengunjung: tahun otomatis dan menu HP.
   (Pencarian produk dan formulir kontak dipindahkan ke site.js karena kini memakai data dari database.) */
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-year]").forEach(el => el.textContent = new Date().getFullYear());

  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".nav-links");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const opened = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(opened));
      toggle.textContent = opened ? "✕" : "☰";
    });
  }
});
