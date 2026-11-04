// MOTEUR 3D MAISON (WebGL, sans bibliothèque) : tout est fait de blocs colorés, comme un jeu "low-poly".
// Ce fichier dessine la ville, les gens, les voitures, les ponts et l'intérieur des bâtiments.
const R3D = (function () {
  "use strict";
  const U = 20; // 20 pixels de la carte = 1 unité 3D
  let gl, prog, L = {}, cv, ov, oc, W = 1, H = 1, dpr = 1, vp = new Float32Array(16), cam = [0, 0, 0];
  let staticBuf, staticN = 0, dynBuf, trBuf, built = false;
  const out = { yaw: 0, zoom: 1 };

  // ---------- matrices (column-major) ----------
  const pool = []; let pi = 0;
  const m = () => pool[pi++] || (pool[pi - 1] = new Float32Array(16));
  const ident = (o) => { o.fill(0); o[0] = o[5] = o[10] = o[15] = 1; return o; };
  function mul(a, b) { const o = m(); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; }
  const T = (x, y, z) => { const o = ident(m()); o[12] = x; o[13] = y; o[14] = z; return o; };
  const RY = (a) => { const o = ident(m()), c = Math.cos(a), s = Math.sin(a); o[0] = c; o[2] = -s; o[8] = s; o[10] = c; return o; };
  const RX = (a) => { const o = ident(m()), c = Math.cos(a), s = Math.sin(a); o[5] = c; o[6] = s; o[9] = -s; o[10] = c; return o; };
  const RZ = (a) => { const o = ident(m()), c = Math.cos(a), s = Math.sin(a); o[0] = c; o[1] = s; o[4] = -s; o[5] = c; return o; };
  const ID = ident(new Float32Array(16));
  function persp(fov, asp, n, f) { const o = new Float32Array(16), t = 1 / Math.tan(fov / 2); o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); return o; }
  function lookAt(e, c, u) {
    let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2], l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    let xx = u[1] * zz - u[2] * zy, xy = u[2] * zx - u[0] * zz, xz = u[0] * zy - u[1] * zx; l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx, o = new Float32Array(16);
    o[0] = xx; o[1] = yx; o[2] = zx; o[4] = xy; o[5] = yy; o[6] = zy; o[8] = xz; o[9] = yz; o[10] = zz;
    o[12] = -(xx * e[0] + xy * e[1] + xz * e[2]); o[13] = -(yx * e[0] + yy * e[1] + yz * e[2]); o[14] = -(zx * e[0] + zy * e[1] + zz * e[2]); o[15] = 1; return o;
  }
  function mulN(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; }

  // ---------- couleurs ----------
  const cc = {};
  function C(h) {
    if (Array.isArray(h)) return h;
    if (typeof h === "string") h = parseInt(h.replace("#", ""), 16);
    return cc[h] || (cc[h] = [(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255]);
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

  // ---------- lot de formes ----------
  const FACES = [
    [[0, 0, 1], [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]], [[0, 0, -1], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]],
    [[1, 0, 0], [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]]], [[-1, 0, 0], [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]]],
    [[0, 1, 0], [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]]], [[0, -1, 0], [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]]]
  ];
  class Batch {
    constructor(cap) { this.d = new Float32Array(cap * 11); this.n = 0; this.tmp = ident(new Float32Array(16)); }
    clear() { this.n = 0; }
    v(x, y, z, nx, ny, nz, c, a, e) {
      if ((this.n + 1) * 11 > this.d.length) { const nd = new Float32Array(this.d.length * 2); nd.set(this.d); this.d = nd; }
      const d = this.d, i = this.n++ * 11; d[i] = x; d[i + 1] = y; d[i + 2] = z; d[i + 3] = nx; d[i + 4] = ny; d[i + 5] = nz; d[i + 6] = c[0]; d[i + 7] = c[1]; d[i + 8] = c[2]; d[i + 9] = a; d[i + 10] = e;
    }
    // un bloc (sx, sy, sz = dimensions) placé par la matrice M
    box(M, sx, sy, sz, col, e, a) {
      col = C(col); a = a === undefined ? 1 : a; e = e || 0;
      const hx = sx / 2, hy = sy / 2, hz = sz / 2;
      for (let f = 0; f < 6; f++) {
        const n = FACES[f][0], q = FACES[f][1];
        const nx = M[0] * n[0] + M[4] * n[1] + M[8] * n[2], ny = M[1] * n[0] + M[5] * n[1] + M[9] * n[2], nz = M[2] * n[0] + M[6] * n[1] + M[10] * n[2];
        const P = q.map((c) => { const x = c[0] * hx, y = c[1] * hy, z = c[2] * hz; return [M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]]; });
        [0, 1, 2, 0, 2, 3].forEach((k) => this.v(P[k][0], P[k][1], P[k][2], nx, ny, nz, col, a, e));
      }
    }
    // un bloc simple (sans rotation) : centre x,y,z
    at(x, y, z, sx, sy, sz, col, e, a) { const M = this.tmp; M[12] = x; M[13] = y; M[14] = z; this.box(M, sx, sy, sz, col, e, a); }
    // rectangle posé à plat
    flat(x, y, z, w, d, col, a, e) {
      col = C(col); a = a === undefined ? 1 : a; e = e || 0; const hw = w / 2, hd = d / 2;
      [[-hw, hd], [hw, hd], [hw, -hd], [-hw, hd], [hw, -hd], [-hw, -hd]].forEach((p) => this.v(x + p[0], y, z + p[1], 0, 1, 0, col, a, e));
    }
    // cylindre / cône (axe vertical, centré)
    // un modèle 3D (.glb) mis à l'échelle sx,sy,sz et placé par la matrice M
    model(M, m, sx, sy, sz) {
      const p = m.pos, nr = m.nrm, c = m.col, em = m.em, col = [0, 0, 0];
      for (let i = 0; i < m.n; i++) {
        const x = p[i * 3] * sx, y = p[i * 3 + 1] * sy, z = p[i * 3 + 2] * sz, a = nr[i * 3], b = nr[i * 3 + 1], d = nr[i * 3 + 2];
        col[0] = c[i * 3]; col[1] = c[i * 3 + 1]; col[2] = c[i * 3 + 2];
        this.v(M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14], M[0] * a + M[4] * b + M[8] * d, M[1] * a + M[5] * b + M[9] * d, M[2] * a + M[6] * b + M[10] * d, col, 1, em[i]);
      }
    }
    prism(M, n, rT, rB, h, col, e, a) {
      col = C(col); a = a === undefined ? 1 : a; e = e || 0; const hh = h / 2;
      const P = (x, y, z) => [M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]];
      const N = (x, y, z) => [M[0] * x + M[4] * y + M[8] * z, M[1] * x + M[5] * y + M[9] * z, M[2] * x + M[6] * y + M[10] * z];
      for (let i = 0; i < n; i++) {
        const a0 = i / n * 6.2832, a1 = (i + 1) / n * 6.2832, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
        const p0 = P(c0 * rB, -hh, s0 * rB), p1 = P(c1 * rB, -hh, s1 * rB), p2 = P(c1 * rT, hh, s1 * rT), p3 = P(c0 * rT, hh, s0 * rT), n0 = N(c0, 0, s0), n1 = N(c1, 0, s1);
        this.v(...p0, ...n0, col, a, e); this.v(...p1, ...n1, col, a, e); this.v(...p2, ...n1, col, a, e);
        this.v(...p0, ...n0, col, a, e); this.v(...p2, ...n1, col, a, e); this.v(...p3, ...n0, col, a, e);
        const nu = N(0, 1, 0), nd = N(0, -1, 0), ct = P(0, hh, 0), cb = P(0, -hh, 0);
        if (rT > 0) { this.v(...ct, ...nu, col, a, e); this.v(...p3, ...nu, col, a, e); this.v(...p2, ...nu, col, a, e); }
        if (rB > 0) { this.v(...cb, ...nd, col, a, e); this.v(...p1, ...nd, col, a, e); this.v(...p0, ...nd, col, a, e); }
      }
    }
    // ellipsoïde
    sphere(M, rx, ry, rz, col, e, a, seg, rings) {
      col = C(col); a = a === undefined ? 1 : a; e = e || 0; seg = seg || 8; rings = rings || 5;
      const pt = (i, j) => { const th = i / seg * 6.2832, ph = j / rings * Math.PI, sx = Math.sin(ph) * Math.cos(th), sy = Math.cos(ph), sz = Math.sin(ph) * Math.sin(th);
        let nx = sx / rx, ny = sy / ry, nz = sz / rz; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l; const x = sx * rx, y = sy * ry, z = sz * rz;
        return [M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14], M[0] * nx + M[4] * ny + M[8] * nz, M[1] * nx + M[5] * ny + M[9] * nz, M[2] * nx + M[6] * ny + M[10] * nz]; };
      for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) {
        const A = pt(i, j), B = pt(i + 1, j), Cc = pt(i + 1, j + 1), D = pt(i, j + 1);
        [A, Cc, B, A, D, Cc].forEach((p) => this.v(p[0], p[1], p[2], p[3], p[4], p[5], col, a, e));
      }
    }
  }
  const SB = new Batch(40000), DB = new Batch(30000), TB = new Batch(8000);

  // ---------- initialisation WebGL ----------
  const VS = "attribute vec3 aP;attribute vec3 aN;attribute vec4 aC;attribute float aE;uniform mat4 uVP;uniform vec3 uCam;varying vec3 vN;varying vec4 vC;varying float vE;varying float vD;void main(){vN=aN;vC=aC;vE=aE;vD=distance(aP,uCam);gl_Position=uVP*vec4(aP,1.0);}";
  const FS = "precision mediump float;varying vec3 vN;varying vec4 vC;varying float vE;varying float vD;uniform vec3 uSunDir;uniform vec3 uSunCol;uniform vec3 uAmb;uniform vec3 uGnd;uniform vec3 uFog;uniform float uFogN;uniform float uFogF;uniform float uEmis;void main(){vec3 n=normalize(vN);float d=max(dot(n,uSunDir),0.0);float up=n.y*0.5+0.5;vec3 amb=mix(uGnd,uAmb,up);float rim=pow(1.0-abs(n.y),3.0)*0.06;vec3 lit=vC.rgb*(amb+uSunCol*d)+vec3(rim);vec3 col=mix(lit,vec3(1.0,0.86,0.5),vE*uEmis);float f=clamp((vD-uFogN)/(uFogF-uFogN),0.0,1.0);gl_FragColor=vec4(mix(col,uFog,f),vC.a);}";
  function sh(t, s) { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; }
  function init(canvas, overlay) {
    cv = canvas; ov = overlay; oc = ov.getContext("2d");
    gl = cv.getContext("webgl", { antialias: true, alpha: false }) || cv.getContext("experimental-webgl");
    cv.addEventListener("webglcontextlost", (e) => { e.preventDefault(); lost = true; });
    cv.addEventListener("webglcontextrestored", () => { location.reload(); });
    if (!gl) throw new Error("WebGL indisponible");
    prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    ["aP", "aN", "aC", "aE"].forEach((n) => L[n] = gl.getAttribLocation(prog, n));
    ["uVP", "uCam", "uSunDir", "uSunCol", "uAmb", "uGnd", "uFog", "uFogN", "uFogF", "uEmis"].forEach((n) => L[n] = gl.getUniformLocation(prog, n));
    staticBuf = gl.createBuffer(); dynBuf = gl.createBuffer(); trBuf = gl.createBuffer();
    gl.enable(gl.DEPTH_TEST);
  }
  function resize(w, h, d) { W = w; H = h; dpr = d; cv.width = w * d; cv.height = h * d; ov.width = w * d; ov.height = h * d; if (gl) gl.viewport(0, 0, cv.width, cv.height); }
  function upload(buf, b, usage) { gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, b.d.subarray(0, b.n * 11), usage); }
  function draw(buf, n) {
    if (!n) return; gl.bindBuffer(gl.ARRAY_BUFFER, buf); const S = 44;
    gl.enableVertexAttribArray(L.aP); gl.vertexAttribPointer(L.aP, 3, gl.FLOAT, false, S, 0);
    gl.enableVertexAttribArray(L.aN); gl.vertexAttribPointer(L.aN, 3, gl.FLOAT, false, S, 12);
    gl.enableVertexAttribArray(L.aC); gl.vertexAttribPointer(L.aC, 4, gl.FLOAT, false, S, 24);
    gl.enableVertexAttribArray(L.aE); gl.vertexAttribPointer(L.aE, 1, gl.FLOAT, false, S, 40);
    gl.drawArrays(gl.TRIANGLES, 0, n);
  }

  // ---------- la ville (construite une seule fois) ----------
  let builtZone = "", lost = false;
  function buildStatic() {
    const B = SB; B.clear(); const CZ = G.curZone(); builtZone = CZ.id; const M = 130, IZ = (x, y, m) => G.inZone(x, y, m === undefined ? M : m);
    B.flat((CZ.x + CZ.w / 2) / U, 0.0, (CZ.y + CZ.h / 2) / U, (CZ.w + 2 * M) / U, (CZ.h + 2 * M) / U, 0x3b3e43);
    ROADS.h.forEach((r) => { for (let x = 0; x < WORLD.w; x += 70) if (IZ(x, r.y + 60)) B.flat((x + 18) / U, 0.02, (r.y + r.h / 2) / U, 36 / U, 0.2, 0xe7d65a); });
    ROADS.v.forEach((r) => { for (let y = 0; y < WORLD.h; y += 70) if (IZ(r.x + 60, y)) B.flat((r.x + r.w / 2) / U, 0.02, (y + 18) / U, 0.2, 36 / U, 0xe7d65a); });
    ROADS.h.forEach((a) => ROADS.v.forEach((b) => {
      if (!IZ(b.x + 60, a.y + 60)) return;
      B.flat((b.x + b.w / 2) / U, 0.03, (a.y + a.h / 2) / U, b.w / U, a.h / U, 0x3b3e43);
      for (let i = 0; i < 6; i++) { const x = (b.x + 14 + i * 18) / U; B.flat(x, 0.04, (a.y - 8) / U, 0.5, 0.9, 0xf0f0f0); B.flat(x, 0.04, (a.y + a.h + 8) / U, 0.5, 0.9, 0xf0f0f0); }
      for (let i = 0; i < 6; i++) { const z = (a.y + 14 + i * 18) / U; B.flat((b.x - 8) / U, 0.04, z, 0.9, 0.5, 0xf0f0f0); B.flat((b.x + b.w + 8) / U, 0.04, z, 0.9, 0.5, 0xf0f0f0); }
    }));
    B.flat((CZ.x + CZ.w / 2) / U, -0.03, (CZ.y + CZ.h / 2) / U, 400, 400, 0x7d8a6a);
    if (GLBM.has("com/building-a") && !G.lite()) { const x0 = CZ.x - M - 40, y0 = CZ.y - M - 40, x1 = CZ.x + CZ.w + M + 40, y1 = CZ.y + CZ.h + M + 40; let k = 0;
      for (let row = 0; row < 2; row++) { const o = row * 120; for (let x = x0 - o; x <= x1 + o; x += 130) for (const yy of [y0 - o, y1 + o]) { k++; const key = k % 5 === 0 ? "sub/building-type-" + "abcdefghijklmnopqrstu"[k % 21] : "com/" + (k % 3 === 0 ? "building-skyscraper-" + "abcde"[k % 5] : "low-detail-building-" + LET[k % 14]); placeModel(B, key, x / U, yy / U, 5.5, 5.5, yy < CZ.y ? 0 : Math.PI, k % 3 === 0 ? 0.9 : 1.0, 0.0); }
        for (let y = y0 - o + 130; y < y1 + o; y += 130) for (const xx of [x0 - o, x1 + o]) { k++; const key = "com/low-detail-building-" + LET[k % 14]; placeModel(B, key, xx / U, y / U, 5.5, 5.5, xx < CZ.x ? Math.PI / 2 : -Math.PI / 2, 1.0, 0.0); } } }
    ZONES.filter((z) => z.id === CZ.id).forEach((z) => {
      const cx = (z.x + z.w / 2) / U, cz = (z.y + z.h / 2) / U, w = z.w / U, d = z.h / U;
      B.at(cx, 0.09, cz, w, 0.18, d, 0xd3d3ca); B.at(cx, 0.11, cz, w - 1, 0.2, d - 1, z.ground);
    });
    const SOUTH = CZ.y >= 1260;
    if (SOUTH) B.flat((RIVER.x + RIVER.w / 2) / U, 0.1, (RIVER.y + RIVER.h / 2) / U, RIVER.w / U, RIVER.h / U, 0x2a7fb0);
    if (CZ.id === "fleuve") B.flat((WATER.x + WATER.w / 2) / U, 0.215, (WATER.y + WATER.h / 2) / U, WATER.w / U, WATER.h / U, 0x2a7fb0);
    if (CZ.id === "fleuve") B.at((WATER.x + WATER.w / 2) / U, 0.2, WATER.y / U - 0.3, WATER.w / U, 0.25, 0.6, 0x8d6e4a);
    BUILDINGS.forEach((b) => { if (b.needs || b.kind === "stall" || !IZ(b.x + b.w / 2, b.y + b.h / 2, 0) ) return; building(B, b); });
    BUILDINGS.forEach((b) => { if (b.kind === "stall" && IZ(b.x, b.y, 0)) stall(B, b); });
    G.trees.forEach((t, ti) => { if (!IZ(t.x, t.y)) return; const x = t.x / U, z = t.y / U, s = t.s; if (ti % 3 === 0) { for (let k = 0; k < 6; k++) B.prism(mul(mul(T(x + Math.sin(k) * 0.12, 0.2 + (k + 0.5) * 0.7 * s, z), RZ(Math.sin(k * 2) * 0.05)), RX(0)), 6, 0.14 * s, 0.17 * s, 0.72 * s, 0x8d6e4a); for (let k = 0; k < 7; k++) { const a = k / 7 * 6.283; B.box(mul(mul(T(x, 0.2 + 4.3 * s, z), RY(a)), mul(T(0.9 * s, -0.15, 0), RZ(-0.35))), 1.8 * s, 0.07, 0.5 * s, k % 2 ? 0x2e7d32 : 0x388e3c); } return; } B.prism(T(x, 0.2 + 0.9 * s, z), 6, 0.16 * s, 0.22 * s, 1.8 * s, 0x6d4c2f); B.sphere(T(x, 0.2 + 2.6 * s, z), 1.25 * s, 1.1 * s, 1.25 * s, 0x2e7d32, 0, 1, 8, 5); B.sphere(T(x - 0.6 * s, 0.2 + 2.0 * s, z + 0.2 * s), 0.8 * s, 0.7 * s, 0.8 * s, 0x388e3c, 0, 1, 7, 4); B.sphere(T(x + 0.6 * s, 0.2 + 2.1 * s, z - 0.2 * s), 0.8 * s, 0.7 * s, 0.8 * s, 0x43a047, 0, 1, 7, 4); });
    G.lamps.forEach((l) => { if (!IZ(l.x, l.y)) return; const h = heightAt(l.x, l.y), x = l.x / U, z = l.y / U; if (GLBM.has("road/light-square")) { const m = GLBM.get("road/light-square"); B.model(T(x, h + 0.2, z), m, 6, 6, 6); } else { B.prism(T(x, h + 1.8, z), 6, 0.06, 0.09, 3.6, 0x37474f); B.at(x, h + 3.7, z, 0.5, 0.18, 0.5, 0xdddddd, 1); } });
    airport(B); bridges(B);
    upload(staticBuf, B, gl.STATIC_DRAW); staticN = B.n; built = true;
  }
  const hsh = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973; return h; };
  const LET = "abcdefghijklmn";
  function pickModel(b) {
    const h = hsh(b.id);
    if (b.kind === "home" || /^(kh|nh|bh|br)/.test(b.id)) return "sub/building-type-" + "abcdefghijklmnopqrstu"[(h % 21)];
    if (b.id === "usine" || b.id === "entrep" || b.id === "port") return "com/low-detail-building-wide-" + (h % 2 ? "a" : "b");
    if (b.h >= 250) return "com/building-skyscraper-" + "abcde"[h % 5];
    return "com/building-" + LET[h % 14];
  }
  function placeModel(B, key, cx, cz, w, d, yaw, hmul, y0) {
    const m = GLBM.get(key); if (!m) return false;
    const mw = m.max[0] - m.min[0], md = m.max[2] - m.min[2], sx = w / mw, sz = d / md, sy = Math.min(sx, sz) * (hmul || 0.9);
    B.model(mul(T(cx, y0 === undefined ? 0.2 : y0, cz), RY(yaw || 0)), m, sx, sy, sz); return true;
  }
  function building(B, b) {
    if (typeof GLBM !== "undefined" && GLBM.has(pickModel(b))) {
      const k = pickModel(b), tall = b.h >= 250; placeModel(B, k, (b.x + b.w / 2) / U, (b.y + b.h / 2) / U, b.w / U, b.h / U, 0, tall ? 1.0 : 0.9);
      B.at((b.x + b.w / 2) / U, 0.12, (b.y + b.h / 2) / U, b.w / U + 1.2, 0.25, b.h / U + 1.2, 0xb9b3a6); return;
    }
    const w = b.w / U, d = b.h / U, cx = (b.x + b.w / 2) / U, cz = (b.y + b.h / 2) / U, tall = b.h >= 250;
    const hgt = tall ? b.h / U * 1.6 : Math.max(3.8, b.h / U * 0.95 + 1), zf = (b.y + b.h) / U;
    B.at(cx, 0.2 + hgt / 2, cz, w, hgt, d, b.wall); B.at(cx, 0.2 + hgt + 0.15, cz, w + 0.5, 0.3, d + 0.5, b.roof);
    const faces = [[0, 1, 0], [Math.PI, -1, 0], [Math.PI / 2, 0, 1], [-Math.PI / 2, 0, -1]];
    faces.forEach((f, fi) => {
      const width = fi < 2 ? w : d, cols = Math.max(2, Math.floor(width / 2.3)), rows = Math.max(1, Math.floor((hgt - 1.2) / 2.8));
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const off = (c + 0.5) * width / cols - width / 2, y = rows === 1 ? hgt * 0.55 + 0.2 : 2.2 + r * 2.8;
        if (fi === 0 && Math.abs(off) < 1.5 && y < 3.4) continue;
        if (y > hgt - 0.6) continue;
        const M = mul(T(cx, 0.2 + y, cz), RY(f[0])); const dist = fi < 2 ? d / 2 : w / 2;
        const W2 = mul(M, T(off * (fi === 1 ? -1 : 1), 0, dist + 0.01));
        B.box(W2, 1.15, 1.35, 0.08, 0xf2eee4); B.box(mul(W2, T(0, 0, 0.03)), 0.95, 1.15, 0.05, 0x9fd0e8, 1); B.box(mul(W2, T(0, 0, 0.06)), 0.04, 1.15, 0.03, 0xf2eee4); B.box(mul(W2, T(0, -0.72, 0.1)), 1.4, 0.1, 0.25, 0xcfc9bd);
      }
    });
    B.at(cx, 0.2 + 1.25, zf + 0.03, 1.7, 2.5, 0.12, 0x2b1d12); B.at(cx + 0.55, 0.2 + 1.2, zf + 0.1, 0.12, 0.12, 0.1, 0xe0c070);
    if (b.kind === "shop" || b.kind === "job") { for (let i = 0; i < 6; i++) B.at(cx - w * 0.3 + (i + 0.5) * w * 0.6 / 6, 0.2 + 3.1, zf + 0.7, w * 0.6 / 6, 0.12, 1.5, i % 2 ? 0xffffff : b.roof); }
    B.at(cx, 0.2 + 0.25, zf + 0.35, 2.6, 0.15, 0.7, 0xb0aaa0); B.at(cx, 0.2 + 0.1, zf + 0.7, 3.0, 0.15, 0.7, 0xa09a90);
    B.at(cx, 0.2 + 0.2, cz, w + 0.25, 0.4, d + 0.25, 0x8d8579);
    for (const sx of [-1, 1]) { B.at(cx + sx * (w / 2 + 0.05), 0.2 + hgt / 2, zf + 0.05, 0.3, hgt, 0.3, 0xe8e2d6); }
    if (!tall && b.kind === "deco") { B.prism(T(cx + w * 0.25, 0.2 + hgt + 1.1, cz - d * 0.2), 10, 0.7, 0.7, 1.6, 0x1565c0); B.prism(T(cx + w * 0.25, 0.2 + hgt + 2.0, cz - d * 0.2), 10, 0.0, 0.7, 0.4, 0x0d47a1); }
    if (tall) { for (let r = 1; r < Math.floor(hgt / 2.8); r++) B.at(cx, 0.2 + 2.2 + r * 2.8 - 1.3, zf + 0.35, w * 0.8, 0.12, 0.7, 0xdad5cb); B.at(cx + w / 2 - 0.4, 0.2 + hgt + 2.6, cz, 0.08, 5, 0.08, 0xeeeeee); B.at(cx + w / 2 + 0.3, 0.2 + hgt + 4.2, cz, 1.4, 0.9, 0.05, 0x1e88e5); B.at(cx + w / 2 + 0.3, 0.2 + hgt + 4.2, cz + 0.03, 1.5, 0.16, 0.05, 0xe53935); B.sphere(T(cx + w / 2 + 0.25, 0.2 + hgt + 4.35, cz + 0.04), 0.16, 0.16, 0.03, 0xfdd835, 1, 1, 5, 3); }
    if (b.extra === "factory") { for (let i = 0; i < 2; i++) B.prism(T(cx - w * 0.3 + i * 3.5, 0.2 + hgt + 3, cz - d * 0.2), 8, 0.7, 0.9, 5.4, 0x6d4c41); }
    if (tall || (b.kind === "job" && w > 6)) { B.at(cx + w * 0.25, 0.2 + hgt + 0.9, cz, 1.6, 1.2, 1.6, 0x90a4ae); B.at(cx - w * 0.2, 0.2 + hgt + 0.7, cz + d * 0.2, 1.2, 0.8, 1.2, 0xb0bec5); }
  }
  function stall(B, b) {
    const w = b.w / U, d = b.h / U, cx = (b.x + b.w / 2) / U, cz = (b.y + b.h / 2) / U, cl = b.colors || ["#e53935", "#fff"];
    B.at(cx, 0.2 + 0.5, cz + d * 0.15, w, 1.0, d * 0.55, 0x8d6e4a);
    for (let i = 0; i < 6; i++) B.at(cx - w / 2 + (i + 0.5) * w / 6, 0.2 + 2.3, cz - d * 0.1, w / 6, 0.12, d * 1.1, i % 2 ? cl[1] : cl[0]);
    B.at(cx - w / 2 + 0.1, 0.2 + 1.2, cz + d * 0.4, 0.12, 2.4, 0.12, 0x5d4037); B.at(cx + w / 2 - 0.1, 0.2 + 1.2, cz + d * 0.4, 0.12, 2.4, 0.12, 0x5d4037);
    for (let i = 0; i < 4; i++) B.at(cx - w * 0.33 + i * w * 0.22, 0.2 + 1.2, cz + d * 0.15, 0.5, 0.4, 0.5, [0xe53935, 0xfdd835, 0x43a047, 0xfb8c00][i]);
  }
  function airport(B) {
    const a = AIRPORT, cx = (a.x + a.w / 2) / U;
    B.at(cx, 0.22, (a.y + 445) / U, (a.w - 80) / U, 0.1, 4.5, 0x5d6368);
    for (let x = a.x + 70; x < a.x + a.w - 60; x += 70) B.flat(x / U, 0.3, (a.y + 445) / U, 1.8, 0.25, 0xffffff);
    for (let x = a.x + 14; x < a.x + a.w - 14; x += 40) { B.at(x / U, 0.9, (a.y + 14) / U, 0.15, 1.4, 0.15, 0x888888); B.at(x / U, 0.9, (a.y + a.h - 14) / U, 0.15, 1.4, 0.15, 0x888888); }
    B.at(cx, 0.9, (a.y + 14) / U, a.w / U, 0.08, 0.08, 0x888888); B.at(cx, 0.9, (a.y + a.h - 14) / U, a.w / U, 0.08, 0.08, 0x888888);
    const px = (a.x + 370) / U, pz = (a.y + 300) / U;
    B.prism(mul(T(px, 1.9, pz), RZ(Math.PI / 2)), 10, 0.85, 0.85, 9, 0xf5f5f5); B.sphere(T(px + 4.6, 1.9, pz), 0.95, 0.85, 0.85, 0xf5f5f5); B.at(px, 1.9, pz, 1.8, 0.15, 9, 0xe0e0e0); B.at(px - 4, 3.2, pz, 1.6, 2.2, 0.2, 0x1e88e5);
    B.at(cx - 20, 0.2 + 3.5, (a.y + 120) / U, 3, 7, 3, 0xcfd8dc); B.at(cx - 20, 0.2 + 7.4, (a.y + 120) / U, 4.2, 1.4, 4.2, 0x455a64);
  }
  function bridges(B) {
    if (G.curZone().y >= 1260) BRIDGES.forEach((b) => {
      const cx = (b.x + b.w / 2) / U, w = b.w / U, y0 = BRIDGE_Y[0], y1 = BRIDGE_Y[1], y2 = BRIDGE_Y[2], y3 = BRIDGE_Y[3], step = 40;
      for (let y = y0; y < y3; y += step) {
        const za = y, zb = Math.min(y + step, y3), ha = heightAt(b.x + 5, za), hb = heightAt(b.x + 5, zb);
        const len = Math.hypot((zb - za) / U, hb - ha), ang = Math.atan2(hb - ha, (zb - za) / U), zm = (za + zb) / 2 / U, hm = (ha + hb) / 2;
        B.box(mul(T(cx, hm + 0.1, zm), RX(-ang)), w, 0.4, len + 0.05, 0x44474c);
        if (ha < 0.3 && hb < 0.3) continue;
        for (const s of [-1, 1]) B.box(mul(T(cx + s * (w / 2 - 0.15), hm + 0.7, zm), RX(-ang)), 0.25, 0.9, len + 0.05, 0xb0b5b9);
      }
      for (let y = y0; y < y1; y += step) { const h = heightAt(b.x + 5, y + step / 2); B.at(cx, h / 2 - 0.05, (y + step / 2) / U, w - 0.3, Math.max(0.1, h - 0.3), step / U, 0x8d8d86); }
      for (let y = y2; y < y3; y += step) { const h = heightAt(b.x + 5, y + step / 2); B.at(cx, h / 2 - 0.05, (y + step / 2) / U, w - 0.3, Math.max(0.1, h - 0.3), step / U, 0x8d8d86); }
      B.at(cx, BRIDGE_DECK - 0.5, (y1 + y2) / 2 / U, w, 0.7, (y2 - y1) / U, 0x9e9e98);
      for (const yy of [1850, 1950, 2050]) for (const s of [-1, 1]) B.prism(T(cx + s * (w / 2 - 0.9), (BRIDGE_DECK - 0.5) / 2 + 0.05, yy / U), 8, 0.45, 0.6, BRIDGE_DECK - 0.4, 0x8e8e88);
      for (const yy of [1860, 2040]) for (const s of [-1, 1]) { B.at(cx + s * (w / 2 - 0.2), BRIDGE_DECK + 2.2, yy / U, 0.35, 4.4, 0.35, 0xcfd8dc); B.at(cx + s * (w / 2 - 0.2), BRIDGE_DECK + 4.5, yy / U, 0.5, 0.25, 0.5, 0xffe9a0, 1); }
    });
  }

  // ---------- personnages, voitures, bateaux ----------
  let skinN = 0;
  const RGB = (v) => typeof v === "number" ? [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255] : v;
  function person(B, x, y, z, hd, o) {
    if (!o.sit && typeof SKIN !== "undefined" && SKIN.isReady() && skinN < 40) {
      skinN++;
      const hairs = [[0.1, 0.07, 0.06], [0.16, 0.1, 0.07], [0.05, 0.05, 0.05]], hc = o.hair !== undefined ? RGB(o.hair) : hairs[((o.shirt[0] * 9 + o.shirt[2] * 7) * 10 | 0) % 3];
      if (SKIN.draw(B, mul(T(x, y, z), RY(hd)), 0.5 * (o.s || 1), o.mv ? "Run" : "Idle", (o.ph || 0) * (o.mv ? 0.09 : 0.06), { skin: RGB(o.skin), hair: hc, shirt: RGB(o.shirt), pants: RGB(o.pants || 0x263238) })) return;
    }
    const s = o.s || 1, ph = o.ph || 0, mv = !!o.mv, sit = !!o.sit, talk = !!o.say;
    const amp = mv ? 0.75 : 0.03, bob = mv ? Math.abs(Math.sin(ph)) * 0.05 : Math.sin(ph * 0.12) * 0.012;
    const base = mul(T(x, y + bob * s, z), RY(hd)), turn = mv ? 0 : Math.sin(ph * 0.05) * 0.35 + (talk ? Math.sin(ph * 0.4) * 0.12 : 0), hb = mul(base, RY(turn));
    const skin = o.skin, shirt = o.shirt, pants = o.pants || 0x263238, hair = o.hair || 0x1b1b1b, st = o.style === undefined ? ((o.shirt[0] * 7 + o.shirt[2] * 5) * 10 | 0) % 4 : o.style;
    const dark = [skin[0] * 0.8, skin[1] * 0.75, skin[2] * 0.75], legc = o.f ? skin : pants;
    for (const sd of [-1, 1]) {
      const sw = Math.sin(ph) * sd, fwd = Math.max(0, Math.cos(ph) * sd * -1);       // jambe vers l'avant = lève le genou
      const hipA = sit ? -1.35 : sw * amp, knee = sit ? 1.35 : mv ? Math.max(0, -Math.cos(ph) * sd) * 0.95 + 0.08 : 0.02;
      const P = mul(base, mul(T(sd * 0.12 * s, 0.84 * s, 0), RX(hipA)));
      B.box(mul(P, T(0, -0.2 * s, 0)), 0.2 * s, 0.4 * s, 0.22 * s, legc);
      const K = mul(P, mul(T(0, -0.4 * s, 0), RX(knee)));
      B.box(mul(K, T(0, -0.2 * s, 0)), 0.18 * s, 0.4 * s, 0.2 * s, legc);
      B.box(mul(K, T(0, -0.4 * s, 0.05 * s)), 0.21 * s, 0.1 * s, 0.32 * s, o.f ? 0x8d3b3b : 0xf0f0f0); B.box(mul(K, T(0, -0.46 * s, 0.05 * s)), 0.22 * s, 0.04 * s, 0.33 * s, 0x222222);
      let shA = sit ? -0.9 : -sw * amp * 0.9, elb = sit ? 0.5 : mv ? 0.25 + Math.max(0, -sw) * 0.7 : 0.12 + Math.sin(ph * 0.12 + sd) * 0.04;
      if (talk && sd === 1) { shA = -2.5 + Math.sin(ph * 0.5) * 0.3; elb = 0.5 + Math.sin(ph * 0.5) * 0.4; }     // il salue / parle avec la main
      const A = mul(base, mul(T(sd * 0.33 * s, 1.47 * s, 0), RX(shA)));
      B.box(mul(A, T(0, -0.14 * s, 0)), 0.15 * s, 0.28 * s, 0.17 * s, shirt);
      const E = mul(A, mul(T(0, -0.28 * s, 0), RX(-elb)));
      B.box(mul(E, T(0, -0.15 * s, 0)), 0.12 * s, 0.3 * s, 0.14 * s, skin); B.sphere(mul(E, T(0, -0.33 * s, 0)), 0.07 * s, 0.08 * s, 0.07 * s, skin, 0, 1, 6, 4);
      B.sphere(mul(hb, T(sd * 0.19 * s, 1.7 * s, 0)), 0.04 * s, 0.07 * s, 0.03 * s, dark, 0, 1, 5, 3);
      const blink = Math.sin(ph * 0.31) > 0.985 ? 0.2 : 1;
      B.box(mul(hb, T(sd * 0.075 * s, 1.72 * s, 0.17 * s)), 0.06 * s, 0.045 * s * blink, 0.02 * s, 0xffffff); B.box(mul(hb, T(sd * 0.075 * s, 1.72 * s, 0.185 * s)), 0.03 * s, 0.035 * s * blink, 0.01 * s, 0x111111);
      B.box(mul(hb, T(sd * 0.075 * s, 1.77 * s, 0.17 * s)), 0.08 * s, 0.015 * s, 0.02 * s, 0x1b1b1b);
    }
    const br = mv ? 0 : Math.sin(ph * 0.12) * 0.012;
    B.box(mul(base, T(0, (1.17 + br) * s, 0)), 0.5 * s, 0.6 * s, 0.28 * s, shirt); B.box(mul(base, T(0, 0.9 * s, 0)), 0.51 * s, 0.07 * s, 0.29 * s, o.f ? shirt : 0x3e2723);
    B.box(mul(base, T(0, 1.46 * s, 0.01 * s)), 0.26 * s, 0.06 * s, 0.2 * s, [shirt[0] * 0.8, shirt[1] * 0.8, shirt[2] * 0.8]);
    B.box(mul(hb, T(0, 1.55 * s, 0)), 0.1 * s, 0.1 * s, 0.1 * s, skin);
    B.sphere(mul(hb, T(0, 1.7 * s, 0)), 0.18 * s, 0.2 * s, 0.18 * s, skin, 0, 1, 10, 7);
    B.sphere(mul(hb, T(0, 1.69 * s, 0.17 * s)), 0.035 * s, 0.045 * s, 0.035 * s, dark, 0, 1, 5, 3);
    const mo = talk ? 0.03 + Math.abs(Math.sin(ph * 0.9)) * 0.025 : 0.015;
    B.box(mul(hb, T(0, 1.63 * s, 0.17 * s)), 0.07 * s, mo * s, 0.02 * s, 0x6d2b2b);
    if (st === 0) B.sphere(mul(hb, T(0, 1.78 * s, -0.02 * s)), 0.2 * s, 0.15 * s, 0.2 * s, hair, 0, 1, 8, 4);
    else if (st === 1) B.sphere(mul(hb, T(0, 1.8 * s, -0.01 * s)), 0.25 * s, 0.22 * s, 0.25 * s, hair, 0, 1, 9, 5);
    else if (st === 2) { B.sphere(mul(hb, T(0, 1.76 * s, -0.02 * s)), 0.19 * s, 0.13 * s, 0.19 * s, hair, 0, 1, 8, 4); B.box(mul(hb, T(0, 1.88 * s, -0.02 * s)), 0.14 * s, 0.1 * s, 0.3 * s, hair); }
    else { B.sphere(mul(hb, T(0, 1.8 * s, -0.02 * s)), 0.22 * s, 0.14 * s, 0.22 * s, 0xd32f2f, 0, 1, 8, 4); B.sphere(mul(hb, T(0, 1.88 * s, -0.08 * s)), 0.12 * s, 0.1 * s, 0.12 * s, 0xd32f2f, 0, 1, 6, 3); }
    if (o.f) { B.prism(mul(base, T(0, 0.74 * s, 0)), 10, 0.2 * s, 0.34 * s, 0.6 * s, o.dress || shirt); B.box(mul(hb, T(0, 1.52 * s, -0.15 * s)), 0.34 * s, 0.5 * s, 0.1 * s, hair); }
  }
  const CARS = ["sedan", "taxi", "suv", "van", "hatchback-sports", "delivery", "sedan-sports", "suv-luxury", "truck"];
  function car(B, x, y, z, hd, pitch, type, color, lights) {
    if (type !== "bus" && typeof GLBM !== "undefined") { const k = "car/" + CARS[((color && color[0] * 255 | 0) + (color && color[2] * 255 | 0)) % CARS.length], m = GLBM.get(k); if (m) { B.model(mul(mul(mul(T(x, y + 0.05, z), RY(hd)), RZ(pitch)), RY(Math.PI / 2)), m, 1.15, 1.15, 1.15); return; } }
    const base = mul(mul(T(x, y, z), RY(hd)), RZ(pitch)), bus = type === "bus", L = bus ? 5.6 : 3.3, W = bus ? 1.9 : 1.6;
    if (bus) {
      B.box(mul(base, T(0, 1.0, 0)), L, 1.4, W, color); B.box(mul(base, T(0, 1.78, 0)), L, 0.1, W, 0xf2f2f2); B.box(mul(base, T(0, 1.25, 0)), L - 0.5, 0.5, W + 0.03, 0x233a4f);
    } else {
      B.box(mul(base, T(0, 0.5, 0)), L, 0.4, W, color); B.box(mul(base, T(L * 0.3, 0.8, 0)), L * 0.36, 0.14, W * 0.96, color); B.box(mul(base, T(-L * 0.38, 0.8, 0)), L * 0.22, 0.12, W * 0.96, color);
      B.box(mul(base, T(-0.1, 1.0, 0)), L * 0.46, 0.46, W * 0.92, 0x233a4f); B.box(mul(base, T(-0.1, 1.27, 0)), L * 0.42, 0.07, W * 0.86, color);
      B.box(mul(base, T(L / 2 + 0.03, 0.34, 0)), 0.1, 0.18, W, 0x2b2b2b); B.box(mul(base, T(-L / 2 - 0.03, 0.34, 0)), 0.1, 0.18, W, 0x2b2b2b); for (const sz of [-1, 1]) B.box(mul(base, T(0.55, 0.95, sz * (W / 2 + 0.06))), 0.2, 0.1, 0.1, color);
      if (type === "taxi") B.box(mul(base, T(-0.1, 1.42, 0)), 0.5, 0.18, 0.3, 0xffffff, 1);
    }
    const wr = bus ? 0.42 : 0.33;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const wm = mul(mul(base, T(sx * L * 0.32, wr, sz * W * 0.5)), RX(Math.PI / 2)); B.prism(wm, 12, wr, wr, 0.24, 0x1b1b1b); B.prism(mul(wm, T(0, sz * 0.02, 0)), 8, wr * 0.55, wr * 0.55, 0.26, 0xbfc5c9); }
    for (const sz of [-1, 1]) { B.box(mul(base, T(L / 2 + 0.01, bus ? 0.8 : 0.6, sz * W * 0.32)), 0.06, 0.15, 0.28, 0xfff3c0, 1); B.box(mul(base, T(-L / 2 - 0.01, bus ? 0.8 : 0.6, sz * W * 0.32)), 0.06, 0.15, 0.28, 0xd32f2f, 0.4); }
  }
  function boat(B, x, z, hd, t) {
    const base = mul(T(x, 0.25 + Math.sin(t * 2 + x) * 0.04, z), RY(hd));
    B.box(mul(base, T(0, 0.1, 0)), 3.6, 0.35, 0.9, 0x6d4c2f);
    B.box(mul(mul(base, T(1.9, 0.25, 0)), RZ(0.5)), 0.8, 0.3, 0.8, 0x6d4c2f); B.box(mul(mul(base, T(-1.9, 0.25, 0)), RZ(-0.5)), 0.8, 0.3, 0.8, 0x6d4c2f);
    person(B, x, 0.3, z, hd + Math.PI / 2, { skin: C(0x7b4a2d), shirt: C(0xe53935), sit: true, ph: t });
  }
  function groundY(x, y) {
    const h = heightAt(x, y); if (h > 0 || BRIDGES.some((b) => x > b.x && x < b.x + b.w && y >= BRIDGE_Y[0] && y <= BRIDGE_Y[3])) return h + 0.3;
    if (ROADS.h.some((r) => y > r.y && y < r.y + r.h) || ROADS.v.some((r) => x > r.x && x < r.x + r.w)) return 0.02;
    return 0.2;
  }
  const look = (n) => ({ skin: C(n.skin), shirt: C(n.shirt), pants: C(n.pants || "#263238"), f: n.f, ph: n.t * 8, mv: n.moving !== false, say: !!n.say, hair: C(n.hair || "#1b1b1b") });

  // ---------- caméra et lumière ----------
  let tx = 0, tz = 0, tIn = false;
  function setup(dk, indoors, dt) {
    const S = G.S, asp = W / H;
    let eye, tgt;
    if (indoors) {
      const fov = 0.8, tanV = Math.tan(fov / 2), tanH = tanV * asp, dist = Math.max(14 / tanH, 12.5 / tanV) * 1.04, pit = 1.0;
      tgt = [12, 0, 14.2]; eye = [12, Math.sin(pit) * dist, 14.2 + Math.cos(pit) * dist];
      vp = mulN(persp(fov, asp, 0.5, 200), lookAt(eye, tgt, [0, 1, 0]));
    } else {
      const k = Math.min(1, dt * 9); if (tIn) { tx = S.x / U; tz = S.y / U; } else { tx += (S.x / U - tx) * k; tz += (S.y / U - tz) * k; }
      const gh = groundY(S.x, S.y), pit = 0.9, dist = (asp < 1 ? 31 : 24) * out.zoom, yw = out.yaw;
      tgt = [tx, gh + 1.2, tz]; eye = [tx + Math.sin(yw) * Math.cos(pit) * dist, gh + 1.2 + Math.sin(pit) * dist, tz + Math.cos(yw) * Math.cos(pit) * dist];
      vp = mulN(persp(0.85, asp, 0.5, 400), lookAt(eye, tgt, [0, 1, 0]));
    }
    tIn = indoors; cam = eye;
    const dayS = [0.62, 0.82, 0.95], nightS = [0.04, 0.06, 0.18], dusk = [1.0, 0.62, 0.42];
    let sky = mix(dayS, nightS, dk); const du = Math.max(0, 1 - Math.abs(dk * 2 - 1) * 1.6); sky = mix(sky, dusk, du * 0.45);
    const amb = indoors ? mix([0.78, 0.76, 0.72], [0.5, 0.5, 0.58], dk) : mix([0.6, 0.6, 0.66], [0.38, 0.42, 0.62], dk), sunc = indoors ? [0.35, 0.33, 0.3] : mix([0.78, 0.72, 0.6], [0.26, 0.32, 0.5], dk);
    gl.clearColor(indoors ? 0.09 : sky[0], indoors ? 0.07 : sky[1], indoors ? 0.06 : sky[2], 1);
    gl.useProgram(prog);
    gl.uniformMatrix4fv(L.uVP, false, vp); gl.uniform3fv(L.uCam, eye);
    gl.uniform3f(L.uSunDir, 0.45, 0.8, 0.4); gl.uniform3fv(L.uSunCol, sunc); gl.uniform3fv(L.uAmb, amb); gl.uniform3fv(L.uGnd, [amb[0] * 0.55, amb[1] * 0.52, amb[2] * 0.5]);
    gl.uniform3fv(L.uFog, indoors ? [0.09, 0.07, 0.06] : sky); gl.uniform1f(L.uFogN, indoors ? 400 : 60); gl.uniform1f(L.uFogF, indoors ? 500 : 190);
    gl.uniform1f(L.uEmis, indoors ? 0.7 : Math.max(0, Math.min(1, (dk - 0.25) / 0.5)));
  }
  function proj(x, y, z) {
    const w = vp[3] * x + vp[7] * y + vp[11] * z + vp[15]; if (w <= 0.1) return null;
    return [((vp[0] * x + vp[4] * y + vp[8] * z + vp[12]) / w * 0.5 + 0.5) * W, (1 - ((vp[1] * x + vp[5] * y + vp[9] * z + vp[13]) / w * 0.5 + 0.5)) * H, w];
  }
  function pill(text, x, y, bg, fg, size) {
    oc.font = "bold " + (size || 12) + "px system-ui,sans-serif"; const w = oc.measureText(text).width + 12, h = (size || 12) + 8;
    oc.fillStyle = bg || "rgba(0,0,0,.7)"; oc.beginPath(); oc.roundRect ? oc.roundRect(x - w / 2, y - h / 2, w, h, 7) : oc.rect(x - w / 2, y - h / 2, w, h); oc.fill();
    oc.fillStyle = fg || "#fff"; oc.textAlign = "center"; oc.textBaseline = "middle"; oc.fillText(text, x, y + 0.5);
  }

  // ---------- dessin de la ville (partie qui bouge) ----------
  function drawCity(dk, t) {
    const S = G.S, B = DB, B2 = TB, nearU = (x, z, r) => (x - tx) * (x - tx) + (z - tz) * (z - tz) < r * r, night = Math.max(0, Math.min(1, (dk - 0.25) / 0.5));
    G.npcs.forEach((n) => { const x = n.x / U, z = n.y / U; if (!nearU(x, z, 75) || !G.inZone(n.x, n.y)) return; const y = groundY(n.x, n.y); person(B, x, y, z, n.hd || 0, look(n)); B2.prism(T(x, y + 0.02, z), 8, 0.4, 0.4, 0.01, 0, 0, 0.3); });
    G.cars.forEach((a) => {
      const px = a.axis === "h" ? a.pos : a.lane, py = a.axis === "h" ? a.lane : a.pos, x = px / U, z = py / U; if (!nearU(x, z, 80) || !G.inZone(px, py)) return;
      const y = groundY(px, py), pitch = a.axis === "v" ? Math.atan((heightAt(px, py + a.dir * 20) - heightAt(px, py)) * 1) : 0;
      const hd = a.axis === "h" ? (a.dir > 0 ? 0 : Math.PI) : (a.dir > 0 ? -Math.PI / 2 : Math.PI / 2);
      car(B, x, y, z, hd, pitch, a.type, C(a.col)); B2.prism(T(x, y + 0.02, z), 10, a.type === "bus" ? 2.8 : 1.9, a.type === "bus" ? 2.8 : 1.9, 0.01, 0, 0, 0.25);
      if (night > 0.2 && nearU(x, z, 45)) { const fx = a.axis === "h" ? x + a.dir * 3.4 : x, fz = a.axis === "v" ? z + a.dir * 3.4 : z; B2.prism(T(fx, y + 0.03, fz), 12, 2.4, 2.4, 0.01, 0xfff2b0, 0, 0.16 * night); }
    });
    G.boats.forEach((b) => { if (nearU(b.x / U, b.y / U, 80)) boat(B, b.x / U, b.y / U, b.v > 0 ? 0 : Math.PI, t); });
    // joueur
    const px = S.x / U, pz = S.y / U, py = groundY(S.x, S.y), AV = G.av(), pl = { skin: C(AV.skin), shirt: C(AV.shirt), pants: C(AV.pants), hair: C(AV.hair), ph: t * 11, mv: G.pl.moving, sit: S.moto, f: false };
    if (S.moto) { const base = mul(T(px, py, pz), RY(S.hd || 0)); for (const s of [-1, 1]) B.prism(mul(mul(base, T(0, 0.38, s * 0.6)), RZ(Math.PI / 2)), 10, 0.38, 0.38, 0.2, 0x1b1b1b); B.box(mul(base, T(0, 0.55, 0)), 0.3, 0.3, 1.2, 0xc62828); B.box(mul(base, T(0, 0.85, 0.55)), 0.9, 0.08, 0.1, 0x555555); person(B, px, py + 0.5, pz, S.hd || 0, pl); }
    else person(B, px, py, pz, S.hd || 0, pl);
    B2.prism(T(px, py + 0.02, pz), 8, 0.45, 0.45, 0.01, 0, 0, 0.3);
    // autres joueurs
    if (window.Net) Object.values(Net.players).forEach((p) => { if (p.sc) return; const x = p.x / U, z = p.y / U, y = groundY(p.x, p.y); person(B, x, y, z, p.hd || 0, { skin: C(p.skin || "#a0673a"), shirt: C(p.shirt || "#1e88e5"), pants: C(p.pants || "#263238"), hair: C(p.hair || "#1b1b1b"), ph: t * 9, mv: p.mv, say: !!p.say, f: false }); B2.prism(T(x, y + 0.02, z), 8, 0.4, 0.4, 0.01, 0, 0, 0.3); });
    if (S.kiosk) { const k = BUILDINGS.find((q) => q.id === "kiosk"); stall(B, k); B.at((k.x + k.w / 2) / U, 0.2 + 3.2, (k.y + k.h) / U, 2, 0.5, 0.1, 0xf7c948); }
    // l'eau qui brille
    for (let i = 0; i < 70; i++) { const x = tx - 35 + ((i * 53.7 + t * 1.6) % 70), z = tz - 35 + ((i * 29.3 + i * i * 0.7) % 70), px2 = x * U, pz2 = z * U;
      const inR = pz2 > RIVER.y && pz2 < RIVER.y + RIVER.h && !BRIDGES.some((b) => px2 > b.x - 10 && px2 < b.x + b.w + 10), inW = px2 > WATER.x && px2 < WATER.x + WATER.w && pz2 > WATER.y && pz2 < WATER.y + WATER.h;
      if (inR || inW) B2.flat(x, inW ? 0.23 : 0.13, z, 1.3, 0.1, 0xffffff, 0.35); }
    // fumée de l'usine
    const us = G.curZone().id === "limete" ? BUILDINGS.find((q) => q.id === "usine") : null; if (us) { const ucx = (us.x + us.w / 2) / U;
    if (nearU(ucx, (us.y + us.h) / U, 70)) for (let c = 0; c < 2; c++) for (let k = 0; k < 4; k++) { const f = ((t * 0.5 + k * 0.25) % 1), x = ucx - us.w / U * 0.3 + c * 3.5 + f * 2, y = 0.2 + us.h / U * 0.95 + 1 + 3 + 3 + f * 5, z = (us.y + us.h / 2) / U - us.h / U * 0.2; B2.sphere(T(x, y, z), 0.6 + f * 1.4, 0.5 + f * 1.1, 0.6 + f * 1.4, 0xdddddd, 0, 0.5 * (1 - f), 7, 4); } }
    // lumières de nuit et repères
    if (night > 0.05) G.lamps.forEach((l) => { const x = l.x / U, z = l.y / U; if (!nearU(x, z, 45)) return; const h = groundY(l.x, l.y); B2.prism(T(x, h + 0.05, z), 14, 4.2, 4.2, 0.01, 0xffe9a0, 0, 0.1 * night); B2.prism(T(x, h + 0.06, z), 14, 2.4, 2.4, 0.01, 0xffe9a0, 0, 0.12 * night); });
    if (G.near) { const b = G.near, cx = (b.x + b.w / 2) / U, zf = (b.y + b.h) / U; B.prism(T(cx, 0.2 + 4.4 + Math.sin(t * 6) * 0.25, zf + 0.5), 4, 0.5, 0, 0.8, 0xf7c948, 1); }
  }

  // ---------- intérieurs ----------
  function item3D(B, it, t) {
    const cx = (it.x + it.w / 2) / U, cz = (it.y + it.h / 2) / U, w = it.w / U, d = it.h / U, at = (x, y, z, sx, sy, sz, c, e) => B.at(cx + x, y, cz + z, sx, sy, sz, c, e);
    switch (it.k) {
      case "bed": at(0, 0.3, 0, w, 0.6, d, 0x6d4c2f); at(0, 0.7, 0, w - 0.3, 0.3, d - 0.3, 0x9fc5e8); at(0, 0.95, -d / 2 + 0.7, w * 0.6, 0.2, 0.8, 0xffffff); at(0, 0.9, 0.9, w - 0.35, 0.22, d * 0.6, 0xe57373); at(0, 1.1, -d / 2 + 0.1, w, 1.2, 0.2, 0x5d4037); break;
      case "tv": at(0, 0.45, d * 0.15, w, 0.9, d * 0.7, 0x5d4037); at(0, 1.55, d * 0.1, w * 0.62, 1.0, 0.12, 0x111111); { const h = (t * 40) % 360, c = (0.5 + 0.5 * Math.sin(t * 3)), col = (Math.floor(80 + 80 * c) << 16) | (Math.floor(120 + 60 * Math.sin(t * 2)) << 8) | 200; at(0, 1.55, d * 0.1 + 0.07, w * 0.56, 0.86, 0.04, col, 1); } break;
      case "sofa": at(0, 0.35, 0, w, 0.7, d, 0x8d3b3b); at(0, 0.95, -d / 2 + 0.2, w, 1.0, 0.4, 0xa64a4a); at(-w / 2 + 0.2, 0.7, 0, 0.4, 0.8, d, 0x7a3030); at(w / 2 - 0.2, 0.7, 0, 0.4, 0.8, d, 0x7a3030); break;
      case "fridge": at(0, 1.2, 0, w, 2.4, d, 0xeceff1); at(0, 1.55, d / 2 + 0.02, w - 0.1, 0.05, 0.05, 0x90a4ae); at(w / 2 - 0.4, 1.9, d / 2 + 0.06, 0.1, 0.7, 0.1, 0x78909c); at(w / 2 - 0.4, 0.9, d / 2 + 0.06, 0.1, 0.9, 0.1, 0x78909c); break;
      case "table": at(0, 0.9, 0, w, 0.18, d * 0.8, 0xa1744b); for (const sx of [-1, 1]) for (const sz of [-1, 1]) at(sx * (w / 2 - 0.2), 0.45, sz * (d * 0.4 - 0.2), 0.2, 0.9, 0.2, 0x6d4c2f); at(-w * 0.25, 1.05, 0, 0.7, 0.1, 0.7, 0xffffff); at(w * 0.25, 1.05, 0, 0.7, 0.1, 0.7, 0xffffff); break;
      case "desk": at(0, 0.9, 0, w, 0.18, d * 0.8, 0x8d6e4a); for (const sx of [-1, 1]) at(sx * (w / 2 - 0.2), 0.45, 0, 0.2, 0.9, d * 0.7, 0x6d4c2f); at(-w * 0.15, 1.03, 0, 1.4, 0.06, 1.0, 0xffffff); at(w * 0.3, 1.25, -0.2, 0.3, 0.6, 0.3, 0xfdd835, 1); break;
      case "plant": B.prism(T(cx, 0.45, cz), 8, 0.5, 0.35, 0.9, 0xa1452f); B.sphere(T(cx, 1.5, cz), 0.8, 0.8, 0.8, 0x2e7d32, 0, 1, 8, 5); break;
      case "rug": B.flat(cx, 0.03, cz, w, d, 0xb23a48); B.flat(cx, 0.04, cz, w - 0.7, d - 0.7, 0xe8c07d); B.flat(cx, 0.05, cz, w - 1.4, d - 1.4, 0xb23a48); break;
      case "shelf": at(0, 1.1, 0, w, 2.2, d * 0.6, 0x7b5a3a); for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) at(-w / 2 + 0.6 + i * (w - 1) / 5, 0.6 + r * 0.65, d * 0.32, 0.5, 0.45, 0.2, [0xe53935, 0xfdd835, 0x43a047, 0x1e88e5, 0xfb8c00, 0x8e24aa][(i + r * 2) % 6]); break;
      case "counter": at(0, 0.5, 0, w, 1.0, d, 0x8d6e4a); at(0, 1.05, 0, w + 0.2, 0.12, d + 0.2, 0xc9a26b); at(w / 2 - 1.2, 1.4, -0.2, 0.9, 0.6, 0.7, 0x37474f); at(w / 2 - 1.2, 1.55, 0.2, 0.6, 0.25, 0.04, 0x8bc34a, 1); for (let i = 0; i < 4; i++) at(-w / 2 + 1 + i * 1.2, 1.3, 0.2, 0.7, 0.4, 0.5, [0xe53935, 0xfdd835, 0x43a047, 0x1e88e5][i]);
        if (it.keeper) person(B, cx - 2.5, 0, cz - d / 2 - 0.5, 0, { skin: C(0x7b4a2d), shirt: C(0x8e24aa), pants: C(0x263238), ph: t, mv: false, f: true }); break;
      case "crate": at(0, d > 2 ? 0.7 : 0.6, 0, w, 1.2, d, 0xa1744b); at(0, 1.25, 0, w - 0.2, 0.08, d - 0.2, 0x6d4c2f); break;
      case "station": at(0, 0.5, 0, w, 1.0, d, it.style === "bureau" ? 0x6b7a8f : 0x9e8366); at(-w * 0.25, 1.4, -0.2, 1.3, 0.9, 0.12, 0x263238); at(-w * 0.25, 1.4, -0.13, 1.1, 0.7, 0.04, 0x81d4fa, 1); at(w * 0.25, 1.1, 0.1, 1.0, 0.1, 0.7, 0xfdd835); break;
      case "machine": at(0, 1.1, 0, w, 2.2, d, 0x78909c); at(0, 0.8, d / 2 + 0.02, w - 0.4, 0.5, 0.05, 0x37474f); for (let i = 0; i < 4; i++) at(-w / 2 + 0.7 + i * 0.8, 1.9, d / 2 + 0.05, 0.25, 0.25, 0.1, ((Math.floor(t * 2) + i) % 2) ? 0x66bb6a : 0xef5350, 1); break;
      case "cabinet": at(0, 1.2, 0, w, 2.4, d, 0x90a4ae); for (let i = 0; i < 3; i++) at(0, 0.5 + i * 0.75, d / 2 + 0.02, w - 0.2, 0.6, 0.05, 0x607d8b); break;
      case "car": car(B, cx, 0, cz, 0, 0, "car", C(0xc62828)); break;
      case "fishtable": at(0, 0.9, 0, w, 0.18, d, 0x4f7f8f); for (const sx of [-1, 1]) at(sx * (w / 2 - 0.2), 0.45, 0, 0.2, 0.9, d - 0.3, 0x37474f); for (let i = 0; i < 5; i++) B.sphere(T(cx - w / 2 + 0.8 + i * 1.3, 1.1, cz + (i % 2) * 0.3), 0.5, 0.12, 0.2, 0xcfd8dc, 0, 1, 6, 3); break;
    }
  }
  function drawRoom(dk, t) {
    const b = G.scene, R = G.room, B = DB, ip = G.ip, night = dk > 0.5;
    B.flat(12, 0, 15.4, 26, 22, 0x17120e); B.flat(12, 0.01, 15.4, 24, 21.2, R.floor);
    for (let x = 3; x < 24; x += 3) B.flat(x, 0.02, 15.4, 0.05, 21.2, 0xb8a888, 0.6); for (let z = 6.6; z < 26; z += 3) B.flat(12, 0.02, z, 24, 0.05, 0xb8a888, 0.6);
    B.at(12, 2.4, 4.6, 24, 4.8, 0.4, b.wall); B.at(12, 0.25, 4.85, 24, 0.5, 0.15, 0x8d6e4a);
    for (const wx of [5.2, 18.8]) { B.at(wx, 3.1, 4.82, 4.2, 2.7, 0.1, 0x5d4037); B.at(wx, 3.1, 4.9, 3.8, 2.3, 0.06, night ? 0x16224a : 0xbfe3f5); B.at(wx, 3.1, 4.96, 0.15, 2.3, 0.06, 0x5d4037); if (night) B.at(wx + 0.8, 3.5, 4.96, 0.6, 0.6, 0.04, 0xfff6c0, 1); }
    B.at(-0.2, 1.2, 15.4, 0.4, 2.4, 21.2, b.wall); B.at(24.2, 1.2, 15.4, 0.4, 2.4, 21.2, b.wall);
    B.at(5, 0.5, 26.2, 10, 1, 0.4, b.wall); B.at(19, 0.5, 26.2, 10, 1, 0.4, b.wall); B.flat(12, 0.03, 25.4, 4, 1.4, 0x4a3320); B.at(12, 2.2, 26.4, 4.4, 0.25, 0.3, 0x5d4037);
    R.items.forEach((it) => item3D(B, it, t));
    const px = ip.x / U, pz = ip.y / U;
    person(B, px, 0.02, pz, G.S.hd || 0, { skin: C(G.av().skin), shirt: C(G.av().shirt), pants: C(G.av().pants), hair: C(G.av().hair), ph: t * 11, mv: G.pl.moving });
    TB.prism(T(px, 0.03, pz), 8, 0.45, 0.45, 0.01, 0, 0, 0.3);
    const ni = G.nearItem;
    if (ni && ni !== "door") TB.flat((ni.x + ni.w / 2) / U, 0.07, (ni.y + ni.h / 2) / U, ni.w / U + 1, ni.h / U + 1, 0xf7c948, 0.3 + 0.15 * Math.sin(t * 6));
    if (ni === "door") B.prism(T(12, 1.6 + Math.sin(t * 6) * 0.2, 24.6), 4, 0.5, 0, 0.8, 0xf7c948, 1);
  }

  // ---------- image complète ----------
  function render(dt) {
    if (lost) return;
    if (!built || builtZone !== G.curZone().id) buildStatic();
    pi = 0; skinN = 0; DB.clear(); TB.clear();
    const dk = G.darkness(), t = G.time, indoors = !!G.scene;
    setup(dk, indoors, dt);
    if (indoors) drawRoom(dk, t); else drawCity(dk, t);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.BLEND); gl.depthMask(true);
    if (!indoors) draw(staticBuf, staticN);
    upload(dynBuf, DB, gl.DYNAMIC_DRAW); draw(dynBuf, DB.n);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    upload(trBuf, TB, gl.DYNAMIC_DRAW); draw(trBuf, TB.n);
    gl.depthMask(true); gl.disable(gl.BLEND);
    labels(dk);
  }
  function labels(dk) {
    oc.setTransform(dpr, 0, 0, dpr, 0, 0); oc.clearRect(0, 0, W, H);
    const S = G.S;
    if (G.scene) {
      G.room.items.forEach((it) => { if (!it.act) return; const p = proj((it.x + it.w / 2) / U, 2.9, (it.y + it.h / 2) / U); if (p) pill(it.label || "", p[0], p[1], it === G.nearItem ? "rgba(247,201,72,.95)" : "rgba(0,0,0,.65)", it === G.nearItem ? "#111" : "#fff", 12); });
      const pp = proj(G.ip.x / U, 2.5, G.ip.y / U); if (pp) pill(S.name || "Moi", pp[0], pp[1], "rgba(247,201,72,.9)", "#111", 11);
    } else {
      BUILDINGS.forEach((b) => { if (!b.name || (b.needs && !S[b.needs]) || !G.inZone(b.x + b.w / 2, b.y + b.h / 2, 0)) return; const cx = (b.x + b.w / 2) / U, zf = (b.y + b.h) / U; if ((cx - tx) * (cx - tx) + (zf - tz) * (zf - tz) > 3600) return; const hgt = b.h >= 250 ? 4.4 : 4.6; const p = proj(cx, hgt, zf); if (p) pill((b.emoji ? b.emoji + " " : "") + b.name, p[0], p[1], "rgba(0,0,0,.72)", "#fff", Math.max(10, Math.min(14, 220 / p[2] * 0.9 + 6))); });
      G.npcs.forEach((n) => { if (!n.say) return; const p = proj(n.x / U, groundY(n.x, n.y) + 2.5, n.y / U); if (p) pill(n.say, p[0], p[1], "#fff", "#111", 12); });
      const pp = proj(S.x / U, groundY(S.x, S.y) + 2.5, S.y / U); if (pp) pill(S.name || "Moi", pp[0], pp[1], "rgba(247,201,72,.9)", "#111", 11);
      if (window.Net) Object.values(Net.players).forEach((p) => { if (p.sc) return; const q = proj(p.x / U, groundY(p.x, p.y) + 2.5, p.y / U); if (q) { pill(p.name || "Joueur", q[0], q[1], "rgba(30,136,229,.9)", "#fff", 11); if (p.say) pill(p.say, q[0], q[1] - 22, "#fff", "#111", 12); } });
      const ap = proj((AIRPORT.x + 370) / U, 7, (AIRPORT.y + 300) / U); if (ap && ap[2] < 90) pill("✈ Aéroport : bientôt", ap[0], ap[1], "rgba(0,0,0,.7)", "#f7c948", 13);
      const bp = G.curZone().y >= 1260 ? proj(BRIDGES[0].x / U + 3, 8, 1950 / U) : null; if (bp && bp[2] < 80) pill("🌉 Pont vers Brazzaville", bp[0], bp[1], "rgba(0,0,0,.7)", "#fff", 12);
      if (G.raining > 0) { oc.strokeStyle = "rgba(190,210,255,.55)"; oc.lineWidth = 1.2; oc.beginPath(); for (let i = 0; i < 130; i++) { const x = ((i * 97 + G.time * 220) % (W + 40)) - 20, y = (i * 61 + G.time * 700) % H; oc.moveTo(x, y); oc.lineTo(x - 4, y + 14); } oc.stroke(); }
    }
  }
  return { refresh() { builtZone = ""; }, init, resize, render, yaw: 0, zoom: 1, get out() { return out; }, setYaw(v) { out.yaw = v; }, addYaw(v) { out.yaw += v; }, getYaw() { return out.yaw; }, setZoom(v) { out.zoom = Math.max(0.55, Math.min(2.8, v)); }, getZoom() { return out.zoom; }, stats() { return { staticVerts: staticN, dynVerts: DB.n, trVerts: TB.n }; } };
})();
