// TÉLÉPHONE : messages (contacts + chat mondial), banque, objectifs, carte, réglages.
const Phone = (function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const CONTACTS = [
    { id: "maman", name: "Maman", emoji: "👩🏾", lines: ["Mon fils, n'oublie pas de manger !", "Le loyer tombe tous les 7 jours. Garde 14 000 FC de côté.", "Dors bien, la ville fatigue.", "Je suis fière de toi."], rep: ["Courage, mon enfant !", "Fais attention à toi dans les rues de Kin.", "Je prie pour toi."], kw: { argent: "Travaille dur et épargne, ça viendra.", salut: "Mbote mwana ! Tu vas bien ?", mbote: "Mbote mwana ! Tu as mangé ?" } },
    { id: "jean", name: "Jean (ami)", emoji: "🧑🏾", lines: ["Tu as essayé l'usine de Limete ? Ça paie bien.", "On cherche des vendeurs de légumes à N'djili.", "Le bureau de Gombe recrute, mais il faut de la réputation.", "Tu as vu le pont vers Brazzaville ? Magnifique la nuit !"], rep: ["Ha ha, d'accord !", "On se voit au Marché Central.", "Ça marche, mon frère."], kw: { job: "Va à l'usine ou au bureau, ça paie le mieux.", travail: "Commence au marché, puis monte en réputation.", argent: "Le kiosque rapporte 8 000 FC chaque nuit !" } },
    { id: "patron", name: "Patron de Gombe", emoji: "👔", lines: ["Le bureau de Gombe cherche un commis (réputation 12).", "Le travail sérieux est toujours récompensé."], rep: ["Montre-moi ce que tu sais faire.", "Passe au bureau entre 8h et 17h."], kw: {} },
    { id: "banque", name: "Banque", emoji: "🏦", lines: ["Pense à ouvrir ton kiosque : 150 000 FC.", "Une moto te fera gagner du temps : 400 000 FC."], rep: ["Nous sommes à votre service."], kw: {} }
  ];
  let open = false, app = "home", thread = null, world = [], nextAuto = 60, el;
  const S = () => G.S;
  const chats = () => (S().chats = S().chats || {});
  const th = (id) => (chats()[id] = chats()[id] || { msgs: [], unread: 0 });
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  function unreadTotal() { return Object.values(chats()).reduce((a, c) => a + (c.unread || 0), 0); }
  function badge() { const n = unreadTotal(), b = $("phone-badge"); b.textContent = n; b.hidden = !n; }
  function add(id, me, text) { const t = th(id); t.msgs.push({ me, text, ts: Date.now() }); t.msgs = t.msgs.slice(-40); if (!me && !(open && thread === id)) t.unread = (t.unread || 0) + 1; badge(); if (open) draw(); }
  function reply(c, text) {
    const low = text.toLowerCase(); let r = null; Object.keys(c.kw).forEach((k) => { if (low.includes(k)) r = c.kw[k]; });
    setTimeout(() => { add(c.id, false, r || c.rep[Math.floor(Math.random() * c.rep.length)]); Sound.play("msg"); }, 1200 + Math.random() * 1800);
  }
  function send(text) {
    text = text.trim(); if (!text || !thread) return false;
    if (thread === "monde") { if (Net.status !== "online") { G.toast(Net.status === "connecting" ? "Connexion au serveur… patiente (jusqu'à 1 minute)" : "Serveur hors ligne : message non envoyé"); return false; } Net.chat(text); return true; }
    if (thread.startsWith("p:")) { const id = thread.slice(2); add(thread, true, text); Net.dm(id, text); return true; }
    add(thread, true, text); const c = CONTACTS.find((q) => q.id === thread); if (c) reply(c, text);
  }
  Net.on("chat", (d) => { world.push(d); world = world.slice(-60); if (open && thread === "monde") draw(); else if (d.id !== Net.id) { th("monde").unread = (th("monde").unread || 0) + 1; badge(); } });
  Net.on("dm", (d) => { const t = th("p:" + d.from); t.name = d.name; add("p:" + d.from, false, d.text); Sound.play("msg"); });
  Net.on("status", () => { if (open) draw(); });
  function draw() {
    const body = $("ph-body"), s = S(); let h = "";
    $("ph-time").textContent = G.hh(G.nowH());
    $("ph-net").textContent = Net.status === "online" ? "🟢 " + Net.online + " en ligne" : Net.status === "connecting" ? "🟡 connexion…" : "⚪ hors ligne";
    $("ph-back").style.visibility = app === "home" ? "hidden" : "visible";
    if (app === "home") {
      const apps = [["msg", "💬", "Messages"], ["bank", "🏦", "Banque"], ["obj", "🎯", "Objectifs"], ["map", "🗺️", "Carte"], ["set", "⚙️", "Réglages"]];
      h = '<div class="apps">' + apps.map((a) => '<button data-app="' + a[0] + '"><span>' + a[1] + (a[0] === "msg" && unreadTotal() ? '<i class="dot">' + unreadTotal() + "</i>" : "") + "</span>" + a[2] + "</button>").join("") + "</div>";
    } else if (app === "msg" && !thread) {
      const row = (id, em, nm, last, un) => '<button class="prow" data-th="' + id + '"><b>' + em + "</b><div><strong>" + esc(nm) + "</strong><small>" + esc(last || "") + "</small></div>" + (un ? '<i class="dot">' + un + "</i>" : "") + "</button>";
      h = row("monde", "🌍", "Chat mondial", Net.status === "online" ? "Parle avec les joueurs en ligne" : "Serveur hors ligne", th("monde").unread);
      CONTACTS.forEach((c) => { const t = th(c.id), l = t.msgs[t.msgs.length - 1]; h += row(c.id, c.emoji, c.name, l ? l.text : "", t.unread); });
      const ps = Object.values(Net.players); if (ps.length) h += "<h4>Joueurs en ligne</h4>"; ps.forEach((p) => { const t = th("p:" + p.id), l = t.msgs[t.msgs.length - 1]; h += row("p:" + p.id, "🧑", p.name, l ? l.text : "Envoyer un message", t.unread); });
    } else if (app === "msg") {
      let title, msgs;
      if (thread === "monde") { title = "🌍 Chat mondial"; msgs = world.map((m) => ({ me: m.id === Net.id, text: m.text, who: m.name })); }
      else if (thread.startsWith("p:")) { const t = th(thread); title = "🧑 " + (t.name || (Net.players[thread.slice(2)] || {}).name || "Joueur"); msgs = t.msgs; }
      else { const c = CONTACTS.find((q) => q.id === thread); title = c.emoji + " " + c.name; msgs = th(thread).msgs; }
      th(thread).unread = 0; badge();
      h = "<h4>" + esc(title) + "</h4>" + (thread === "monde" && Net.status !== "online" ? '<p class="hint">Serveur ' + (Net.status === "connecting" ? "en cours de connexion (le serveur gratuit peut mettre 1 minute à se réveiller)…" : "hors ligne. Voir Réglages > Serveur.") + (Net.url ? "<br>Adresse utilisée : " + esc(Net.url) : "<br>Aucune adresse de serveur n'est enregistrée.") + "</p>" : "") + '<div class="msgs" id="ph-msgs">' + msgs.map((m) => '<div class="m ' + (m.me ? "me" : "") + '">' + (m.who && !m.me ? "<small>" + esc(m.who) + "</small>" : "") + esc(m.text) + "</div>").join("") + '</div><form id="ph-form"><input id="ph-in" maxlength="140" placeholder="Écrire…" autocomplete="off"><button>➤</button></form>';
    } else if (app === "bank") {
      h = '<div class="card big">' + G.fmt(s.money) + "</div><h4>Dernières opérations</h4>" + ((s.tx || []).slice().reverse().slice(0, 14).map((t) => '<div class="tx"><span>' + esc(t.label) + '</span><b class="' + (t.amt < 0 ? "neg" : "pos") + '">' + (t.amt > 0 ? "+" : "") + G.fmt(t.amt) + "</b></div>").join("") || '<p class="hint">Rien pour le moment.</p>');
    } else if (app === "obj") {
      h = MISSIONS.map((m) => { const d = s.missions.includes(m.id); return '<div class="tx ' + (d ? "done" : "") + '"><span>' + (d ? "✅ " : "⬜ ") + esc(m.text) + "</span><b>+" + G.fmt(m.reward) + "</b></div>"; }).join("");
    } else if (app === "map") h = '<canvas id="ph-map" width="340" height="400"></canvas><p class="hint">🟡 toi · 🔵 autres joueurs</p><h4>🚕 Taxi (ou marche à pied)</h4>' + G.taxiList().map((t) => '<div class="tx"><span>' + esc(t.z.name) + '<br><small>🚶 ' + (t.walk > 60 ? Math.round(t.walk / 60) + " min" : t.walk + " s") + '</small></span><button class="taxi" data-z="' + t.z.id + '">' + (t.d < 300 ? "ici" : G.fmt(t.fare)) + '</button></div>').join("");
    else if (app === "set") {
      const st = Sound.set;
      h = '<label class="sw"><input type="checkbox" id="s-sfx" ' + (st.sfx ? "checked" : "") + '> Sons</label><label class="sw"><input type="checkbox" id="s-mus" ' + (st.music ? "checked" : "") + '> Musique</label><label class="sw">Volume <input type="range" id="s-vol" min="0" max="1" step="0.05" value="' + st.vol + '"></label>' +
        '<label class="sw"><input type="checkbox" id="s-lite" ' + (G.lite() ? "checked" : "") + '> Mode léger (téléphone lent)</label><h4>Pseudo</h4><div class="line"><input id="s-name" maxlength="16" value="' + esc(s.name || "") + '"><button id="s-namebtn">OK</button></div><h4>Serveur multijoueur</h4><div class="line"><input id="s-srv" placeholder="wss://…" value="' + esc(Net.url || "") + '"><button id="s-srvbtn">Connecter</button></div><p class="hint">' + ($("ph-net").textContent) + "</p>";
    }
    body.innerHTML = h;
    const ms = $("ph-msgs"); if (ms) ms.scrollTop = ms.scrollHeight;
    if (app === "map") { drawMap(); document.querySelectorAll("button.taxi").forEach((b) => b.onclick = () => { if (G.travel(b.dataset.z)) toggle(false); }); }
  }
  function drawMap() {
    const c = $("ph-map").getContext("2d"), k = 340 / WORLD.w, k2 = 400 / WORLD.h; c.fillStyle = "#3b3e43"; c.fillRect(0, 0, 340, 400);
    ZONES.forEach((z) => { c.fillStyle = z.ground; c.fillRect(z.x * k, z.y * k2, z.w * k, z.h * k2); });
    c.fillStyle = "#2a7fb0"; c.fillRect(RIVER.x * k, RIVER.y * k2, RIVER.w * k, RIVER.h * k2); c.fillStyle = "#555"; BRIDGES.forEach((b) => c.fillRect(b.x * k, RIVER.y * k2, b.w * k, RIVER.h * k2));
    c.fillStyle = "#222"; c.font = "bold 10px sans-serif"; c.textAlign = "center"; [["Binza", 370, 300], ["Gombe", 1200, 300], ["Aéroport", 2030, 300], ["Matete", 370, 930], ["Marché", 1200, 930], ["Limete", 2030, 930], ["Kintambo", 370, 1530], ["Fleuve", 1200, 1530], ["N'djili", 2030, 1530], ["Brazzaville", 1200, 2200]].forEach((l) => c.fillText(l[0], l[1] * k, l[2] * k2));
    Object.values(Net.players).forEach((p) => { c.fillStyle = "#1e88e5"; c.beginPath(); c.arc(p.x * k, p.y * k2, 4, 0, 7); c.fill(); });
    c.fillStyle = "#f7c948"; c.strokeStyle = "#000"; c.beginPath(); c.arc(S().x * k, S().y * k2, 6, 0, 7); c.fill(); c.stroke();
  }
  function init() {
    el = $("phone");
    el.innerHTML = '<div class="frame"><div class="bar"><button id="ph-back">‹</button><b id="ph-time"></b><span id="ph-net"></span><button id="ph-x">✕</button></div><div id="ph-body"></div></div>';
    $("phone-btn").addEventListener("click", () => toggle());
    $("ph-x").addEventListener("click", () => toggle(false));
    $("ph-back").addEventListener("click", () => { if (thread) thread = null; else app = "home"; draw(); });
    el.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return; Sound.play("click");
      if (b.dataset.app) { app = b.dataset.app; thread = null; draw(); } else if (b.dataset.th) { thread = b.dataset.th; draw(); }
      else if (b.id === "s-namebtn") { const v = $("s-name").value.trim().slice(0, 16); if (v) { S().name = v; Net.connect(Net.url, v, { shirt: "#1e88e5", skin: "#a0673a" }); G.save(); G.toast("Pseudo : " + v); } }
      else if (b.id === "s-srvbtn") { const v = $("s-srv").value.trim(); try { localStorage.setItem("lvk-server", v); } catch (x) {} Net.connect(v, S().name, { shirt: "#1e88e5", skin: "#a0673a" }); setTimeout(draw, 800); }
    });
    el.addEventListener("submit", (e) => { e.preventDefault(); const i = $("ph-in"); if (send(i.value) !== false) i.value = ""; });
    el.addEventListener("change", (e) => { const id = e.target.id; if (id === "s-sfx") Sound.setSfx(e.target.checked); else if (id === "s-mus") Sound.setMusic(e.target.checked); else if (id === "s-vol") Sound.setVol(+e.target.value); else if (id === "s-lite") G.setLite(e.target.checked); });
    el.addEventListener("input", (e) => { if (e.target.id === "s-vol") Sound.setVol(+e.target.value); });
    badge();
  }
  function toggle(v) { open = v === undefined ? !open : v; el.hidden = !open; if (open) { app = "home"; thread = null; draw(); } }
  function tick(dt) {
    nextAuto -= dt; if (nextAuto <= 0) { nextAuto = 90 + Math.random() * 100; const c = CONTACTS[Math.floor(Math.random() * CONTACTS.length)], l = c.lines[Math.floor(Math.random() * c.lines.length)]; add(c.id, false, l); Sound.play("notify"); G.toast("💬 " + c.name + " : " + l.slice(0, 40)); }
  }
  return { init, tick, toggle, get open() { return open; } };
})();
