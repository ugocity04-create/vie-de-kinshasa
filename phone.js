// TÉLÉPHONE : messages (contacts + chat mondial), banque, objectifs, carte, réglages.
const Phone = (function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  let open = false, app = "home", thread = null, world = [], el, tmenu = false;
  const S = () => G.S;
  const chats = () => (S().chats = S().chats || {});
  const th = (id) => (chats()[id] = chats()[id] || { msgs: [], unread: 0 });
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  function unreadTotal() { return Object.keys(chats()).reduce((a, k) => a + (k === "monde" || k.startsWith("d:") ? chats()[k].unread || 0 : 0), 0); }
  const blocked = () => (S().blocked = S().blocked || []);
  const isBlocked = (n) => blocked().includes(String(n).toLowerCase());
  const dkey = (name) => "d:" + String(name).replace(/^@/, "").toLowerCase();
  function badge() { const n = unreadTotal(), b = $("phone-badge"); b.textContent = n; b.hidden = !n; }
  function add(id, me, text) { const t = th(id); t.msgs.push({ me, text, ts: Date.now() }); t.msgs = t.msgs.slice(-40); if (!me && !(open && thread === id)) t.unread = (t.unread || 0) + 1; badge(); if (open) draw(); }
  function send(text) {
    text = text.trim(); if (!text || !thread) return false;
    text = Filter.clean(text);
    if (thread === "monde") { if (Net.status !== "online") { G.toast(Net.status === "connecting" ? "Connexion au serveur… patiente (jusqu'à 1 minute)" : "Serveur hors ligne : message non envoyé"); return false; } Net.chat(text); return true; }
    const t = th(thread), toName = t.name || "", who = Object.values(Net.players).find((q) => q.name.toLowerCase() === toName.toLowerCase());
    if (isBlocked(toName)) { G.toast("Tu as bloqué @" + toName + ". Débloque-le d'abord."); return false; }
    if (Auth.user) {
      add(thread, true, text); const mine = t.msgs[t.msgs.length - 1];
      if (who && Net.status === "online") Net.dm(who.name, text);
      Auth.storeDM(toName, text).then((ok) => { if (!ok) { const i = t.msgs.indexOf(mine); if (i >= 0) t.msgs.splice(i, 1); G.toast("@" + toName + " : message non envoyé (pseudo introuvable ?)"); if (open) draw(); } });
      return true;
    }
    if (Net.status !== "online") { G.toast("Serveur hors ligne : message non envoyé"); return false; }
    if (!who) { G.toast("@" + toName + " n'est pas en ligne : message non envoyé"); return false; }
    add(thread, true, text); Net.dm(who.name, text); return true;
  }
  Net.on("chat", (d) => { if (isBlocked(d.name)) return; d.text = Filter.clean(d.text); world.push(d); world = world.slice(-60); if (open && thread === "monde") draw(); else if (d.id !== Net.id) { th("monde").unread = (th("monde").unread || 0) + 1; badge(); } });
  Net.on("dm", (d) => { if (isBlocked(d.name)) return; d.text = Filter.clean(d.text); const k = dkey(d.name); th(k).name = d.name; add(k, false, d.text); Sound.play("msg"); G.toast("💬 " + d.name + " : " + d.text.slice(0, 40)); });
  Net.on("you", (nm) => { if (nm && S().name !== nm) { S().name = nm; G.save(); } });
  Net.on("fail", (to) => G.toast("@" + to + " n'est pas en ligne"));
  Net.on("status", () => { if (open) draw(); });
  function draw() {
    const body = $("ph-body"), s = S(); let h = "";
    $("ph-time").textContent = G.hh(G.nowH());
    $("ph-net").textContent = Net.status === "online" ? "🟢 " + Net.online + " en ligne" : Net.status === "connecting" ? "🟡 connexion…" : "⚪ hors ligne";
    $("ph-back").style.visibility = app === "home" ? "hidden" : "visible"; el.classList.toggle("home", app === "home"); $("ph-top").style.display = app === "home" ? "none" : "flex"; $("ph-title").textContent = ({ msg: thread ? "" : "Messages", jobs: "Emplois", cars: "Véhicules", house: "Maison", bank: "Banque", obj: "Objectifs", map: "Carte", set: "Réglages" })[app] || "";
    if (app === "home") {
      const apps = [["msg", "💬", "Messages"], ["jobs", "💼", "Emplois"], ["cars", "🚗", "Véhicules"], ["house", "🏠", "Maison"], ["bank", "🏦", "Banque"], ["obj", "🎯", "Objectifs"], ["map", "🗺️", "Carte"], ["set", "⚙️", "Réglages"]];
      h = '<div class="hclock"><b>' + G.hh(G.nowH()) + "</b><small>" + new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Kinshasa" }) + " · Kinshasa</small></div>" + '<div class="apps">' + apps.map((a) => '<button data-app="' + a[0] + '" class="ic-' + a[0] + '"><span>' + a[1] + (a[0] === "msg" && unreadTotal() ? '<i class="dot">' + unreadTotal() + "</i>" : "") + "</span>" + a[2] + "</button>").join("") + "</div>";
    } else if (app === "msg" && !thread) {
      const row = (id, em, nm, last, un) => '<button class="prow" data-th="' + id + '"><b>' + em + "</b><div><strong>" + esc(nm) + "</strong><small>" + esc(last || "") + "</small></div>" + (un ? '<i class="dot">' + un + "</i>" : "") + "</button>";
      h = '<form id="ph-new" class="line"><input id="ph-to" maxlength="16" placeholder="✏️ Écrire à : @pseudo" autocomplete="off"><button>OK</button></form>';
      const keys = Object.keys(chats()).filter((k) => k.startsWith("d:") && chats()[k].msgs.length).sort((a, b) => chats()[b].msgs[chats()[b].msgs.length - 1].ts - chats()[a].msgs[chats()[a].msgs.length - 1].ts);
      h += "<h4>Mes conversations</h4>" + (keys.map((k) => { const t = chats()[k], l = t.msgs[t.msgs.length - 1], on = Object.values(Net.players).some((q) => q.name.toLowerCase() === (t.name || "").toLowerCase()); return row(k, on ? "🟢" : "⚪", "@" + t.name, l.text, t.unread); }).join("") || '<p class="hint">Aucune conversation. Choisis un joueur ci-dessous ou écris son @pseudo.</p>');
      const ps = Object.values(Net.players); h += "<h4>Joueurs en ligne (" + ps.length + ")</h4>" + (ps.map((q) => row("new:" + q.name, "🧑", "@" + q.name, "Envoyer un message", 0)).join("") || '<p class="hint">Personne d\'autre en ligne pour le moment.</p>');
      h += "<h4>Public</h4>" + row("monde", "🌍", "Chat public", "Message visible par tous les joueurs", th("monde").unread);
    } else if (app === "msg") {
      let title, msgs;
      if (thread === "monde") { title = "🌍 Chat public (tout le monde)"; msgs = world.map((m) => ({ me: m.id === Net.id, text: m.text, who: m.name })); }
      else { const t = th(thread); title = "💬 @" + (t.name || "joueur"); msgs = t.msgs; }
      if (thread !== "monde" && th(thread).unread && Auth.user) Auth.markRead(th(thread).name || ""); th(thread).unread = 0; badge();
      h = "<h4>" + esc(title) + (thread !== "monde" ? ' <button class="taxi" id="ph-menu" style="float:right;padding:2px 10px">⋯</button>' : "") + "</h4>" + (tmenu && thread !== "monde" ? '<div class="line"><button class="taxi" data-blk="1">🚫 Bloquer</button><button class="taxi" data-rep="1">🚩 Signaler</button></div>' : "") + (thread === "monde" && Net.status !== "online" ? '<p class="hint">Serveur ' + (Net.status === "connecting" ? "en cours de connexion (le serveur gratuit peut mettre 1 minute à se réveiller)…" : "hors ligne. Voir Réglages > Serveur.") + (Net.url ? "<br>Adresse utilisée : " + esc(Net.url) : "<br>Aucune adresse de serveur n'est enregistrée.") + "</p>" : "") + '<div class="msgs" id="ph-msgs">' + msgs.map((m) => '<div class="m ' + (m.me ? "me" : "") + '">' + (m.who && !m.me ? "<small>" + esc(m.who) + "</small>" : "") + esc(m.text) + "</div>").join("") + '</div><form id="ph-form"><input id="ph-in" maxlength="140" placeholder="Écrire…" autocomplete="off"><button>➤</button></form>';
    } else if (app === "bank") {
      h = '<div class="card big">' + G.fmt(s.money) + "</div><h4>Dernières opérations</h4>" + ((s.tx || []).slice().reverse().slice(0, 14).map((t) => '<div class="tx"><span>' + esc(t.label) + '</span><b class="' + (t.amt < 0 ? "neg" : "pos") + '">' + (t.amt > 0 ? "+" : "") + G.fmt(t.amt) + "</b></div>").join("") || '<p class="hint">Rien pour le moment.</p>');
    } else if (app === "obj") {
      h = MISSIONS.map((m) => { const d = s.missions.includes(m.id); return '<div class="tx ' + (d ? "done" : "") + '"><span>' + (d ? "✅ " : "⬜ ") + esc(m.text) + "</span><b>+" + G.fmt(m.reward) + "</b></div>"; }).join("");
    } else if (app === "jobs") {
      h = '<p class="hint">Tous les emplois de Kinshasa, du moins payé au mieux payé. Touche pour y aller en taxi.</p>' + G.jobBoard().map((r) => { const here = r.z.id === s.zone, t = here ? null : G.taxiList().find((q) => q.z.id === r.z.id);
        return '<div class="tx jobrow ' + (r.locked ? "done" : "") + '"><span><b>' + esc(r.j.name) + "</b><br><small>" + r.b.emoji + " " + esc(r.b.name) + " · " + esc(r.z.name) + (r.b.open ? " · " + r.b.open[0] + "h-" + r.b.open[1] + "h" : "") + "<br>" + G.fmt(r.j.pay) + " · " + r.j.hours + "h · " + (r.locked ? "🔒 réputation " + r.j.rep : "⚡ -" + r.j.energy) + '</small></span>' + (here ? "<em>📍 ici</em>" : '<button class="taxi" data-go="' + r.z.id + '">🚕 ' + G.fmt(t ? t.fare : 0) + "</button>") + "</div>"; }).join("");
    } else if (app === "cars") {
      h = '<div class="card big">' + G.fmt(s.money) + "</div>" + G.VEHS.map((v) => { const own = s.own.includes(v.id); return '<div class="tx"><span><b>' + v.emoji + " " + v.name + "</b><br><small>" + v.desc + "</small></span>" + (own ? (s.veh === v.id ? "<em>✅ utilisé</em>" : '<button class="taxi" data-use="' + v.id + '">Utiliser</button>') : '<button class="taxi" data-buyv="' + v.id + '">' + G.fmt(v.price) + "</button>") + "</div>"; }).join("") + (s.veh ? '<div class="tx"><span>🚶 Marcher à pied</span><button class="taxi" data-use="">Utiliser</button></div>' : "");
    } else if (app === "house") {
      h = '<div class="card big">' + (s.ownHome ? "🏠 Propriétaire" : "🏠 Locataire") + "</div>" + (s.ownHome ? '<p class="hint">Ta maison est à toi, tu ne paies plus de loyer. Félicitations !</p>' : '<div class="tx"><span><b>Loyer</b><br><small>14 000 FC tous les 7 jours · prochain : jour ' + s.nextRent + '</small></span></div><div class="tx"><span><b>Acheter ta maison</b><br><small>Plus de loyer, pour toujours.</small></span><button class="taxi" data-house="1">' + G.fmt(G.HOUSE_PRICE) + "</button></div>");
    } else if (app === "map") h = '<canvas id="ph-map" width="340" height="400"></canvas><p class="hint">🟡 toi · 🔵 autres joueurs</p><h4>🚕 Taxi (ou marche à pied)</h4>' + G.taxiList().map((t) => '<div class="tx"><span>' + esc(t.z.name) + '<br><small>🚶 ' + (t.walk > 60 ? Math.round(t.walk / 60) + " min" : t.walk + " s") + '</small></span><button class="taxi" data-z="' + t.z.id + '">' + (t.d < 300 ? "ici" : G.fmt(t.fare)) + '</button></div>').join("");
    else if (app === "set") {
      const st = Sound.set;
      h = '<label class="sw"><input type="checkbox" id="s-sfx" ' + (st.sfx ? "checked" : "") + '> Sons</label><label class="sw"><input type="checkbox" id="s-mus" ' + (st.music ? "checked" : "") + '> Musique</label><label class="sw">Volume <input type="range" id="s-vol" min="0" max="1" step="0.05" value="' + st.vol + '"></label>' +
        '<div class="line"><button id="s-av" style="flex:1">🎨 Mon apparence</button></div><label class="sw"><input type="checkbox" id="s-lite" ' + (G.lite() ? "checked" : "") + '> Mode léger (téléphone lent)</label>' + (Auth.user ? '<h4>Compte</h4><div class="line"><span style="flex:1;align-self:center">@' + esc(Auth.user.username) + '</span><button id="s-logout">Déconnexion</button></div><h4>Mot de passe</h4><div class="line"><input id="s-pw" type="password" placeholder="Nouveau mot de passe" autocomplete="new-password"><button id="s-pwbtn">OK</button></div><div style="display:none">' : '') + '<h4>Pseudo</h4><div class="line"><input id="s-name" maxlength="16" value="' + esc(s.name || "") + '"><button id="s-namebtn">OK</button></div>' + (Auth.user ? '</div>' : '') + (blocked().length ? '<h4>Joueurs bloqués</h4>' + blocked().map((n) => '<div class="tx"><span>@' + esc(n) + '</span><button class="taxi" data-unblk="' + esc(n) + '">Débloquer</button></div>').join("") : '') + '<h4>Serveur multijoueur</h4><div class="line"><input id="s-srv" placeholder="wss://…" value="' + esc(Net.url || "") + '"><button id="s-srvbtn">Connecter</button></div><p class="hint">' + ($("ph-net").textContent) + "</p>";
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
  function importDMs(rows) {
    const me = (Auth.user && Auth.user.username) || "", ch = chats(); Object.keys(ch).forEach((k) => { if (k.startsWith("d:")) delete ch[k]; });
    (rows || []).forEach((r) => { const mine = r.from_user === me, other = mine ? r.to_user : r.from_user; if (isBlocked(other)) return; const k = dkey(other), t = th(k); t.name = other; t.msgs.push({ me: mine, text: Filter.clean(r.text), ts: Date.parse(r.created_at) || Date.now() }); if (!mine && !r.read) t.unread = (t.unread || 0) + 1; });
    Object.keys(ch).forEach((k) => { if (k.startsWith("d:")) ch[k].msgs = ch[k].msgs.slice(-40); }); badge(); if (open) draw();
  }
  function init() {
    el = $("phone");
    el.innerHTML = '<button id="ph-x">✕ Fermer</button><div class="frame"><i class="isl"></i><div class="bar"><b id="ph-time"></b><span id="ph-net"></span></div><div id="ph-top"><button id="ph-back">‹</button><b id="ph-title"></b></div><div id="ph-body"></div><button id="ph-home" aria-label="Accueil"></button></div>';
    $("phone-btn").addEventListener("click", () => toggle());
    $("ph-x").addEventListener("click", () => toggle(false)); $("ph-home").addEventListener("click", () => { if (app === "home") { toggle(false); return; } app = "home"; thread = null; draw(); });
    $("ph-back").addEventListener("click", () => { tmenu = false; if (thread) thread = null; else app = "home"; draw(); });
    el.addEventListener("click", (e) => {
      if (e.target === el) { toggle(false); return; }
      const b = e.target.closest("button"); if (!b) return; Sound.play("click");
      if (b.dataset.buyv) { G.buyVeh(b.dataset.buyv); draw(); } else if (b.dataset.use !== undefined && b.hasAttribute("data-use")) { G.useVeh(b.dataset.use); draw(); } else if (b.dataset.house) { G.buyHouse(); draw(); } else if (b.dataset.go) { if (G.travel(b.dataset.go)) toggle(false); } else if (b.dataset.app) { app = b.dataset.app; thread = null; draw(); } else if (b.dataset.th) { thread = b.dataset.th; if (thread.startsWith("new:")) { const nm = thread.slice(4); thread = dkey(nm); th(thread).name = nm; } draw(); }
      else if (b.id === "ph-menu") { tmenu = !tmenu; draw(); }
      else if (b.dataset.blk) { const n = th(thread).name; if (n && confirm("Bloquer @" + n + " ?")) { blocked().push(n.toLowerCase()); delete chats()[thread]; thread = null; tmenu = false; G.save(); G.toast("🚫 @" + n + " est bloqué"); draw(); } }
      else if (b.dataset.rep) { const n = th(thread).name, why = prompt("Pourquoi signaler @" + n + " ? (insultes, arnaque, harcèlement…)"); if (why) { const ctx = th(thread).msgs.slice(-6).map((m) => (m.me ? "moi" : n) + ": " + m.text).join(" | "); Auth.report(n, why, ctx).then((ok) => G.toast(ok ? "🚩 Signalement envoyé. Merci !" : "Signalement impossible pour le moment")); tmenu = false; draw(); } }
      else if (b.dataset.unblk) { S().blocked = blocked().filter((x) => x !== b.dataset.unblk); G.save(); draw(); }
      else if (b.id === "s-pwbtn") { const v = $("s-pw").value; if (v.length < 6) return G.toast("Mot de passe : 6 caractères minimum"); Auth.changePassword(v).then((er) => { G.toast(er ? "Erreur : " + er : "🔐 Mot de passe changé"); if (!er) $("s-pw").value = ""; }); }
      else if (b.id === "s-av") { G.avatarEditor(); } else if (b.id === "s-logout") { Auth.logout(); } else if (b.id === "s-namebtn") { const v = $("s-name").value.trim().slice(0, 16); if (v) { S().name = v; Net.connect(Net.url, v, G.netLook()); G.save(); G.toast("Pseudo : " + v); } }
      else if (b.id === "s-srvbtn") { const v = $("s-srv").value.trim(); try { localStorage.setItem("lvk-server", v); } catch (x) {} Net.connect(v, S().name, G.netLook()); setTimeout(draw, 800); }
    });
    el.addEventListener("submit", (e) => { e.preventDefault(); if (e.target.id === "ph-new") { const v = $("ph-to").value.trim().replace(/^@/, ""); if (!v) return; const who = Object.values(Net.players).find((q) => q.name.toLowerCase() === v.toLowerCase()); if (!who && !chats()[dkey(v)]) return G.toast("@" + v + " n'est pas en ligne"); thread = dkey(v); th(thread).name = who ? who.name : th(thread).name || v; draw(); return; } const i = $("ph-in"); if (send(i.value) !== false) i.value = ""; });
    el.addEventListener("change", (e) => { const id = e.target.id; if (id === "s-sfx") Sound.setSfx(e.target.checked); else if (id === "s-mus") Sound.setMusic(e.target.checked); else if (id === "s-vol") Sound.setVol(+e.target.value); else if (id === "s-lite") G.setLite(e.target.checked); });
    el.addEventListener("input", (e) => { if (e.target.id === "s-vol") Sound.setVol(+e.target.value); });
    badge();
  }
  function toggle(v) { open = v === undefined ? !open : v; el.hidden = !open; if (open) { app = "home"; thread = null; draw(); } }
  function tick(dt) {}
  return { importDMs, init, tick, toggle, get open() { return open; } };
})();
