/* admin-ui.js - komponen tampilan bersama: notifikasi, pesan form, tombol sibuk,
   dialog konfirmasi, dan pembuat elemen yang aman dari injeksi HTML. */
(function () {
  function container() {
    let c = document.getElementById("toasts");
    if (!c) { c = document.createElement("div"); c.id = "toasts"; c.setAttribute("aria-live", "polite"); document.body.appendChild(c); }
    return c;
  }

  // el("div", {class:"x", onclick: fn, text:"..."}, anak1, anak2) - semua teks lewat textContent
  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : v);
    }
    kids.flat().forEach(c => { if (c == null || c === false) return; e.append(c.nodeType ? c : document.createTextNode(String(c))); });
    return e;
  }

  window.AdminUI = {
    el,
    // type: "ok" (berhasil) | "bad" (gagal) | "info"
    toast(message, type, ms) {
      const t = document.createElement("div");
      t.className = "toast " + (type || "info");
      t.textContent = message;
      container().appendChild(t);
      setTimeout(() => t.remove(), ms || 4500);
    },
    formMessage(elm, message, type) {
      if (!elm) return;
      elm.className = "msg " + (type || "info") + (message ? " show" : "");
      elm.textContent = message || "";
    },
    setBusy(btn, busy, busyText) {
      if (!btn) return;
      if (busy) { btn.dataset.label = btn.textContent; btn.textContent = busyText || "Memproses..."; btn.disabled = true; }
      else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
    },
    // Menampilkan pesan error per kolom: elemen #f-<kunci> (input) dan #e-<kunci> (teks error)
    showErrors(errors, keys) {
      keys.forEach(k => {
        const e = document.getElementById("e-" + k), f = document.getElementById("f-" + k);
        if (e) e.textContent = errors[k] || "";
        if (f) f.classList.toggle("invalid", !!errors[k]);
      });
    },
    // Jendela informasi (bukan konfirmasi). Mengembalikan {close}.
    showModal(node, opts) {
      opts = opts || {};
      const prev = document.activeElement;
      const closeBtn = el("button", { class: "btn btn-ghost btn-sm", type: "button", text: "Tutup" });
      const box = el("div", { class: "modal wide", role: "dialog", "aria-modal": "true", "aria-label": opts.title || "Jendela" },
        el("h2", { text: opts.title || "" }), node, el("div", { class: "modal-actions", style: "margin-top:14px" }, closeBtn));
      const overlay = el("div", { class: "modal-overlay" }, box);
      function close() { document.removeEventListener("keydown", onKey); overlay.remove(); if (prev && prev.focus) prev.focus(); }
      function onKey(e) { if (e.key === "Escape") close(); }
      closeBtn.addEventListener("click", close);
      overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
      document.addEventListener("keydown", onKey);
      document.body.appendChild(overlay); closeBtn.focus();
      return { close };
    },
    // Dialog konfirmasi. Mengembalikan Promise<boolean>.
    confirm(message, opts) {
      opts = opts || {};
      return new Promise(resolve => {
        const prev = document.activeElement;
        const ok = el("button", { class: "btn " + (opts.danger ? "btn-danger" : "btn-primary") + " btn-inline", type: "button", text: opts.confirmText || "Ya, lanjutkan" });
        const no = el("button", { class: "btn btn-ghost", type: "button", text: opts.cancelText || "Batal" });
        const box = el("div", { class: "modal", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "m-title", "aria-describedby": "m-msg" },
          el("h2", { id: "m-title", text: opts.title || "Konfirmasi" }),
          el("p", { id: "m-msg", text: message }),
          el("div", { class: "modal-actions" }, no, ok));
        const overlay = el("div", { class: "modal-overlay" }, box);
        function close(v) { document.removeEventListener("keydown", onKey); overlay.remove(); if (prev && prev.focus) prev.focus(); resolve(v); }
        function onKey(e) { if (e.key === "Escape") close(false); }
        ok.addEventListener("click", () => close(true));
        no.addEventListener("click", () => close(false));
        overlay.addEventListener("click", e => { if (e.target === overlay) close(false); });
        document.addEventListener("keydown", onKey);
        document.body.appendChild(overlay);
        no.focus();
      });
    }
  };
})();
