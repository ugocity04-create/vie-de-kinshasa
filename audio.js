// SONS : tout est fabriqué par le navigateur (aucun fichier audio à télécharger).
const Sound = (function () {
  "use strict";
  let ctx = null, master, sfx, music, amb, noiseBuf, cityG, rainG, stepT = 0, hornT = rnd(15, 30), chirpT = 2;
  const set = { sfx: true, music: true, vol: 0.7 };
  try { Object.assign(set, JSON.parse(localStorage.getItem("lvk-sound") || "{}")); } catch (e) {}
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function save() { try { localStorage.setItem("lvk-sound", JSON.stringify(set)); } catch (e) {} }
  const mtof = (n) => 440 * Math.pow(2, (n - 69) / 12);
  function init() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = set.vol; master.connect(ctx.destination);
    sfx = ctx.createGain(); music = ctx.createGain(); amb = ctx.createGain(); sfx.connect(master); music.connect(master); amb.connect(master);
    sfx.gain.value = set.sfx ? 1 : 0; music.gain.value = set.music ? 0.35 : 0; amb.gain.value = set.sfx ? 1 : 0;
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const loop = (type, freq, q) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 0.7; const g = ctx.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(amb); s.start(); return g; };
    cityG = loop("lowpass", 380); rainG = loop("bandpass", 3200, 0.5);
    startMusic();
  }
  function tone(f, dur, type, vol, when, slide) {
    if (!ctx || !set.sfx) return; const t = ctx.currentTime + (when || 0), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(sfx); o.start(t); o.stop(t + dur + 0.05);
  }
  function burst(dur, freq, vol, type, dest, when) {
    if (!ctx) return; const t = ctx.currentTime + (when || 0), s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = type || "lowpass"; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(dest || sfx); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  function play(name) {
    if (!ctx || !set.sfx) return;
    switch (name) {
      case "click": tone(660, 0.07, "triangle", 0.22); break;
      case "coin": tone(880, 0.09, "square", 0.1); tone(1320, 0.14, "square", 0.1, 0.08); break;
      case "door": burst(0.2, 500, 0.35); tone(110, 0.25, "sine", 0.3, 0, 70); break;
      case "horn": tone(392, 0.45, "sawtooth", 0.07); tone(494, 0.45, "sawtooth", 0.07); break;
      case "notify": tone(784, 0.1, "sine", 0.25); tone(1047, 0.18, "sine", 0.25, 0.1); break;
      case "msg": tone(520, 0.06, "triangle", 0.22); tone(780, 0.1, "triangle", 0.22, 0.07); break;
      case "error": tone(160, 0.2, "sawtooth", 0.15, 0, 90); break;
      case "step": burst(0.05, 800, 0.1); break;
      case "win": [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, "triangle", 0.22, i * 0.1)); break;
    }
  }
  // musique : petite rumba de guitare, basse et congas
  const CH = [[57, 60, 64], [55, 59, 62], [53, 57, 60], [52, 56, 59]], ARP = [0, 2, 1, 2, 0, 2, 1, 2];
  let step = 0, nextT = 0;
  function startMusic() { nextT = ctx.currentTime + 0.2; setInterval(sched, 120); }
  function sched() {
    if (!ctx || !set.music || ctx.state !== "running") { if (ctx) nextT = Math.max(nextT, ctx.currentTime); return; }
    const sp = 60 / 104 / 2;
    while (nextT < ctx.currentTime + 0.35) {
      const bar = Math.floor(step / 8) % 4, k = step % 8, ch = CH[bar], t = nextT - ctx.currentTime;
      const pluck = (n, vol, dur) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "triangle"; o.frequency.value = mtof(n); const at = ctx.currentTime + t; g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at + dur); o.connect(g); g.connect(music); o.start(at); o.stop(at + dur + 0.05); };
      pluck(ch[ARP[k]] + 12, 0.14, 0.4);
      if (k === 0 || k === 3 || k === 6) pluck(ch[0] - 12, 0.3, 0.5);
      if (k === 2 || k === 5 || k === 7) burst(0.09, 700, 0.18, "bandpass", music, t);
      if (k === 4) burst(0.06, 1500, 0.1, "bandpass", music, t);
      nextT += sp; step++;
    }
  }
  function tick(dt, st) {
    if (!ctx) return;
    const out = st.scene ? 0.015 : 0.06;
    cityG.gain.value += (out - cityG.gain.value) * Math.min(1, dt * 2); rainG.gain.value += (((st.raining && !st.scene) ? 0.1 : 0) - rainG.gain.value) * Math.min(1, dt * 2);
    if (st.walking && !st.moto) { stepT -= dt; if (stepT <= 0) { stepT = 0.34; play("step"); } } else stepT = 0;
    if (!st.scene) {
      hornT -= dt; if (hornT <= 0) { hornT = rnd(18, 40); play("horn"); }
      if (st.night) { chirpT -= dt; if (chirpT <= 0) { chirpT = rnd(0.15, 0.7); tone(rnd(3900, 4600), 0.05, "sine", 0.025); } }
    }
  }
  return {
    init, play, tick, get set() { return set; },
    setSfx(b) { set.sfx = b; if (ctx) { sfx.gain.value = b ? 1 : 0; amb.gain.value = b ? 1 : 0; } save(); },
    setMusic(b) { set.music = b; if (ctx) music.gain.value = b ? 0.35 : 0; save(); },
    setVol(v) { set.vol = v; if (ctx) master.gain.value = v; save(); }
  };
})();