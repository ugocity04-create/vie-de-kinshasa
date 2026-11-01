// MULTIJOUEUR : se connecte au petit serveur (dossier "server") pour voir les autres joueurs et chatter.
const Net = (function () {
  "use strict";
  const N = { players: {}, online: 0, status: "offline", id: null, url: "" };
  const ev = { chat: [], dm: [], status: [] };
  let ws = null, name = "", look = {}, retry = 0, posT = 0, timer = null;
  N.on = (e, fn) => ev[e].push(fn);
  const fire = (e, a) => ev[e].forEach((f) => { try { f(a); } catch (x) {} });
  function setStatus(s) { N.status = s; fire("status", s); }
  N.connect = function (url, nm, lk) {
    N.url = url || ""; name = nm; look = lk || {}; if (timer) { clearTimeout(timer); timer = null; }
    if (ws) { try { ws.onclose = null; ws.close(); } catch (e) {} ws = null; }
    N.players = {}; N.id = null;
    if (!N.url) { setStatus("offline"); return; }
    setStatus("connecting");
    try { ws = new WebSocket(N.url); } catch (e) { setStatus("offline"); return; }
    ws.onopen = () => { retry = 0; setStatus("online"); N.send({ t: "hello", name, shirt: look.shirt, skin: look.skin }); };
    ws.onmessage = (m) => {
      let d; try { d = JSON.parse(m.data); } catch (e) { return; }
      if (d.t === "welcome") N.id = d.id;
      else if (d.t === "count") N.online = d.n;
      else if (d.t === "players") {
        const seen = {};
        d.list.forEach((p) => { if (p.id === N.id) return; seen[p.id] = 1; const o = N.players[p.id]; if (o) { Object.assign(o, p, { x: o.x, y: o.y, tx: p.x, ty: p.y }); } else N.players[p.id] = Object.assign({}, p, { tx: p.x, ty: p.y }); });
        Object.keys(N.players).forEach((id) => { if (!seen[id]) delete N.players[id]; });
      } else if (d.t === "chat") { const p = N.players[d.id]; if (p) { p.say = d.text.slice(0, 40); p.sayT = 5; } fire("chat", d); }
      else if (d.t === "dm") fire("dm", d);
    };
    ws.onclose = () => { setStatus("offline"); N.players = {}; retry = Math.min(retry + 1, 6); timer = setTimeout(() => N.connect(N.url, name, look), 3000 * retry); };
    ws.onerror = () => {};
  };
  N.send = (o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };
  N.sendPos = function (dt, x, y, sc, hd, mv) { posT -= dt; if (posT > 0) return; posT = 0.15; N.send({ t: "pos", x: Math.round(x), y: Math.round(y), sc, hd: +hd.toFixed(2), mv }); };
  N.chat = (text) => N.send({ t: "chat", text });
  N.dm = (to, text) => N.send({ t: "dm", to, text });
  N.tick = function (dt) {
    Object.values(N.players).forEach((p) => { const k = Math.min(1, dt * 8); p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k; if (p.sayT > 0) { p.sayT -= dt; if (p.sayT <= 0) p.say = null; } });
  };
  return N;
})();