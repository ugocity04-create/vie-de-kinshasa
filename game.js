(function () {
  "use strict";
  // ====== RÉGLAGES (tu peux les changer) ======
  const CFG = {
    TZ: 1,                 // Kinshasa et Lagos : UTC+1. L'heure du jeu = l'heure réelle !
    WALK: 150, MOTO: 300,  // vitesse à pied / en moto (pixels par seconde)
    FOOD_S: 0.02, ENERGY_S: 0.012, // nourriture / énergie perdues par seconde réelle (0.02 = 1.2 par minute)
    JOB_SECS_PER_HOUR: 15, // un travail de 2 h dure 30 secondes réelles
    SLEEP_SECS: 20, TV_SECS: 6, FRIDGE_WAIT: 120 // secondes
  };
  const KEY = "lvk-save-v3";
  const START = { day: 1, money: 5000, energy: 100, food: 70, health: 100, rep: 0, started: false,
                  x: 165, y: 925, face: 1, kiosk: false, moto: false, won: false, own: [], veh: "", ownHome: false,
                  name: "", hd: 0, chats: {}, tx: [], date: "", nextRent: 8, lastDaily: "", streak: 0, fridgeAt: 0, missions: [],
                  stats: { jobs: 0, meals: 0, houses: 0, earned: 0, zones: [], jobIds: [] } };
  const $ = (id) => document.getElementById(id);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const fmt = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " FC";
  const hh = (h) => Math.floor(h) + "h" + String(Math.floor((h % 1) * 60)).padStart(2, "0");
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  let fakeHour = null; // pour les tests seulement
  function nowH() {
    if (fakeHour !== null) return fakeHour;
    const d = new Date();
    return (d.getUTCHours() + CFG.TZ + 24) % 24 + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  }
  function todayKey(offset) { return new Date(Date.now() + CFG.TZ * 3600e3 + (offset || 0) * 864e5).toISOString().slice(0, 10); }

  let S = load(); S.own = S.own || []; if (S.moto && !S.own.includes("moto")) S.own.push("moto"); if (!S.veh && S.moto) S.veh = "moto"; if (!S.zone) { const zz = ZONES.find((q) => S.x >= q.x && S.x <= q.x + q.w && S.y >= q.y && S.y <= q.y + q.h); S.zone = zz ? zz.id : "matete"; }
  function load() {
    try {
      const r = localStorage.getItem(KEY);
      if (r) { const o = JSON.parse(r); const s = Object.assign({}, START, o, { started: true }); s.stats = Object.assign({}, START.stats, o.stats || {}); return s; }
    } catch (e) {}
    return JSON.parse(JSON.stringify(START));
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} Auth.queueSave(S); }

  // ====== MONDE ======
  const jobById = Object.fromEntries(JOBS.map((j) => [j.id, j]));
  const solids = []; // rectangles où on ne peut pas marcher
  function buildSolids() {
    solids.length = 0;
    BUILDINGS.forEach((b) => { if (b.kind !== "deco" && b.kind !== "stall" && b.id !== "kiosk" ? true : b.kind === "deco" || b.kind === "stall" || (b.id === "kiosk" && S.kiosk)) solids.push(b); });
    solids.push(WATER, AIRPORT, { x: 0, y: 1800, w: 740, h: 300 }, { x: 860, y: 1800, w: 680, h: 300 }, { x: 1660, y: 1800, w: 740, h: 300 });
    BRIDGES.forEach((b) => { solids.push({ x: b.x, y: 1800, w: 10, h: 300 }, { x: b.x + b.w - 10, y: 1800, w: 10, h: 300 }); });
  }
  function active(b) { return !b.needs || S[b.needs]; }
  function curZone() { return ZONES.find((z) => z.id === (S.zone || "matete")); }
  function blocked(x, y) {
    const l = x - 9, r = x + 9, t = y - 6, b = y;
    if (l < 20 || r > WORLD.w - 20 || t < 20 || b > WORLD.h - 20) return true;
    const zr = curZone(); if (zr && !scene && (l < zr.x - 110 || r > zr.x + zr.w + 110 || t < zr.y - 110 || b > zr.y + zr.h + 110)) return true;
    for (const s of solids) if (r > s.x && l < s.x + s.w && b > s.y && t < s.y + s.h) return true;
    return false;
  }
  function inRect(x, y, r, m) { m = m || 0; return x > r.x - m && x < r.x + r.w + m && y > r.y - m && y < r.y + r.h + m; }
  function onRoad(x, y) {
    return ROADS.h.some((r) => y > r.y && y < r.y + r.h) || ROADS.v.some((r) => x > r.x && x < r.x + r.w);
  }

  // décor : arbres et lampadaires (positions fixes grâce à un tirage "graine")
  let seed = 7; const srnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const trees = [], lamps = [];
  (function decor() {
    const zones = ["binza", "gombe", "matete", "marche", "limete", "kintambo", "ndjili"];
    zones.forEach((id) => {
      const z = ZONES.find((q) => q.id === id), n = id === "binza" ? 14 : id === "matete" || id === "kintambo" ? 9 : 7;
      for (let i = 0, t = 0; i < n && t < 300; t++) {
        const x = z.x + 30 + srnd() * (z.w - 60), y = z.y + 40 + srnd() * (z.h - 70);
        if (BUILDINGS.some((b) => inRect(x, y, { x: b.x, y: b.y, w: b.w, h: b.h + 70 }, 30))) continue;
        if (inRect(x, y, WATER) || inRect(x, y, RIVER) || onRoad(x, y)) continue;
        trees.push({ x, y, s: 0.8 + srnd() * 0.6 }); i++;
      }
    });
    ROADS.h.forEach((r) => { for (let x = 120; x < WORLD.w; x += 240) { lamps.push({ x, y: r.y - 6 }); lamps.push({ x: x + 120, y: r.y + r.h + 18 }); } });
    ROADS.v.forEach((r) => { for (let y = 160; y < WORLD.h; y += 240) { lamps.push({ x: r.x - 6, y }); lamps.push({ x: r.x + r.w + 6, y: y + 120 }); } });
  })();

  // voitures
  const cars = [];
  (function makeCars() {
    const cols = ["#c62828", "#1565c0", "#2e7d32", "#f9a825", "#6a1b9a", "#eceff1", "#37474f", "#ef6c00"];
    function add(axis, lane, dir, pos, road) {
      const r = Math.random(), type = r < 0.2 ? "bus" : r < 0.5 ? "taxi" : "car";
      cars.push({ axis, lane, dir, pos, v: rnd(90, 150), base: 0, type, col: type === "taxi" ? "#fbc02d" : type === "bus" ? "#1976d2" : pick(cols) });
      cars[cars.length - 1].base = cars[cars.length - 1].v;
    }
    ROADS.h.forEach((r) => { for (let i = 0; i < 4; i++) { add("h", r.y + 30, 1, rnd(0, WORLD.w)); add("h", r.y + 90, -1, rnd(0, WORLD.w)); } });
    ROADS.v.forEach((r) => { for (let i = 0; i < 3; i++) { add("v", r.x + 30, 1, rnd(0, WORLD.h)); add("v", r.x + 90, -1, rnd(0, WORLD.h)); } });
  })();

  // passants
  const skins = ["#5a3825", "#7b4a2d", "#8d5524", "#a0673a", "#c68642"];
  const shirts = ["#e53935", "#1e88e5", "#fdd835", "#43a047", "#fb8c00", "#8e24aa", "#ffffff", "#00acc1", "#d81b60"];
  const npcs = [];
  function mkNpc(o) { return Object.assign({ skin: pick(skins), shirt: pick(shirts), pants: pick(["#263238", "#3e2723", "#1a237e", "#37474f"]), t: rnd(0, 9), say: null, sayT: 0, moving: true, face: 1, hd: 0, f: Math.random() < 0.45, hair: pick(["#1b1b1b", "#2b1b12", "#111111"]) }, o); }
  (function makeNpcs() {
    for (let i = 0; i < 16; i++) {
      const horiz = Math.random() < 0.5, road = pick(horiz ? ROADS.h : ROADS.v), side = Math.random() < 0.5;
      npcs.push(mkNpc({ kind: "walker", horiz, line: horiz ? (side ? road.y - 10 : road.y + road.h + 10) : (side ? road.x - 10 : road.x + road.w + 10),
        pos: rnd(60, horiz ? WORLD.w - 60 : WORLD.h - 60), dir: Math.random() < 0.5 ? 1 : -1, v: rnd(28, 55) }));
    }
    PLAZAS.forEach((p) => { for (let i = 0; i < p.n; i++) npcs.push(mkNpc({ kind: "wander", plaza: p, x: rnd(p.x, p.x + p.w), y: rnd(p.y, p.y + p.h), tx: 0, ty: 0, wait: rnd(0, 3), v: rnd(25, 45) })); });
    npcs.forEach((n) => { if (n.kind === "wander") { n.tx = n.x; n.ty = n.y; } });
  })();
  // pirogues sur le fleuve
  const boats = [{ x: 950, y: 1500, v: 22 }, { x: 1250, y: 1620, v: -17 }, { x: 1400, y: 1460, v: 28 }, { x: 300, y: 1950, v: 20 }, { x: 1100, y: 1900, v: -24 }, { x: 2000, y: 2000, v: 18 }];

  // ====== ÉTAT DE JEU ======
  let W = 0, H = 0, dpr = 1, lite = false;
  let scene = null, room = null, ip = { x: 240, y: 455, face: 1 }, nearItem = null;
  let time = 0, raining = 0, modalBuilder = null, modalLocked = false, ff = null, near = null, lastZone = "", nextEvent = rnd(60, 110), pendingEvent = null, saveT = 0, hudT = 0;
  const keys = {}, joy = { x: 0, y: 0 };
  const pl = { moving: false };

  try { lite = localStorage.getItem("lvk-lite") === "1"; } catch (e) {}
  function resize() { dpr = lite ? 1 : Math.min(2, window.devicePixelRatio || 1); W = window.innerWidth; H = window.innerHeight; R3D.resize(W, H, dpr); }
  R3D.init($("game"), $("overlay"));
  window.addEventListener("resize", resize); resize();

  function toast(m) {
    const li = document.createElement("li"); li.textContent = m; $("toasts").appendChild(li);
    while ($("toasts").children.length > 4) $("toasts").removeChild($("toasts").firstChild);
    setTimeout(() => li.remove(), 4500);
  }
  function money(d, label) { S.money += d; S.tx = S.tx || []; S.tx.push({ label, amt: d }); S.tx = S.tx.slice(-30); if (d > 0) Sound.play("coin"); }
  function stats() { S.money = Math.max(0, Math.round(S.money)); S.energy = clamp(S.energy, 0, 100); S.food = clamp(S.food, 0, 100); S.health = clamp(S.health, 0, 100); }

  // ====== BESOINS ET JOURNÉES ======
  function checkDate() {
    const t = todayKey();
    if (!S.date) { S.date = t; return; }
    if (S.date === t) return;
    const days = Math.max(1, Math.min(7, Math.round((new Date(t) - new Date(S.date)) / 864e5)));
    S.date = t;
    for (let i = 0; i < days; i++) newDay();
  }
  function newDay() {
    S.day++; toast(T.newDay + S.day);
    if (S.kiosk) { money(KIOSK_INCOME, "Kiosque"); toast(T.kioskIncome + fmt(KIOSK_INCOME)); }
    if (S.day >= S.nextRent && !S.ownHome) {
      S.nextRent += RENT_EVERY;
      if (S.money >= RENT) { money(-RENT, "Loyer"); toast(T.rentPaid + fmt(RENT)); } else { S.health -= 20; toast(T.rentFail); }
    }
  }
  function needs(dt, mult) {
    S.food -= CFG.FOOD_S * dt * (mult === undefined ? 1 : mult);
    if (mult === undefined) S.energy -= CFG.ENERGY_S * dt;
    if (S.food <= 0) { S.food = 0; S.health -= 0.05 * dt; }
    stats();
    if (S.health <= 0) hospital();
  }
  function hospital() {
    S.money = Math.floor(S.money / 2); S.health = 50; S.energy = 60; S.food = 40;
    S.x = 165; S.y = 925; S.zone = "matete"; scene = null; ff = null; $("ff").hidden = true; toast(T.hospital);
  }
  function startFF(type, secs, extra) {
    ff = Object.assign({ type, total: Math.max(1, secs), done: 0, e0: S.energy }, extra || {});
    $("ff").hidden = false;
    $("ff-text").textContent = type === "job" ? T.working + " " + ff.job.name : type === "tv" ? T.tvTitle : T.sleepTitle;
    closeModal();
  }
  function updateFF(dt) {
    const step = Math.min(dt, ff.total - ff.done);
    needs(step, ff.type === "job" ? 1 : 0.5); if (!ff) return;
    if (ff.type === "job") S.energy -= ff.job.energy * step / ff.total;
    else if (ff.type === "sleep" || ff.type === "collapse") S.energy += (100 - ff.e0) * step / ff.total;
    else if (ff.type === "tv") S.energy += 8 * step / ff.total;
    ff.done += step; stats();
    $("ff-bar").style.width = (100 * ff.done / ff.total) + "%";
    if (ff.done >= ff.total - 1e-6) finishFF();
  }
  function finishFF() {
    const f = ff; ff = null; $("ff").hidden = true;
    if (f.type === "job") {
      money(f.pay, f.job.name); S.rep += 1; S.stats.jobs++; S.stats.earned += f.pay; if (!S.stats.jobIds.includes(f.job.id)) S.stats.jobIds.push(f.job.id);
      toast(T.paid + fmt(f.pay) + " (" + f.job.name + ")");
      if (Math.random() < 0.3) pendingEvent = pick(EVENTS.filter((e) => e.ctx !== "travel"));
    } else if (f.type === "sleep") { S.energy = 100; if (S.food > 40) S.health += 10; toast(T.restHint);
    } else if (f.type === "tv") toast("💡 " + pick(T.facts));
    else { S.energy = 60; S.health -= 10; toast(T.collapseMsg); }
    stats(); save();
  }
  // ====== OBJECTIFS ET RÉCOMPENSE DU JOUR ======
  function currentMission() { return MISSIONS.find((m) => !S.missions.includes(m.id)); }
  function checkMissions() {
    const m = currentMission(); if (!m || !m.check(S)) return;
    S.missions.push(m.id); money(m.reward, "Objectif"); toast(T.objectiveDone + m.text + " (+" + fmt(m.reward) + ")"); save();
  }
  function dailyReward() {
    const t = todayKey(); if (S.lastDaily === t) return;
    S.streak = S.lastDaily === todayKey(-1) ? S.streak + 1 : 1; S.lastDaily = t;
    const r = 1000 * Math.min(S.streak, 7); money(r, "Récompense du jour"); save();
    openModal(T.dailyTitle, T.dailyText + S.streak, (box) => { addText(box, "+ " + fmt(r), "event"); addText(box, T.comeBack); addBtn(box, T.ok, "", () => { modalLocked = false; closeModal(); }); }, true);
  }

  // ====== MENUS ======
  function openModal(title, sub, builder, locked) {
    modalLocked = !!locked; $("m-title").textContent = title; $("m-sub").textContent = sub || "";
    $("m-close").style.display = locked ? "none" : ""; modalBuilder = builder; $("modal").hidden = false; refreshModal();
  }
  function refreshModal() { if (!modalBuilder) return; const b = $("m-body"); b.innerHTML = ""; modalBuilder(b); }
  function closeModal() { if (modalLocked) return; $("modal").hidden = true; modalBuilder = null; }
  function addBtn(box, label, sub, fn, disabled) {
    const b = document.createElement("button"); b.className = "act"; b.disabled = !!disabled;
    b.innerHTML = "<strong></strong><small></small>"; b.firstChild.textContent = label; b.lastChild.textContent = sub || "";
    if (!disabled) b.addEventListener("click", () => { Sound.play("click"); fn(); }); box.appendChild(b);
  }
  function addText(box, t, cls) { const p = document.createElement("p"); p.className = cls || "hint"; p.textContent = t; box.appendChild(p); }
  function isOpen(b) { if (!b.open) return true; const h = nowH(); return h >= b.open[0] && h < b.open[1]; }

  function openShop(b) {
    openModal(b.emoji + " " + b.name, "", (box) => {
      SHOP.forEach((it) => addBtn(box, it.name, fmt(it.price), () => {
        if (S.money < it.price) return toast(T.noMoney);
        money(-it.price, it.name); ["food", "energy", "health"].forEach((k) => { if (it.effect[k]) S[k] += it.effect[k]; });
        if (it.effect.food) S.stats.meals++; stats(); toast(T.bought + it.name); refreshModal();
      }, S.money < it.price));
    });
  }
  function openJobs(b, ids) {
    openModal(b.emoji + " " + b.name, "", (box) => {
      ids.forEach((id) => {
        const j = JOBS.find((q) => q.id === id), lock = S.rep < j.rep, tired = S.energy < j.energy;
        const sub = lock ? T.needRep + j.rep : tired ? T.tooTired : fmt(j.pay) + " · " + j.hours * CFG.JOB_SECS_PER_HOUR + " s · -" + j.energy + " " + T.energy.toLowerCase();
        addBtn(box, j.name, sub, () => startFF("job", j.hours * CFG.JOB_SECS_PER_HOUR, { job: j, pay: Math.round(j.pay * rnd(0.8, 1.2) / 100) * 100 }), lock || tired);
      });
    });
  }
  function openProjects() {
    openModal("📓 " + T.projects, "", (box) => {
      PROJECTS.forEach((p) => addBtn(box, p.name, S[p.id] ? "✅ " + T.already : fmt(p.price) + " · " + p.desc, () => {
        if (S.money < p.price) return toast(T.noMoney); money(-p.price, p.name); S[p.id] = true; buildSolids(); toast(T.bought + p.name);
        if (S.kiosk && S.moto && !S.won) { S.won = true; toast(T.win); } save(); refreshModal();
      }, S[p.id] || S.money < p.price));
      addText(box, T.rentInfo + " (" + T.day.toLowerCase() + " " + S.nextRent + ")");
    });
  }
  function showEvent(ev) {
    openModal("❗", "", (box) => {
      addText(box, ev.text, "event");
      ev.choices.forEach((ch) => addBtn(box, ch.label, "", () => {
        modalLocked = false; closeModal(); const e = ch.effect;
        ["money", "energy", "health", "rep"].forEach((k) => { if (e[k]) S[k] += e[k]; });
        if (e.hour) S.energy -= 4 * e.hour; if (e.rain) raining = e.rain; stats(); save();
      }, ch.cost && S.money < ch.cost));
    }, true);
  }

  // ====== APPARENCE DU PERSONNAGE ======
  const AV_DEF = { skin: "#8d5524", hair: "#1b1b1b", shirt: "#f7c948", pants: "#1a237e" };
  const AV_OPT = {
    hair: [["#1b1b1b", "Noir"], ["#3e2723", "Brun foncé"], ["#6d4c41", "Brun"], ["#b71c1c", "Rouge"], ["#e0b030", "Blond"], ["#9e9e9e", "Gris"], ["#7b1fa2", "Violet"], ["#1565c0", "Bleu"]],
    skin: [["#f1c7a0", "Clair"], ["#d9a066", "Miel"], ["#b9773f", "Cuivré"], ["#8d5524", "Brun"], ["#6b3e1f", "Brun foncé"], ["#4a2a14", "Ébène"], ["#34200f", "Nuit"]],
    shirt: [["#f7c948", "Jaune"], ["#e53935", "Rouge"], ["#1e88e5", "Bleu"], ["#43a047", "Vert"], ["#ffffff", "Blanc"], ["#212121", "Noir"], ["#ff7043", "Orange"], ["#8e24aa", "Violet"], ["#00acc1", "Turquoise"], ["#fdd835", "Citron"], ["#ec407a", "Rose"], ["#455a64", "Gris bleu"]],
    pants: [["#1a237e", "Jean bleu"], ["#263238", "Anthracite"], ["#3e2723", "Marron"], ["#37474f", "Gris"], ["#827717", "Kaki"], ["#b0bec5", "Clair"], ["#880e4f", "Bordeaux"], ["#1b5e20", "Vert"]]
  };
  const AV_TABS = [["hair", "✂️", "Cheveux"], ["skin", "🎨", "Peau"], ["shirt", "👕", "Haut"], ["pants", "👖", "Pantalon"]];
  function av() { S.av = Object.assign({}, AV_DEF, S.av || {}); return S.av; }
  function netLook() { const a = av(); return { shirt: a.shirt, skin: a.skin, hair: a.hair, pants: a.pants }; }
  function avatarEditor(done) {
    closeModal(); R3D.setPreview(true); document.body.classList.add("avmode");
    let tab = "hair", ov = document.createElement("div"); ov.id = "avedit";
    const finish = () => { R3D.setPreview(false); document.body.classList.remove("avmode"); ov.remove(); save(); if (window.Net) Net.sendLook(netLook()); if (done) done(); };
    function paint() {
      ov.innerHTML = '<div class="av-top"><button class="av-rd" id="av-back">‹</button><h3>Mon look</h3><button class="av-rd" id="av-rnd">🔀</button></div>' +
        '<div class="av-view"><div class="av-pill"><button data-v="1" class="' + (R3D.pv && R3D.pv.face ? "on" : "") + '">Visage</button><button data-v="0" class="' + (R3D.pv && !R3D.pv.face ? "on" : "") + '">Corps</button></div></div>' +
        '<div class="av-sheet"><div class="av-rail">' + AV_TABS.map((t) => '<button data-t="' + t[0] + '" class="' + (tab === t[0] ? "on" : "") + '"><span>' + t[1] + "</span>" + t[2] + "</button>").join("") + '</div><div class="av-grid">' +
        AV_OPT[tab].map((o) => '<button data-c="' + o[0] + '" class="' + (av()[tab] === o[0] ? "on" : "") + '"><i style="background:' + o[0] + '"></i>' + o[1] + "</button>").join("") + '</div><button class="av-done" id="av-done">Terminé</button></div>';
      ov.querySelectorAll("[data-t]").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.t; Sound.play("click"); paint(); }));
      ov.querySelectorAll("[data-c]").forEach((b) => b.addEventListener("click", () => { av()[tab] = b.dataset.c; Sound.play("click"); paint(); }));
      ov.querySelectorAll("[data-v]").forEach((b) => b.addEventListener("click", () => { if (R3D.pv) R3D.pv.face = b.dataset.v === "1"; paint(); }));
      $("av-done").onclick = finish; $("av-back").onclick = finish;
      $("av-rnd").onclick = () => { Object.keys(AV_OPT).forEach((k) => { av()[k] = pick(AV_OPT[k])[0]; }); paint(); };
    }
    const view = () => ov.querySelector(".av-view");
    let sx = null; ov.addEventListener("pointerdown", (e) => { if (e.target.closest(".av-view") && !e.target.closest("button")) { sx = e.clientX; if (R3D.pv) R3D.pv.drag = true; } });
    window.addEventListener("pointermove", (e) => { if (sx !== null && R3D.pv) { R3D.pv.yaw -= (e.clientX - sx) * 0.012; sx = e.clientX; } });
    window.addEventListener("pointerup", () => { sx = null; if (R3D.pv) R3D.pv.drag = false; });
    document.body.appendChild(ov); paint();
  }
  function openStart() {
    openModal(T.title, T.chooseStart, (box) => {
      const inp = document.createElement("input"); inp.id = "name-in"; inp.maxLength = 16; inp.placeholder = "Ton pseudo"; inp.value = S.name || "Joueur" + Math.floor(100 + Math.random() * 900); if (Auth.user) { inp.value = Auth.user.username; inp.readOnly = true; } inp.className = "namein"; box.appendChild(inp);
      addBtn(box, "🎨 Mon apparence", "Peau, cheveux, vêtements", () => { S.name = (inp.value || "Joueur").trim().slice(0, 16); avatarEditor(openStart); });
      PROFILES.forEach((pr) => addBtn(box, pr.name, pr.desc, () => {
        S.name = (inp.value || "Joueur").trim().slice(0, 16); netStart(); S.started = true; S.money = pr.money; S.rep = pr.rep; S.date = todayKey(); modalLocked = false; closeModal();
        toast(T.startMsg.replace("5 000 FC", fmt(pr.money))); toast(T.moveHint); save(); dailyReward();
      }));
    }, true);
  }

  // ====== BÂTIMENTS ET INTÉRIEURS ======
  // la maison du joueur : meubles achetés et placés par lui
  let hsel = null;
  function homeRoom() {
    if (!S.house) S.house = HCAT.filter((c) => c.start).map((c, i) => { const o = { id: "s" + i, k: c.k, x: c.start[0], y: c.start[1], w: c.w, h: c.h }; if (c.act) { o.act = c.act; o.label = c.label; } return o; });
    const hs = S.hs || (S.hs = { floor: HSTYLES.floor[0][0], wall: HSTYLES.wall[0][0] }); return { floor: hs.floor, wall: hs.wall, items: S.house };
  }
  function reroom() { if (scene && scene.kind === "home") { room = homeRoom(); } save(); }
  function enter(b) {
    if (b.kind === "kiosk") return openModal(b.emoji + " " + b.name, "", (box) => addText(box, T.kioskInfo));
    if (!isOpen(b)) return toast(T.opensAt + b.open[0] + T.to + b.open[1] + "h");
    scene = b; room = b.kind === "home" ? homeRoom() : interiorFor(b); ip = { x: 240, y: 455, face: 1 }; near = null; $("act").hidden = true;
    if (b.kind === "home") S.stats.houses++; Sound.play("door");
    save();
  }
  function leave() { Sound.play("door"); const b = scene; scene = null; room = null; S.x = b.x + b.w / 2; S.y = b.y + b.h + 18; }
  function doItem(it) {
    switch (it.act) {
      case "sleep": if (S.energy >= 85) return toast(T.notSleepy); return startFF("sleep", CFG.SLEEP_SECS);
      case "tv": return startFF("tv", CFG.TV_SECS);
      case "eat": {
        const wait = CFG.FRIDGE_WAIT * 1000 - (Date.now() - S.fridgeAt);
        if (wait > 0) return toast(T.fridgeEmpty);
        S.fridgeAt = Date.now(); S.food += 25; S.stats.meals++; stats(); return toast(T.ate);
      }
      case "projects": return openProjects();
      case "shop": return openShop(scene);
      case "job": return openJobs(scene, it.jobs);
    }
  }
  function onAct() {
    if (!S.started || ff || !$("modal").hidden) return;
    if (scene) { if (nearItem === "door") leave(); else if (nearItem) doItem(nearItem); }
    else if (near) enter(near);
  }

  // ====== MISE À JOUR ======
  function blockedIn(x, y) {
    const l = x - 9, r = x + 9, t = y - 6;
    if (l < 24 || r > ROOM.w - 24 || t < ROOM.wallH + 4 || y > ROOM.h - 12) return true;
    return room.items.some((s) => !s.walk && r > s.x && l < s.x + s.w && y > s.y + s.h * 0.35 && t < s.y + s.h);
  }
  function update(dt) {
    time += dt; if (raining > 0) raining -= dt;
    if (!scene) updateCity(dt);
    if (!S.started) return;
    const busy = !$("modal").hidden || ff;
    let mx = joy.x, my = joy.y;
    if (keys.ArrowLeft || keys.a || keys.q) mx -= 1; if (keys.ArrowRight || keys.d) mx += 1;
    if (keys.ArrowUp || keys.w || keys.z) my -= 1; if (keys.ArrowDown || keys.s) my += 1;
    const yw = R3D.getYaw(), cy = Math.cos(yw), sy = Math.sin(yw); if (!scene) { const rx = mx * cy + my * sy, ry = -mx * sy + my * cy; mx = rx; my = ry; }
    if (auto && !scene) {
      if (Math.hypot(mx, my) > 0.1) cancelAuto();
      else if (!busy) { const p = auto.pts[auto.i]; if (!p) cancelAuto(); else { const dx = p.x - S.x, dy = p.y - S.y, L = Math.hypot(dx, dy); if (L < 12) { auto.i++; if (auto.i >= auto.pts.length) cancelAuto(); } else { mx = dx / L; my = dy / L; } } }
    }
    if (scene && rauto) {
      rauto.t += dt;
      if (Math.hypot(mx, my) > 0.1) rauto = null;
      else if (!busy) { const dx = rauto.x - ip.x, dy = rauto.y - ip.y, L = Math.hypot(dx, dy); if (L < 9 || rauto.t > 6) { fireNext = !!rauto.fire; rauto = null; } else { mx = dx / L; my = dy / L; } }
    }
    const m = Math.hypot(mx, my); pl.moving = false;
    if (!busy && m > 0.1) {
      const sp = (scene ? 110 : vehSpeed()) * (S.energy < 15 ? 0.7 : 1) * dt / Math.max(1, m);
      if (scene) {
        const nx = ip.x + mx * sp, ny = ip.y + my * sp;
        if (!blockedIn(nx, ip.y)) ip.x = nx; if (!blockedIn(ip.x, ny)) ip.y = ny; S.hd = Math.atan2(mx, my); if (Math.abs(mx) > 0.1) ip.face = mx > 0 ? 1 : -1;
      } else {
        const nx = S.x + mx * sp, ny = S.y + my * sp;
        if (!blocked(nx, S.y)) S.x = nx; if (!blocked(S.x, ny)) S.y = ny; S.hd = Math.atan2(mx, my);
      }
      pl.moving = true;
    }
    if (ff) updateFF(dt);
    else if (!busy) {
      needs(dt);
      if (S.energy <= 0 && !ff) { toast(T.collapse); startFF("collapse", CFG.SLEEP_SECS); }
      if (!scene) {
        if (pendingEvent) { const e = pendingEvent; pendingEvent = null; showEvent(e); }
        nextEvent -= dt; if (nextEvent <= 0) { nextEvent = rnd(70, 130); showEvent(pick(EVENTS.filter((e) => e.ctx !== "job"))); }
      }
    }
    // élément proche
    near = null; nearItem = null; let label = "";
    if (scene) {
      let best = 1e9;
      room.items.forEach((s) => { if (!s.act) return; if (!inRect(ip.x, ip.y, s, 34)) return; const d = Math.hypot(ip.x - (s.x + s.w / 2), ip.y - (s.y + s.h)); if (d < best) { best = d; nearItem = s; label = s.label; } });
      if (!nearItem && ip.y > ROOM.h - 70 && Math.abs(ip.x - 240) < 70) { nearItem = "door"; label = T.exit; }
    } else {
      let best = 75;
      BUILDINGS.forEach((b) => { if (!active(b) || b.kind === "deco" || b.kind === "stall") return; const d = Math.hypot(S.x - (b.x + b.w / 2), S.y - (b.y + b.h + 8)); if (d < best) { best = d; near = b; } });
      if (near) label = near.emoji + " " + T.enter;
    }
    $("deco-btn").hidden = !(scene && scene.kind === "home" && !(window.HouseEdit && HouseEdit.on));
    const act = $("act"); act.hidden = !(label && !busy); if (label) act.textContent = label;
    if (fireNext) { fireNext = false; if (nearItem && !busy) onAct(); }
    if (!scene) { const z = ZONES.find((q) => inRect(S.x, S.y, q)); const zn = z ? z.name : ""; if (zn && zn !== lastZone) { lastZone = zn; toast("📍 " + zn); if (!S.stats.zones.includes(zn)) S.stats.zones.push(zn); } }
    saveT += dt; if (saveT > 4) { saveT = 0; save(); }
    hudT += dt; if (hudT > 0.15) { hudT = 0; hud(); checkMissions(); checkDate(); }
  }
  function updateCity(dt) {
    // voitures
    cars.forEach((a) => {
      let v = a.base;
      for (const o of cars) { if (o === a || o.axis !== a.axis || o.lane !== a.lane) continue; let d = (o.pos - a.pos) * a.dir; const L = a.axis === "h" ? WORLD.w : WORLD.h; if (d < 0) d += L; if (d > 0 && d < 120) v = Math.min(v, o.v); }
      a.v += (v - a.v) * Math.min(1, dt * 3); a.pos += a.dir * a.v * dt;
      const L = a.axis === "h" ? WORLD.w : WORLD.h; if (a.pos > L + 100) a.pos = -100; if (a.pos < -100) a.pos = L + 100;
    });
    boats.forEach((b) => { b.x += b.v * dt; const lo = b.y < 1700 ? 900 : b.x < 800 ? 40 : b.x < 1600 ? 880 : 1680, hi = b.y < 1700 ? 1500 : b.x < 800 ? 720 : b.x < 1600 ? 1520 : 2380; if (b.x > hi) b.v = -Math.abs(b.v); if (b.x < lo) b.v = Math.abs(b.v); });
    // passants
    npcs.forEach((n) => {
      n.t += dt; if (n.sayT > 0) n.sayT -= dt; else n.say = null;
      if (n.kind === "walker") {
        n.pos += n.dir * n.v * dt; const L = n.horiz ? WORLD.w : 1760;
        if (n.pos < 40 || n.pos > L - 40) n.dir *= -1; if (Math.random() < dt * 0.02) n.dir *= -1;
        if (n.horiz) { n.x = n.pos; n.y = n.line; } else { n.x = n.line; n.y = n.pos; } n.face = n.horiz ? n.dir : n.face; n.hd = n.horiz ? (n.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (n.dir > 0 ? 0 : Math.PI);
      } else {
        if (n.wait > 0) { n.wait -= dt; n.moving = false; }
        else {
          const dx = n.tx - n.x, dy = n.ty - n.y, d = Math.hypot(dx, dy);
          if (d < 4) { n.wait = rnd(1, 5); n.tx = rnd(n.plaza.x, n.plaza.x + n.plaza.w); n.ty = rnd(n.plaza.y, n.plaza.y + n.plaza.h); n.moving = false; }
          else { n.moving = true; n.x += dx / d * n.v * dt; n.y += dy / d * n.v * dt; n.hd = Math.atan2(dx, dy); }
        }
      }
      if (!n.say && Math.hypot(n.x - S.x, n.y - S.y) < 60 && Math.random() < dt * 0.4) { n.say = pick(T.bubbles); n.sayT = 2.5; }
    });
  }
  function hud() {
    const h = nowH();
    $("clock").textContent = hh(h); $("day").textContent = T.day + " " + S.day; $("sun").textContent = h >= 6 && h < 18 ? "☀️" : "🌙";
    $("money").textContent = fmt(S.money); $("rep").textContent = T.rep + " : " + S.rep;
    const m = currentMission(); $("mission").textContent = m ? T.objective + m.text + " (+" + fmt(m.reward) + ")" : T.allDone;
    [["energy", S.energy], ["food", S.food], ["health", S.health]].forEach(([k, v]) => { const e = $("b-" + k); e.style.width = v + "%"; e.parentNode.parentNode.classList.toggle("low", v < 25); });
  }

  // ====== DESSIN ======
  function darkness() { const h = nowH(); if (h >= 7 && h < 17.5) return 0; if (h >= 17.5 && h < 19.5) return (h - 17.5) / 2; if (h >= 19.5 || h < 4.5) return 1; if (h >= 4.5 && h < 7) return 1 - (h - 4.5) / 2.5; return 0; }
  // ====== ENTRÉES ======
  window.addEventListener("keydown", (e) => { keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = true; if (e.key === "e" || e.key === "Enter" || e.key === " ") { e.preventDefault(); onAct(); } if (e.key === "Escape") closeModal(); });
  window.addEventListener("keyup", (e) => { keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = false; });
  const stick = $("stick"), knob = $("knob"); let sid = null;
  function stickMove(e) { const r = stick.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), d = Math.min(Math.hypot(dx, dy), 50), a = Math.atan2(dy, dx); joy.x = Math.cos(a) * d / 50; joy.y = Math.sin(a) * d / 50; knob.style.transform = "translate(" + Math.cos(a) * d + "px," + Math.sin(a) * d + "px)"; }
  stick.addEventListener("pointerdown", (e) => { sid = e.pointerId; stick.setPointerCapture(sid); stickMove(e); });
  stick.addEventListener("pointermove", (e) => { if (e.pointerId === sid) stickMove(e); });
  const stickEnd = (e) => { if (e.pointerId === sid) { sid = null; joy.x = joy.y = 0; knob.style.transform = ""; } };
  stick.addEventListener("pointerup", stickEnd); stick.addEventListener("pointercancel", stickEnd);
  $("act").addEventListener("click", onAct);
  ["pointerdown", "keydown"].forEach((e) => window.addEventListener(e, () => Sound.init(), { once: false, passive: true }));
  let drag = null; const gc = $("game");
  const ptr = new Map(); let pinch0 = 0, zoom0 = 1;
  gc.addEventListener("pointerdown", (e) => { ptr.set(e.pointerId, { x: e.clientX, y: e.clientY }); drag = { x: e.clientX }; if (ptr.size === 2) { const [a, b] = [...ptr.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y) || 1; zoom0 = R3D.getZoom(); } });
  window.addEventListener("pointermove", (e) => {
    if (!ptr.has(e.pointerId)) return; const o = ptr.get(e.pointerId);
    if (ptr.size >= 2) { ptr.set(e.pointerId, { x: e.clientX, y: e.clientY }); const [a, b] = [...ptr.values()]; R3D.setZoom(zoom0 * pinch0 / (Math.hypot(a.x - b.x, a.y - b.y) || 1)); return; }
    if (drag && e.target === gc) { R3D.addYaw(-(e.clientX - drag.x) * 0.008); drag.x = e.clientX; } ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
  });
  ["pointerup", "pointercancel"].forEach((n) => window.addEventListener(n, (e) => { ptr.delete(e.pointerId); if (!ptr.size) drag = null; }));
  // affiche l'erreur à l'écran (pour trouver les bugs sur téléphone)
  let errShown = 0;
  function showErr(e) {
    const msg = String(e && (e.stack || e.message) || e).split("\n").slice(0, 3).join(" | ").slice(0, 400); if (errShown++ > 3) return;
    let d = document.getElementById("err-x"); if (!d) { d = document.createElement("div"); d.id = "err-x"; d.style.cssText = "position:fixed;left:8px;right:8px;bottom:8px;z-index:60;background:#7f1d1d;color:#fff;font:12px/1.4 monospace;padding:10px;border-radius:10px;word-break:break-all"; d.onclick = () => d.remove(); document.body.appendChild(d); }
    d.textContent = "⚠️ " + msg;
  }
  window.addEventListener("error", (ev) => showErr(ev.error || ev.message));
  window.addEventListener("unhandledrejection", (ev) => showErr(ev.reason));
  const U = 20; // 20 pixels de la carte = 1 unité 3D (comme dans render3d.js)
  // toucher le sol (ou un meuble) : le personnage y va tout seul
  let tap0 = null;
  gc.addEventListener("pointerdown", (e) => { tap0 = ptr.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null; });
  gc.addEventListener("pointerup", (e) => {
    const t0 = tap0; tap0 = null; if (window.HouseEdit && HouseEdit.on) return; if (!t0 || !S.started || ff || !$("modal").hidden || Math.hypot(e.clientX - t0.x, e.clientY - t0.y) > 12 || performance.now() - t0.t > 450) return;
    const r = gc.getBoundingClientRect();
    if (scene) {
      const p = R3D.unproject(e.clientX - r.left, e.clientY - r.top, 0); if (!p) return; const x = p.x * U, y = p.z * U;
      const it = room.items.find((s) => s.act && x > s.x - 14 && x < s.x + s.w + 14 && y > s.y - 14 && y < s.y + s.h + 14);
      if (it) rauto = { x: it.x + it.w / 2, y: it.y + it.h + 14, fire: true, t: 0 };
      else if (y > ROOM.h - 60 && Math.abs(x - 240) < 90) rauto = { x: 240, y: ROOM.h - 40, fire: true, t: 0 };
      else if (!blockedIn(x, y)) rauto = { x, y, fire: false, t: 0 };
      return;
    }
    const p = R3D.unproject(e.clientX - r.left, e.clientY - r.top, 0.2); if (!p) return;
    const pa = planPath(p.x * U, p.z * U); if (!pa) return; cancelAuto(); auto = { pts: pa.pts, i: 0 }; const last = pa.pts[pa.pts.length - 1] || { x: S.x, y: S.y }; S.dest = { id: "tap", name: "Ici", x: last.x, y: last.y };
    if (!document.getElementById("auto-x")) { const c = document.createElement("button"); c.id = "auto-x"; c.textContent = "✕ Arrêter"; c.onclick = cancelAuto; document.body.appendChild(c); }
  });
  gc.addEventListener("wheel", (e) => { R3D.setZoom(R3D.getZoom() + e.deltaY * 0.001); }, { passive: true });
  $("snd").addEventListener("click", () => { const on = !(Sound.set.sfx || Sound.set.music); Sound.setSfx(on); Sound.setMusic(on); $("snd").textContent = on ? "🔊" : "🔇"; });
  $("m-close").addEventListener("click", closeModal);
  $("reset").addEventListener("click", () => { if (confirm(T.resetAsk)) { try { localStorage.removeItem(KEY); } catch (e) {} location.reload(); } });
  $("lbl-energy").textContent = T.energy; $("lbl-food").textContent = T.food; $("lbl-health").textContent = T.health;
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});

  // ====== BOUCLE ======
  buildSolids();
  let last = performance.now();
  function frame(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000); last = ts; update(dt); Net.tick(dt); Phone.tick(dt);
    if (S.started) { Net.sendPos(dt, scene ? ip.x : S.x, scene ? ip.y : S.y, scene ? scene.id : null, S.hd || 0, pl.moving); Sound.tick(dt, { walking: pl.moving, moto: S.moto, scene: !!scene, raining: raining > 0, night: darkness() > 0.5 }); }
    if (S.dest && Math.hypot(S.dest.x - S.x, S.dest.y - S.y) < 70) { toast("📍 Arrivé : " + S.dest.name); cancelAuto(); }
    try { R3D.render(dt); } catch (e) { showErr(e); }
    requestAnimationFrame(frame);
  }
  function netStart() { let url = SERVER_URL; try { url = localStorage.getItem("lvk-server") || url; } catch (e) {} Net.connect(url, S.name, netLook(), Auth.token()); }
  // TAXI : voyager vers un quartier contre de l'argent (ou marcher, plus long)
  const ZSOON = ["aeroport", "brazza"];
  function zoneCenter(z) { return { x: z.x + z.w / 2, y: z.y + z.h / 2 }; }
  function taxiInfo(z) { const c = zoneCenter(z), d = Math.hypot(c.x - S.x, c.y - S.y); return { d, fare: Math.round(Math.max(1500, Math.round(d / 100) * 500) * (S.veh === "voiture" ? 0.25 : S.veh === "moto" ? 0.5 : 1) / 100) * 100, walk: Math.round(d / CFG.WALK) }; }
  function taxiList() { return ZONES.filter((z) => !ZSOON.includes(z.id)).map((z) => Object.assign({ z }, taxiInfo(z))); }
  // aller à un endroit précis du quartier (moto-taxi) ou poser un repère
  // ---- déplacement automatique (comme Lagos Life) : chemin A* autour des bâtiments ----
  let auto = null, rauto = null, fireNext = false;
  function cancelAuto() { auto = null; if (S.dest) S.dest = null; const c = document.getElementById("auto-x"); if (c) c.remove(); }
  function planPath(tx, ty) {
    const z = curZone(), C = 20, x0 = z.x - 100, y0 = z.y - 100, gw = Math.ceil((z.w + 200) / C), gh = Math.ceil((z.h + 200) / C);
    const cx = (i) => x0 + i * C + C / 2, cy = (j) => y0 + j * C + C / 2, ok = new Uint8Array(gw * gh);
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) ok[j * gw + i] = blocked(cx(i), cy(j)) ? 0 : 1;
    const cell = (x, y) => [Math.max(0, Math.min(gw - 1, Math.floor((x - x0) / C))), Math.max(0, Math.min(gh - 1, Math.floor((y - y0) / C)))];
    const near = (x, y) => { let [i, j] = cell(x, y); if (ok[j * gw + i]) return [i, j]; for (let r = 1; r < 12; r++) for (let a = -r; a <= r; a++) for (const [di, dj] of [[a, -r], [a, r], [-r, a], [r, a]]) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < gw && jj < gh && ok[jj * gw + ii]) return [ii, jj]; } return null; };
    const s = near(S.x, S.y), e = near(tx, ty); if (!s || !e) return null;
    const dist = new Float32Array(gw * gh).fill(1e9), prev = new Int32Array(gw * gh).fill(-1), open = [s[1] * gw + s[0]], done = new Uint8Array(gw * gh); dist[open[0]] = 0;
    const hh = (n) => Math.hypot(n % gw - e[0], Math.floor(n / gw) - e[1]);
    while (open.length) {
      let bi = 0; for (let k = 1; k < open.length; k++) if (dist[open[k]] + hh(open[k]) < dist[open[bi]] + hh(open[bi])) bi = k;
      const n = open.splice(bi, 1)[0]; if (done[n]) continue; done[n] = 1; if (n === e[1] * gw + e[0]) break;
      const ni = n % gw, nj = Math.floor(n / gw);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue; const ii = ni + di, jj = nj + dj; if (ii < 0 || jj < 0 || ii >= gw || jj >= gh) continue; const m = jj * gw + ii; if (!ok[m] || done[m]) continue;
        if (di && dj && (!ok[nj * gw + ii] || !ok[jj * gw + ni])) continue;
        const nd = dist[n] + (di && dj ? 1.42 : 1); if (nd < dist[m]) { dist[m] = nd; prev[m] = n; open.push(m); }
      }
    }
    const goal = e[1] * gw + e[0]; if (prev[goal] < 0 && goal !== s[1] * gw + s[0]) return null;
    let pts = []; for (let n = goal; n >= 0; n = prev[n]) pts.push({ x: cx(n % gw), y: cy(Math.floor(n / gw)) }); pts.reverse();
    const clear = (a, b) => { const L = Math.hypot(b.x - a.x, b.y - a.y), st = Math.ceil(L / 8); for (let k = 1; k < st; k++) if (blocked(a.x + (b.x - a.x) * k / st, a.y + (b.y - a.y) * k / st)) return false; return true; };
    const out = [], P0 = { x: S.x, y: S.y }; let a = P0, k = 0; while (k < pts.length) { let f = k; for (let q = pts.length - 1; q >= k; q--) if (clear(a, pts[q])) { f = q; break; } out.push(pts[f]); a = pts[f]; k = f + 1; }
    let len = 0; a = P0; out.forEach((p) => { len += Math.hypot(p.x - a.x, p.y - a.y); a = p; });
    return { pts: out, len };
  }
  function doorOf(b) { return { x: b.x + b.w / 2, y: b.y + b.h + 20 }; }
  function tripInfo(b) {
    const d = doorOf(b), p = zoneOf(S.x, S.y) === zoneOf(d.x, d.y) ? planPath(d.x, d.y) : null, len = p ? p.len : Math.hypot(d.x - S.x, d.y - S.y) * 1.2, f = fareTo(d.x, d.y);
    const vs = VEHS.filter((v) => S.own.includes(v.id)).map((v) => Object.assign({ t: Math.round(len / v.speed) }, v));
    return { len, walk: Math.round(len / CFG.WALK), veh: vs, fare: f.fare, taxi: Math.round(6 + len / 650), p };
  }
  function zoneOf(x, y) { const z = ZONES.find((q) => x >= q.x - 110 && x <= q.x + q.w + 110 && y >= q.y - 110 && y <= q.y + q.h + 110); return z ? z.id : ""; }
  function startAuto(b, vehId) {
    if (scene || ff) { toast("Sors d'abord du bâtiment."); return false; }
    const d = doorOf(b), p = planPath(d.x, d.y); if (!p) { toast("Chemin introuvable."); return false; }
    if (vehId !== undefined) useVeh(vehId);
    S.dest = { id: b.id, name: b.name, x: d.x, y: d.y }; auto = { pts: p.pts, i: 0 };
    if (!document.getElementById("auto-x")) { const c = document.createElement("button"); c.id = "auto-x"; c.textContent = "✕ Arrêter"; c.onclick = cancelAuto; document.body.appendChild(c); }
    return true;
  }
  function fareTo(x, y) { const d = Math.hypot(x - S.x, y - S.y); return { d, fare: Math.round(Math.max(500, Math.round(d / 100) * 150) * (S.veh === "voiture" ? 0.25 : S.veh === "moto" ? 0.5 : 1) / 50) * 50, walk: Math.round(d / vehSpeed()) }; }
  function goTo(b) {
    if (scene || ff) { toast("Sors d'abord du bâtiment."); return false; }
    const t = fareTo(b.x + b.w / 2, b.y + b.h + 30); if (t.d < 120) { toast("Tu es déjà là."); return false; }
    if (S.money < t.fare) { toast("Pas assez d'argent (" + fmt(t.fare) + ")."); return false; }
    money(-t.fare, "Moto-taxi vers " + b.name); Sound.play("door"); S.dest = null;
    let ok = false; for (let r = 0; r < 300 && !ok; r += 15) for (let a = 0; a < 6.28 && !ok; a += 0.5) { const x = b.x + b.w / 2 + Math.cos(a) * r, y = b.y + b.h + 30 + Math.sin(a) * r; if (!blocked(x, y)) { S.x = x; S.y = y; ok = true; } }
    S.energy -= 1; stats(); save(); toast("📍 " + b.name); return true;
  }
  function fadeTo(txt, ms, mid) {
    let f = document.getElementById("fade"); if (!f) { f = document.createElement("div"); f.id = "fade"; f.style.cssText = "position:fixed;inset:0;background:#000;color:#fff;display:flex;align-items:center;justify-content:center;font:700 20px sans-serif;opacity:0;transition:opacity .35s;z-index:20;pointer-events:none"; document.body.appendChild(f); }
    f.textContent = txt; f.style.opacity = 1; setTimeout(() => { mid(); f.style.opacity = 0; }, ms);
  }
  // carte : toucher un endroit = y aller directement (gratuit dans le quartier, taxi si autre quartier)
  function jumpTo(b) {
    if (scene || ff) { toast("Sors d'abord du bâtiment."); return false; }
    const d = doorOf(b), cz = ZONES.find((q) => d.x >= q.x && d.x <= q.x + q.w && d.y >= q.y && d.y <= q.y + q.h) || curZone();
    if (ZSOON.includes(cz.id)) { toast("🔒 Bientôt disponible."); return false; }
    const other = cz.id !== curZone().id; if (other) { const t = taxiInfo(cz); if (S.money < t.fare) { toast("Pas assez d'argent pour le taxi (" + fmt(t.fare) + ")."); return false; } money(-t.fare, "Taxi vers " + cz.name); Sound.play("door"); }
    cancelAuto();
    fadeTo(other ? "🚕 Taxi vers " + cz.name + "…" : "📍 " + b.name, other ? 1400 : 500, () => {
      if (other) S.zone = cz.id; let ok = false;
      for (let r = 0; r < 300 && !ok; r += 15) for (let a = 0; a < 6.28 && !ok; a += 0.5) { const x = d.x + Math.cos(a) * r, y = d.y + Math.sin(a) * r; if (!blocked(x, y)) { S.x = x; S.y = y; ok = true; } }
      if (other) S.energy -= 2; stats(); save(); toast("📍 " + b.name);
    });
    return true;
  }
  function setDest(b) { S.dest = b ? { id: b.id, name: b.name, x: b.x + b.w / 2, y: b.y + b.h + 20 } : null; if (b) toast("📍 Repère posé : " + b.name); save(); }
  function travel(id) {
    if (scene || ff) { toast("Sors d'abord du bâtiment."); return false; }
    const z = ZONES.find((q) => q.id === id), t = taxiInfo(z);
    if (t.d < 300) { toast("Tu es déjà dans ce quartier."); return false; }
    if (S.money < t.fare) { toast("Pas assez d'argent pour le taxi (" + fmt(t.fare) + ")."); return false; }
    money(-t.fare, "Taxi vers " + z.name); Sound.play("door");
    let f = document.getElementById("fade"); if (!f) { f = document.createElement("div"); f.id = "fade"; f.style.cssText = "position:fixed;inset:0;background:#000;color:#fff;display:flex;align-items:center;justify-content:center;font:700 20px sans-serif;opacity:0;transition:opacity .5s;z-index:50;pointer-events:none"; document.body.appendChild(f); }
    f.textContent = "🚕 Taxi vers " + z.name + "…"; f.style.opacity = 1;
    setTimeout(() => {
      S.zone = z.id; const c = { x: z.x + z.w / 2, y: z.y > 0 ? z.y - 50 : z.y + z.h + 50 }; let ok = false;
      for (let r = 0; r < 400 && !ok; r += 20) for (let a = 0; a < 6.28 && !ok; a += 0.6) { const x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r; if (!blocked(x, y)) { S.x = x; S.y = y; ok = true; } }
      S.zone = z.id; S.energy -= 2; stats(); save(); f.style.opacity = 0; toast("📍 " + z.name);
    }, 1800);
    return true;
  }
  // VÉHICULES, MAISON, EMPLOIS (apps du téléphone)
  const VEHS = [
    { id: "velo", name: "Vélo", emoji: "🚲", price: 25000, speed: 200, desc: "Plus rapide qu'à pied." },
    { id: "moto", name: "Moto", emoji: "🏍️", price: 400000, speed: 300, desc: "Rapide. Taxi à moitié prix." },
    { id: "voiture", name: "Voiture", emoji: "🚗", price: 3000000, speed: 450, desc: "Très rapide. Taxi à 25 %." }
  ];
  const HOUSE_PRICE = 6000000;
  function vehSpeed() { const v = VEHS.find((q) => q.id === S.veh); return v && S.own.includes(v.id) ? v.speed : CFG.WALK; }
  function buyVeh(id) {
    const v = VEHS.find((q) => q.id === id); if (!v || S.own.includes(id)) return false;
    if (S.money < v.price) { toast("Il te manque " + fmt(v.price - S.money)); return false; }
    money(-v.price, v.name); S.own.push(id); S.veh = id; S.moto = S.own.includes("moto") || S.own.includes("voiture"); toast("🎉 " + v.name + " achetée !"); Sound.play("coin");
    if (S.kiosk && S.moto && !S.won) { S.won = true; toast(T.win); } save(); return true;
  }
  function useVeh(id) { if (id === "" || S.own.includes(id)) { S.veh = id; save(); return true; } return false; }
  function buyHouse() {
    if (S.ownHome) return false; if (S.money < HOUSE_PRICE) { toast("Il te manque " + fmt(HOUSE_PRICE - S.money)); return false; }
    money(-HOUSE_PRICE, "Achat de la maison"); S.ownHome = true; toast("🏠 Tu es propriétaire ! Plus de loyer."); Sound.play("coin"); save(); return true;
  }
  function jobBoard() {
    const out = [];
    BUILDINGS.forEach((b) => { if (!b.jobs) return; const z = ZONES.find((q) => b.x + b.w / 2 >= q.x && b.x + b.w / 2 <= q.x + q.w && b.y + b.h / 2 >= q.y && b.y + b.h / 2 <= q.y + q.h);
      b.jobs.forEach((id) => { const j = JOBS.find((q) => q.id === id); if (j && z) out.push({ j, b, z, locked: S.rep < j.rep }); }); });
    return out.sort((a, b) => a.j.pay - b.j.pay);
  }
  window.G = { reroom, setSel(o) { hsel = o; }, get sel() { return hsel; }, pay(n, l) { money(-n, l); stats(); }, toast, save, jumpTo, tripInfo, startAuto, cancelAuto, fareTo, goTo, setDest, avatarEditor, av, netLook, VEHS, HOUSE_PRICE, buyVeh, useVeh, buyHouse, jobBoard, inZone(x, y, m) { const z = curZone(); m = m === undefined ? 130 : m; return !z || (x > z.x - m && x < z.x + z.w + m && y > z.y - m && y < z.y + z.h + m); }, curZone, taxiList, travel, get S() { return S; }, get scene() { return scene; }, get room() { return room; }, get ip() { return ip; }, get pl() { return pl; }, get near() { return near; }, get nearItem() { return nearItem; }, get raining() { return raining; }, get time() { return time; },
    cars, npcs, boats, trees, lamps, darkness, nowH, fmt, hh, toast, save, lite: () => lite, setLite(b) { lite = b; try { localStorage.setItem("lvk-lite", b ? "1" : "0"); } catch (e) {} resize(); } };
  window.__lvk = { get S() { return S; }, BUILDINGS, enter, leave, onAct, setHour(h) { fakeHour = h; }, get scene() { return scene; }, get ff() { return ff; }, get ip() { return ip; }, doItem, get room() { return room; } };
  R3D.setZoom(1.45);
  { const lb = document.createElement("div"); lb.style.cssText = "position:fixed;left:50%;bottom:150px;transform:translateX(-50%);background:rgba(0,0,0,.65);color:#fff;font:600 12px system-ui;padding:6px 12px;border-radius:99px;z-index:4;pointer-events:none"; document.body.appendChild(lb);
    if (typeof SKIN !== "undefined") SKIN.load("models/char");
    GLBM.loadAll("models", (d, n) => { lb.textContent = "🏙️ Chargement des bâtiments… " + d + "/" + n; if (d === Math.round(n / 2)) R3D.refresh(); }).then(() => { R3D.refresh(); lb.remove(); }); }
  function begin() {
    Phone.init(); checkDate(); hud(); if (S.started) netStart();
    if (!S.started) openStart(); else { toast(T.moveHint); dailyReward(); }
  }
  Auth.ready().then((r) => {
    if (r) {
      if (r.cloud) { S = Object.assign({}, JSON.parse(JSON.stringify(START)), r.cloud, { started: true }); S.stats = Object.assign({}, START.stats, r.cloud.stats || {}); }
      else if (!(S.started && (!S.uid || S.uid === r.id))) { S = JSON.parse(JSON.stringify(START)); }
      S.chats = S.chats || {}; Object.keys(S.chats).forEach((k) => { if (/^d:joueur\d+$/.test(k)) delete S.chats[k]; });
      S.uid = r.id; S.name = r.username; S.own = S.own || []; if (!S.zone) S.zone = "matete"; save();
    }
    begin();
    if (r) { Auth.onRejected = () => toast("⚠️ Sauvegarde refusée (gain d'argent suspect). Ta progression en ligne reste à la dernière version valide."); Auth.loadDMs().then((rows) => Phone.importDMs(rows)); }
  });
  requestAnimationFrame(frame);
})();
