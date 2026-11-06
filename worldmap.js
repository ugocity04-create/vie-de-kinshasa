// GRANDE CARTE (comme Lagos Life) : toute la ville vue d'en haut, une bulle par endroit.
(function () {
  const U = 20; let ov = null, M = null, raf = 0, bub = [], moved = false;
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " FC";
  function open() {
    if (ov) return; const S = G.S; if (!S || !S.started) return;
    M = { x: 60, z: 62, d: 95 }; R3D.setMap(M); document.body.classList.add("wmapmode");
    ov = document.createElement("div"); ov.id = "wmap";
    ov.innerHTML = '<div class="wm-top"><button class="wm-x" id="wm-close">✕</button><div class="wm-money" id="wm-money"></div></div><div id="wm-layer"></div><button class="wm-me-btn" id="wm-me-btn">🎯 Ma position</button>';
    document.body.appendChild(ov); $("wm-close").onclick = close;
    $("wm-me-btn").onclick = () => { M.x = G.S.x / U; M.z = G.S.y / U; };
    const layer = $("wm-layer"); bub = [];
    BUILDINGS.forEach((b) => {
      if (b.needs && !S[b.needs]) return; if (!b.name) return;
      const el = document.createElement("button"); el.className = "wm-p"; el.textContent = b.emoji || "📍"; layer.appendChild(el);
      el.addEventListener("click", () => { if (moved) return; if (G.jumpTo(b)) close(); });
      bub.push({ b, el, x: (b.x + b.w / 2) / U, z: (b.y + b.h / 2) / U });
    });
    const me = document.createElement("div"); me.className = "wm-me"; layer.appendChild(me); bub.me = me;
    bindDrag(); loop();
  }
  function close() { if (!ov) return; cancelAnimationFrame(raf); R3D.setMap(null); ov.remove(); ov = null; document.body.classList.remove("wmapmode"); }
  function bindDrag() {
    const ptr = new Map(); let p0 = 0, d0 = 0;
    ov.addEventListener("pointerdown", (e) => { if (e.target.closest(".wm-top,.wm-me-btn")) return; ptr.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = false; if (ptr.size === 2) { const [a, b] = [...ptr.values()]; p0 = Math.hypot(a.x - b.x, a.y - b.y) || 1; d0 = M.d; } });
    window.addEventListener("pointermove", (e) => {
      if (!ptr.has(e.pointerId) || !ov) return; const o = ptr.get(e.pointerId);
      if (ptr.size >= 2) { ptr.set(e.pointerId, { x: e.clientX, y: e.clientY }); const [a, b] = [...ptr.values()]; M.d = Math.max(14, Math.min(120, d0 * p0 / (Math.hypot(a.x - b.x, a.y - b.y) || 1))); moved = true; return; }
      const dx = e.clientX - o.x, dy = e.clientY - o.y; if (Math.hypot(dx, dy) > 3) moved = true;
      const s = 2 * M.d * Math.tan(0.425) / window.innerHeight; M.x = Math.max(0, Math.min(120, M.x - dx * s * 1.1)); M.z = Math.max(0, Math.min(115, M.z - dy * s / Math.sin(1.1) * 1.1)); ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    });
    ["pointerup", "pointercancel"].forEach((n) => window.addEventListener(n, (e) => { ptr.delete(e.pointerId); setTimeout(() => { moved = false; }, 60); }));
    ov.addEventListener("wheel", (e) => { M.d = Math.max(14, Math.min(120, M.d * (e.deltaY > 0 ? 1.1 : 0.9))); }, { passive: true });
  }
  function loop() {
    if (!ov) return; $("wm-money").textContent = "💰 " + fmt(G.S.money);
    const sc = Math.max(0.5, Math.min(1.1, 48 / M.d));
    bub.forEach((o) => { const p = R3D.proj(o.x, 2.6, o.z); if (!p) { o.el.style.display = "none"; return; } o.el.style.display = ""; o.el.style.transform = "translate(" + (p[0] - 19) + "px," + (p[1] - 38) + "px) scale(" + sc + ")"; });
    const q = R3D.proj(G.S.x / U, 1, G.S.y / U); if (q && bub.me) bub.me.style.transform = "translate(" + (q[0] - 10) + "px," + (q[1] - 10) + "px)";
    raf = requestAnimationFrame(loop);
  }
  document.addEventListener("click", (e) => { if (e.target.closest("#map-btn")) open(); });
  window.WorldMap = { open, close };
})();
