// MODE DÉCORATION : acheter des meubles et les placer avec le doigt dans sa maison.
const HouseEdit = (function () {
  let on = false, sel = null, ov = null, drag = null, tab = "shop";
  const $ = (id) => document.getElementById(id), fmt = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " FC";
  const cat = (k) => HCAT.find((c) => c.k === k);
  function items() { return G.S.house; }
  function overlaps(a, x, y) { return items().some((o) => o !== a && !o.walk && !a.walk && x < o.x + o.w && x + a.w > o.x && y < o.y + o.h && y + a.h > o.y); }
  function fit(a, x, y) { return Math.max(24, Math.min(ROOM.w - 24 - a.w, Math.round(x / 10) * 10)) + "," + Math.max(ROOM.wallH + 6, Math.min(440 - a.h, Math.round(y / 10) * 10)); }
  function sync() { G.reroom(); }
  function start() {
    if (on || !G.scene || G.scene.kind !== "home") return; on = true; sel = null; document.body.classList.add("hedit"); ov = document.createElement("div"); ov.id = "hedit"; document.body.appendChild(ov); paint();
  }
  function stop() { on = false; sel = null; if (ov) ov.remove(); ov = null; document.body.classList.remove("hedit"); G.setSel(null); G.save(); }
  function buy(c) {
    if (G.S.money < c.price) return G.toast("Il te manque " + fmt(c.price - G.S.money));
    let pos = null; for (let y = ROOM.wallH + 10; y < 440 - c.h && !pos; y += 20) for (let x = 24; x < ROOM.w - 24 - c.w && !pos; x += 20) { const t = { w: c.w, h: c.h, walk: c.walk }; if (!overlaps(t, x, y)) pos = [x, y]; }
    if (!pos) return G.toast("Plus de place !");
    G.pay(c.price, "Achat : " + c.name); const o = { id: Date.now() + Math.random(), k: c.k, x: pos[0], y: pos[1], w: c.w, h: c.h }; if (c.walk) o.walk = true; if (c.act) { o.act = c.act; o.label = c.label; } items().push(o); sel = o; sync(); G.setSel(o); paint();
  }
  function sell() { if (!sel) return; const c = cat(sel.k), back = Math.round((c ? c.price : 0) / 2); G.S.house = items().filter((o) => o !== sel); if (back) G.pay(-back, "Vente : " + (c ? c.name : "")); sel = null; sync(); G.setSel(null); paint(); }
  function paint() {
    if (!ov) return; const c = cat(sel && sel.k), st = G.S.hs || (G.S.hs = { floor: HSTYLES.floor[0][0], wall: HSTYLES.wall[0][0] });
    let body = "";
    if (tab === "shop") body = '<div class="he-row">' + HCAT.filter((q) => q.price > 0).map((q) => '<button data-buy="' + q.k + '"><span>' + q.emoji + "</span><b>" + q.name + "</b><i>" + fmt(q.price) + "</i></button>").join("") + "</div>";
    else body = ["floor", "wall"].map((k) => '<div class="he-sty"><b>' + (k === "floor" ? "Sol" : "Murs") + '</b><div>' + HSTYLES[k].map((o) => '<button data-st="' + k + '" data-c="' + o[0] + '" class="' + (st[k] === o[0] ? "on" : "") + '" style="background:' + o[0] + '"></button>').join("") + "</div></div>").join("");
    ov.innerHTML = '<div class="he-bar"><button class="' + (tab === "shop" ? "on" : "") + '" data-tab="shop">🛒 Meubles</button><button class="' + (tab === "style" ? "on" : "") + '" data-tab="style">🎨 Murs & sol</button>' + (sel ? '<button class="he-sell" id="he-sell">🗑️ ' + ((c && c.price) ? "Vendre +" + fmt(c.price / 2) : "Retirer") + "</button>" : "") + '<button class="he-ok" id="he-ok">✓ Terminé</button></div><p class="he-hint">' + (sel ? "Glisse le meuble avec ton doigt pour le déplacer." : "Touche un meuble dans la pièce pour le déplacer, ou achètes-en un.") + " 💰 " + fmt(G.S.money) + "</p>" + body;
    ov.querySelectorAll("[data-tab]").forEach((b) => b.onclick = () => { tab = b.dataset.tab; paint(); });
    ov.querySelectorAll("[data-buy]").forEach((b) => b.onclick = () => buy(cat(b.dataset.buy)));
    ov.querySelectorAll("[data-st]").forEach((b) => b.onclick = () => { st[b.dataset.st] = b.dataset.c; sync(); paint(); });
    $("he-ok").onclick = stop; if ($("he-sell")) $("he-sell").onclick = sell;
  }
  // déplacer avec le doigt
  const gc = document.getElementById("game"), rect = () => gc.getBoundingClientRect();
  function at(e) { const r = rect(), p = R3D.unproject(e.clientX - r.left, e.clientY - r.top, 0.3); return p ? { x: p.x * 20, y: p.z * 20 } : null; }
  gc.addEventListener("pointerdown", (e) => {
    if (!on) return; const p = at(e); if (!p) return;
    const hit = [...items()].reverse().find((o) => !o.walk && p.x >= o.x - 6 && p.x <= o.x + o.w + 6 && p.y >= o.y - 6 && p.y <= o.y + o.h + 6) || [...items()].reverse().find((o) => o.walk && p.x >= o.x && p.x <= o.x + o.w && p.y >= o.y && p.y <= o.y + o.h);
    sel = hit || null; G.setSel(sel); drag = hit ? { dx: p.x - hit.x, dy: p.y - hit.y } : null; paint(); e.stopPropagation();
  }, true);
  window.addEventListener("pointermove", (e) => {
    if (!on || !drag || !sel) return; const p = at(e); if (!p) return; const [nx, ny] = fit(sel, p.x - drag.dx, p.y - drag.dy).split(",").map(Number);
    if (!overlaps(sel, nx, ny)) { sel.x = nx; sel.y = ny; sync(); }
  });
  window.addEventListener("pointerup", () => { drag = null; });
  const api = { start, stop, get on() { return on; } };
  document.addEventListener("click", (e) => { if (e.target.closest("#deco-btn")) start(); });
  return api;
})();
