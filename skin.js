// Personnages animés (Kenney "Animated Characters Retro") : lecteur de squelette fait maison.
// Les os sont calculés dans le navigateur, puis le corps est dessiné dans le même moteur 3D.
const SKIN = (function () {
  let D = null, ready = false;
  function reader(buf) {
    const dv = new DataView(buf), jl = dv.getUint32(12, true), j = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jl))), bin = 20 + jl + 8;
    const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }, CS = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
    function acc(i) {
      const a = j.accessors[i], bv = j.bufferViews[a.bufferView], nc = NC[a.type], cs = CS[a.componentType], stride = bv.byteStride || nc * cs, base = bin + (bv.byteOffset || 0) + (a.byteOffset || 0), out = new Float32Array(a.count * nc);
      for (let k = 0; k < a.count; k++) for (let c = 0; c < nc; c++) {
        const o = base + k * stride + c * cs; let v;
        switch (a.componentType) { case 5126: v = dv.getFloat32(o, true); break; case 5125: v = dv.getUint32(o, true); break; case 5123: v = dv.getUint16(o, true); if (a.normalized) v /= 65535; break; case 5121: v = dv.getUint8(o); if (a.normalized) v /= 255; break; case 5122: v = dv.getInt16(o, true); break; default: v = dv.getInt8(o); }
        out[k * nc + c] = v;
      }
      return out;
    }
    return { j, acc };
  }
  function mmul(a, b, o) { for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; }
  function trs(t, q, s, o) {
    const x = q[0], y = q[1], z = q[2], w = q[3];
    o[0] = (1 - 2 * (y * y + z * z)) * s[0]; o[1] = 2 * (x * y + z * w) * s[0]; o[2] = 2 * (x * z - y * w) * s[0]; o[3] = 0;
    o[4] = 2 * (x * y - z * w) * s[1]; o[5] = (1 - 2 * (x * x + z * z)) * s[1]; o[6] = 2 * (y * z + x * w) * s[1]; o[7] = 0;
    o[8] = 2 * (x * z + y * w) * s[2]; o[9] = 2 * (y * z - x * w) * s[2]; o[10] = (1 - 2 * (x * x + y * y)) * s[2]; o[11] = 0;
    o[12] = t[0]; o[13] = t[1]; o[14] = t[2]; o[15] = 1; return o;
  }
  function slerp(a, b, t, o) {
    let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3], s = 1; if (d < 0) { d = -d; s = -1; }
    let k0 = 1 - t, k1 = t; if (d < 0.9995) { const th = Math.acos(d), sn = Math.sin(th); k0 = Math.sin((1 - t) * th) / sn; k1 = Math.sin(t * th) / sn; }
    k1 *= s; let x = a[0] * k0 + b[0] * k1, y = a[1] * k0 + b[1] * k1, z = a[2] * k0 + b[2] * k1, w = a[3] * k0 + b[3] * k1; const l = Math.hypot(x, y, z, w) || 1;
    o[0] = x / l; o[1] = y / l; o[2] = z / l; o[3] = w / l;
  }
  async function load(dir) {
    try {
      const [bb, ab, im] = await Promise.all([fetch(dir + "/body.glb").then((r) => r.arrayBuffer()), fetch(dir + "/anim.glb").then((r) => r.arrayBuffer()), new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = dir + "/skin.png"; })]);
      const B = reader(bb), A = reader(ab), bj = B.j, byName = {};
      const N = bj.nodes.length, parent = new Int32Array(N).fill(-1), rest = bj.nodes.map((n) => ({ t: n.translation || [0, 0, 0], q: n.rotation || [0, 0, 0, 1], s: n.scale || [1, 1, 1] }));
      bj.nodes.forEach((n, i) => { byName[n.name] = i; (n.children || []).forEach((c) => { parent[c] = i; }); });
      const skin = bj.skins[0], joints = skin.joints, ibm = B.acc(skin.inverseBindMatrices);
      const pr = bj.meshes[0].primitives[0], pos = B.acc(pr.attributes.POSITION), nrm = B.acc(pr.attributes.NORMAL), uv = B.acc(pr.attributes.TEXCOORD_0), jn = B.acc(pr.attributes.JOINTS_0), wt = B.acc(pr.attributes.WEIGHTS_0), idx = B.acc(pr.indices);
      const nv = pos.length / 3;
      // couleurs de départ lues dans la texture, et "zone" de chaque point : 0 peau, 1 cheveux, 2 haut, 3 pantalon, 4 chaussures
      let tex = null; if (im) { const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const x = c.getContext("2d"); x.drawImage(im, 0, 0); tex = { w: im.width, h: im.height, d: x.getImageData(0, 0, im.width, im.height).data }; }
      const nameOf = (v) => { let bi = 0, bw = -1; for (let k = 0; k < 4; k++) if (wt[v * 4 + k] > bw) { bw = wt[v * 4 + k]; bi = jn[v * 4 + k]; } return bj.nodes[joints[bi]].name; };
      const zone = new Uint8Array(nv), shade = new Float32Array(nv), lum = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b, sums = [0, 0, 0, 0, 0], cnt = [0, 0, 0, 0, 0], base = new Float32Array(nv);
      for (let v = 0; v < nv; v++) {
        let r = 0.7, g = 0.6, b = 0.5; if (tex) { const tx = Math.min(tex.w - 1, Math.max(0, Math.floor(uv[v * 2] * tex.w))), ty = Math.min(tex.h - 1, Math.max(0, Math.floor(uv[v * 2 + 1] * tex.h))), o = (ty * tex.w + tx) * 4; r = tex.d[o] / 255; g = tex.d[o + 1] / 255; b = tex.d[o + 2] / 255; }
        const n = nameOf(v), L = lum(r, g, b); let z = 2;
        if (/Head|Neck/.test(n)) z = L < 0.3 ? 1 : 0; else if (/Hand|Shoulder\b/.test(n) && /Hand/.test(n)) z = 0; else if (/Toes|Foot/.test(n)) z = 4; else if (/Leg|Hips/.test(n)) z = 3; else z = 2;
        zone[v] = z; base[v] = L; sums[z] += L; cnt[z]++;
      }
      for (let v = 0; v < nv; v++) { const m = sums[zone[v]] / Math.max(1, cnt[zone[v]]); shade[v] = Math.max(0.55, Math.min(1.35, base[v] / Math.max(0.05, m))); }
      // animations (par nom d'os)
      const aj = A.j, anims = {};
      aj.animations.forEach((an) => {
        const nm = an.name.replace(/^Root\|/, ""), ch = []; let dur = 0;
        an.channels.forEach((c) => {
          const nn = aj.nodes[c.target.node].name, bi = byName[nn]; if (bi === undefined) return;
          const sm = an.samplers[c.sampler], times = A.acc(sm.input), vals = A.acc(sm.output); dur = Math.max(dur, times[times.length - 1]);
          ch.push({ n: bi, p: c.target.path, times, vals, step: sm.interpolation === "STEP" });
        });
        anims[nm] = { ch, dur };
      });
      D = { N, parent, rest, byName, joints, ibm, pos, nrm, jn, wt, idx, nv, zone, shade, anims, nj: joints.length, head: byName["Head"], sp: new Float32Array(nv * 3), sn: new Float32Array(nv * 3), jm: new Float32Array(joints.length * 16), gl: new Float32Array(N * 16), loc: new Float32Array(N * 16), tmp: new Float32Array(16), done: new Uint8Array(N) };
      D.low = bj.nodes.map((n) => /Leg|Foot|Toes|Hips/.test(n.name) && !/Ctrl|IK|Roll/.test(n.name));
      D.tq = new Float32Array(4); D.q1 = new Float32Array(4); D.q2 = new Float32Array(4); D.tv = [0, 0, 0]; D.sv = [1, 1, 1];
      D.cur = rest.map((r) => ({ t: r.t.slice(), q: r.q.slice(), s: r.s.slice() }));
      ready = true; console.log("personnages animés prêts", nv, "points,", Object.keys(anims).join(","));
    } catch (e) { console.warn("personnages animés indisponibles", e); }
  }
  function sample(ch, time, dur) {
    const t = dur > 0 ? time % dur : 0, ts = ch.times, n = ts.length; let i = 0; while (i < n - 2 && ts[i + 1] <= t) i++;
    const t0 = ts[i], t1 = ts[Math.min(n - 1, i + 1)], f = ch.step || t1 === t0 ? 0 : Math.max(0, Math.min(1, (t - t0) / (t1 - t0))), c = ch.p === "rotation" ? 4 : 3, v = ch.vals, d = D.cur[ch.n];
    if (ch.p === "rotation") { for (let k = 0; k < 4; k++) { D.q1[k] = v[i * 4 + k]; D.q2[k] = v[Math.min(n - 1, i + 1) * 4 + k]; } slerp(D.q1, D.q2, f, D.tq); d.q[0] = D.tq[0]; d.q[1] = D.tq[1]; d.q[2] = D.tq[2]; d.q[3] = D.tq[3]; }
    else { const o = ch.p === "translation" ? d.t : d.s, j = Math.min(n - 1, i + 1); for (let k = 0; k < 3; k++) o[k] = v[i * 3 + k] * (1 - f) + v[j * 3 + k] * f; }
  }
  function pose(name, time) {
    const a = D.anims[name]; D.rest.forEach((r, i) => { const c = D.cur[i]; c.t[0] = r.t[0]; c.t[1] = r.t[1]; c.t[2] = r.t[2]; c.q[0] = r.q[0]; c.q[1] = r.q[1]; c.q[2] = r.q[2]; c.q[3] = r.q[3]; c.s[0] = r.s[0]; c.s[1] = r.s[1]; c.s[2] = r.s[2]; });
    if (a) a.ch.forEach((c) => sample(c, time, a.dur));
    if (name === "Idle") D.rest.forEach((r, i) => { if (D.low[i]) { const c = D.cur[i]; c.t[0] = r.t[0]; c.t[1] = r.t[1]; c.t[2] = r.t[2]; c.q[0] = r.q[0]; c.q[1] = r.q[1]; c.q[2] = r.q[2]; c.q[3] = r.q[3]; } });   // l'animation "idle" du pack a les jambes en pleine foulée : on garde les jambes droites
    D.done.fill(0);
    const glob = (i) => { if (D.done[i]) return; D.done[i] = 1; const c = D.cur[i], L = trs(c.t, c.q, c.s, D.loc.subarray(i * 16, i * 16 + 16)), p = D.parent[i], G = D.gl.subarray(i * 16, i * 16 + 16); if (p < 0) G.set(L); else { glob(p); mmul(D.gl.subarray(p * 16, p * 16 + 16), L, G); } };
    for (let k = 0; k < D.nj; k++) { const ni = D.joints[k]; glob(ni); mmul(D.gl.subarray(ni * 16, ni * 16 + 16), D.ibm.subarray(k * 16, k * 16 + 16), D.jm.subarray(k * 16, k * 16 + 16)); }
    // points + normales transformés par les os
    const { pos, nrm, jn, wt, sp, sn, jm } = D;
    for (let v = 0; v < D.nv; v++) {
      const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2], nx = nrm[v * 3], ny = nrm[v * 3 + 1], nz = nrm[v * 3 + 2]; let ax = 0, ay = 0, az = 0, bx = 0, by = 0, bz = 0;
      for (let k = 0; k < 4; k++) { const w = wt[v * 4 + k]; if (w <= 0) continue; const o = jn[v * 4 + k] * 16;
        ax += w * (jm[o] * x + jm[o + 4] * y + jm[o + 8] * z + jm[o + 12]); ay += w * (jm[o + 1] * x + jm[o + 5] * y + jm[o + 9] * z + jm[o + 13]); az += w * (jm[o + 2] * x + jm[o + 6] * y + jm[o + 10] * z + jm[o + 14]);
        bx += w * (jm[o] * nx + jm[o + 4] * ny + jm[o + 8] * nz); by += w * (jm[o + 1] * nx + jm[o + 5] * ny + jm[o + 9] * nz); bz += w * (jm[o + 2] * nx + jm[o + 6] * ny + jm[o + 10] * nz); }
      sp[v * 3] = ax; sp[v * 3 + 1] = ay; sp[v * 3 + 2] = az; sn[v * 3] = bx; sn[v * 3 + 1] = by; sn[v * 3 + 2] = bz;
    }
  }
  const col = [0, 0, 0], zc = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0.9, 0.9, 0.9]];
  // dessine un personnage : M = position/direction, s = taille, o = couleurs (peau, cheveux, haut, pantalon)
  function draw(B, M, s, anim, time, o) {
    if (!ready) return false;
    pose(anim, time);
    const c = [o.skin, o.hair || [0.1, 0.08, 0.07], o.shirt, o.pants || [0.15, 0.2, 0.3], [0.92, 0.92, 0.92]], { sp, sn, idx, zone, shade } = D, S = s;
    for (let t = 0; t < idx.length; t++) {
      const v = idx[t], x = sp[v * 3] * S, y = sp[v * 3 + 1] * S, z = sp[v * 3 + 2] * S, a = sn[v * 3], b = sn[v * 3 + 1], d = sn[v * 3 + 2], k = c[zone[v]], sh = shade[v];
      col[0] = Math.min(1, k[0] * sh); col[1] = Math.min(1, k[1] * sh); col[2] = Math.min(1, k[2] * sh);
      B.v(M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14], M[0] * a + M[4] * b + M[8] * d, M[1] * a + M[5] * b + M[9] * d, M[2] * a + M[6] * b + M[10] * d, col, 1, 0);
    }
    return true;
  }
  return { load, draw, isReady: () => ready, data: () => D };
})();
