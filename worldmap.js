// GRANDE CARTE (comme Lagos Life) : le quartier vu d'en haut, avec une bulle pour chaque endroit.
(function () {
  let ov = null, zid = null;
  const $ = (id) => document.getElementById(id), esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " FC";
  const SHOW = (b) => b.name && (!b.needs || G.S[b.needs]);
  function open() {
    if (ov) return; const S = G.S; if (!S || !S.started) return; zid = G.curZone().id; ov = document.createElement("div"); ov.id = "wmap"; document.body.appendChild(ov); document.body.classList.add("wmapmode"); paint(null);
  }
  function close() { if (ov) { ov.remove(); ov = null; document.body.classList.remove("wmapmode"); } }
  function paint(sel) {
    const S = G.S, z = ZONES.find((q) => q.id === zid), cur = G.curZone().id, soon = (id) => id === "aeroport" || id === "brazza";
    const W = Math.min(window.innerWidth - 24, 520), k = W / z.w, H = Math.round(z.h * k);
    const chips = ZONES.map((q) => '<button data-z="' + q.id + '" class="' + (q.id === zid ? "on" : "") + '">' + esc(q.name.replace(" (bientôt)", "")) + (q.id === cur ? " 📍" : "") + (soon(q.id) ? " 🔒" : "") + "</button>").join("");
    const list = BUILDINGS.filter((b) => SHOW(b) && b.x + b.w / 2 >= z.x && b.x + b.w / 2 <= z.x + z.w && b.y + b.h / 2 >= z.y && b.y + b.h / 2 <= z.y + z.h);
    let roads = ""; ROADS.h.forEach((r) => { if (r.y + r.h > z.y && r.y < z.y + z.h) roads += '<div class="wm-r" style="left:0;right:0;top:' + (r.y - z.y) * k + "px;height:" + r.h * k + 'px"></div>'; }); ROADS.v.forEach((r) => { if (r.x + r.w > z.x && r.x < z.x + z.w) roads += '<div class="wm-r" style="top:0;bottom:0;left:' + (r.x - z.x) * k + "px;width:" + r.w * k + 'px"></div>'; });
    const pins = list.map((b) => '<div class="wm-b" style="left:' + (b.x - z.x) * k + "px;top:" + (b.y - z.y) * k + "px;width:" + b.w * k + "px;height:" + b.h * k + "px;background:" + (b.wall || "#ccc") + ";border-top-color:" + (b.roof || "#888") + '"></div><button class="wm-p ' + (sel && sel.id === b.id ? "on" : "") + '" data-b="' + b.id + '" style="left:' + ((b.x + b.w / 2) - z.x) * k + "px;top:" + ((b.y + b.h / 2) - z.y) * k + 'px">' + (b.emoji || "📍") + "</button>").join("");
    const me = zid === cur ? '<div class="wm-me" style="left:' + (S.x - z.x) * k + "px;top:" + (S.y - z.y) * k + 'px"></div>' : "";
    const dest = S.dest && zid === cur ? '<div class="wm-dest" style="left:' + (S.dest.x - z.x) * k + "px;top:" + (S.dest.y - z.y) * k + 'px">📍</div>' : "";
    const others = window.Net && zid === cur ? Object.values(Net.players).filter((p) => !p.sc && p.x > z.x && p.x < z.x + z.w && p.y > z.y && p.y < z.y + z.h).map((p) => '<div class="wm-op" style="left:' + (p.x - z.x) * k + "px;top:" + (p.y - z.y) * k + 'px"></div>').join("") : "";
    let sheet = "";
    if (sel) {
      const t = G.fareTo(sel.x + sel.w / 2, sel.y + sel.h + 30);
      sheet = '<div class="wm-sheet"><h3>' + sel.emoji + " " + esc(sel.name) + "</h3><p>" + (sel.jobs ? "💼 Emplois sur place · " : sel.kind === "shop" ? "🛒 Boutique · " : "") + "à environ " + Math.round(t.d / 10) + " m · " + t.walk + " s à pied</p>" +
        (zid === cur ? '<div class="wm-act"><button id="wm-walk">🚶 Y aller à pied</button><button id="wm-taxi">🏍️ Moto-taxi · ' + fmt(t.fare) + "</button></div>" : '<div class="wm-act"><button id="wm-tz">🚕 Taxi vers ' + esc(z.name) + "</button></div>") + "</div>";
    } else if (zid !== cur) {
      const t = G.taxiList().find((q) => q.z.id === zid);
      sheet = '<div class="wm-sheet"><h3>' + esc(z.name) + "</h3>" + (soon(zid) ? "<p>🔒 Bientôt disponible.</p>" : "<p>" + (t ? "Taxi : " + fmt(t.fare) + " · à pied : " + Math.round(t.walk / 60) + " min" : "") + '</p><div class="wm-act"><button id="wm-tz">🚕 Y aller en taxi</button></div>') + "</div>";
    }
    ov.innerHTML = '<div class="wm-top"><button class="wm-x" id="wm-close">✕</button><div class="wm-money">💰 ' + fmt(S.money) + '</div></div><div class="wm-chips">' + chips + '</div><div class="wm-wrap"><div class="wm-map" style="width:' + W + "px;height:" + H + "px;background:" + z.ground + '">' + roads + pins + dest + others + me + "</div></div>" + sheet;
    $("wm-close").onclick = close;
    ov.querySelectorAll("[data-z]").forEach((b) => b.onclick = () => { zid = b.dataset.z; paint(null); });
    ov.querySelectorAll("button[data-b]").forEach((b) => b.onclick = () => paint(BUILDINGS.find((q) => q.id === b.dataset.b)));
    if (sel && $("wm-walk")) { $("wm-walk").onclick = () => { G.setDest(sel); close(); }; $("wm-taxi").onclick = () => { if (G.goTo(sel)) close(); }; }
    if ($("wm-tz")) $("wm-tz").onclick = () => { if (soon(zid)) return; if (G.travel(zid)) close(); };
  }
  document.addEventListener("click", (e) => { if (e.target.closest("#map-btn")) open(); });
  window.WorldMap = { open, close };
})();
