// Lecteur de modèles 3D .glb (Kenney) : fait maison, sans three.js.
// Les couleurs sont lues dans la palette (colormap.png) et collées sur chaque point du modèle.
const GLBM = (function () {
  const models = {}, texCache = {};
  function loadTex(url) {
    if (!texCache[url]) texCache[url] = new Promise((res) => {
      const im = new Image(); im.onload = () => { const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const x = c.getContext("2d"); x.drawImage(im, 0, 0); res({ w: im.width, h: im.height, d: x.getImageData(0, 0, im.width, im.height).data }); };
      im.onerror = () => res(null); im.src = url;
    });
    return texCache[url];
  }
  function mmul(a, b) { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; }
  function nodeM(n) {
    if (n.matrix) return n.matrix.slice();
    const t = n.translation || [0, 0, 0], q = n.rotation || [0, 0, 0, 1], s = n.scale || [1, 1, 1], x = q[0], y = q[1], z = q[2], w = q[3];
    return [(1 - 2 * (y * y + z * z)) * s[0], 2 * (x * y + z * w) * s[0], 2 * (x * z - y * w) * s[0], 0, 2 * (x * y - z * w) * s[1], (1 - 2 * (x * x + z * z)) * s[1], 2 * (y * z + x * w) * s[1], 0, 2 * (x * z + y * w) * s[2], 2 * (y * z - x * w) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0, t[0], t[1], t[2], 1];
  }
  function parse(buf, tex) {
    const dv = new DataView(buf), jl = dv.getUint32(12, true), j = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jl))), bin = 20 + jl + 8;
    function acc(i) {
      const a = j.accessors[i], bv = j.bufferViews[a.bufferView], nc = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type], cs = a.componentType === 5126 || a.componentType === 5125 ? 4 : 2;
      const stride = bv.byteStride || nc * cs, base = bin + (bv.byteOffset || 0) + (a.byteOffset || 0), out = new Float32Array(a.count * nc);
      for (let k = 0; k < a.count; k++) for (let c = 0; c < nc; c++) { const o = base + k * stride + c * cs; out[k * nc + c] = a.componentType === 5126 ? dv.getFloat32(o, true) : a.componentType === 5125 ? dv.getUint32(o, true) : dv.getUint16(o, true); }
      return out;
    }
    let total = 0;
    const cnt = (ni) => { const n = j.nodes[ni]; if (n.mesh !== undefined) j.meshes[n.mesh].primitives.forEach((pr) => { total += pr.indices !== undefined ? j.accessors[pr.indices].count : j.accessors[pr.attributes.POSITION].count; }); (n.children || []).forEach(cnt); };
    j.scenes[j.scene || 0].nodes.forEach(cnt);
    const P = new Float32Array(total * 3), N = new Float32Array(total * 3), Cc = new Float32Array(total * 3), E = new Float32Array(total); let w = 0;
    function visit(ni, pm) {
      const n = j.nodes[ni], m = mmul(pm, nodeM(n));
      if (n.mesh !== undefined) j.meshes[n.mesh].primitives.forEach((pr) => {
        const pos = acc(pr.attributes.POSITION), nrm = pr.attributes.NORMAL !== undefined ? acc(pr.attributes.NORMAL) : null, uv = pr.attributes.TEXCOORD_0 !== undefined ? acc(pr.attributes.TEXCOORD_0) : null;
        const idx = pr.indices !== undefined ? acc(pr.indices) : Array.from({ length: pos.length / 3 }, (_, i) => i), mat = j.materials && j.materials[pr.material || 0], bcf = mat && mat.pbrMetallicRoughness && mat.pbrMetallicRoughness.baseColorFactor || [1, 1, 1, 1];
        for (let t = 0; t < idx.length; t++) {
          const v = idx[t], x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2], k = w * 3;
          P[k] = m[0] * x + m[4] * y + m[8] * z + m[12]; P[k + 1] = m[1] * x + m[5] * y + m[9] * z + m[13]; P[k + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
          const nx = nrm ? nrm[v * 3] : 0, ny = nrm ? nrm[v * 3 + 1] : 1, nz = nrm ? nrm[v * 3 + 2] : 0, ax = m[0] * nx + m[4] * ny + m[8] * nz, ay = m[1] * nx + m[5] * ny + m[9] * nz, az = m[2] * nx + m[6] * ny + m[10] * nz, l = Math.hypot(ax, ay, az) || 1;
          N[k] = ax / l; N[k + 1] = ay / l; N[k + 2] = az / l;
          let r = bcf[0], g2 = bcf[1], b = bcf[2], em = 0;
          if (tex && uv) { const tx = Math.min(tex.w - 1, Math.max(0, Math.floor(uv[v * 2] * tex.w))), ty = Math.min(tex.h - 1, Math.max(0, Math.floor(uv[v * 2 + 1] * tex.h))), o = (ty * tex.w + tx) * 4; r = tex.d[o] / 255; g2 = tex.d[o + 1] / 255; b = tex.d[o + 2] / 255; if (b > r + 0.12 && b > 0.45 && b >= g2) em = 0.45; }
          Cc[k] = r; Cc[k + 1] = g2; Cc[k + 2] = b; E[w] = em; w++;
        }
      });
      (n.children || []).forEach((c) => visit(c, m));
    }
    const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    (j.scenes[j.scene || 0].nodes).forEach((n) => visit(n, I));
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (let i = 0; i < w * 3; i += 3) for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], P[i + c]); mx[c] = Math.max(mx[c], P[i + c]); }
    return { pos: P, nrm: N, col: Cc, em: E, n: w, min: mn, max: mx };
  }
  async function loadOne(key, dir, file) {
    try { const [r, tex] = await Promise.all([fetch(dir + "/" + file + ".glb"), loadTex(dir + "/Textures/colormap.png")]); models[key] = parse(await r.arrayBuffer(), tex); } catch (e) { console.warn("modèle manquant", key, e); }
  }
  const L = (a, b) => { const o = []; for (let i = a.charCodeAt(0); i <= b.charCodeAt(0); i++) o.push(String.fromCharCode(i)); return o; };
  const LIST = [];
  L("a", "n").forEach((c) => { LIST.push(["com", "building-" + c]); LIST.push(["com", "low-detail-building-" + c]); });
  L("a", "e").forEach((c) => LIST.push(["com", "building-skyscraper-" + c]));
  ["a", "b"].forEach((c) => LIST.push(["com", "low-detail-building-wide-" + c]));
  L("a", "u").forEach((c) => LIST.push(["sub", "building-type-" + c]));
  ["tree-large", "tree-small"].forEach((n) => LIST.push(["sub", n]));
  ["sedan", "taxi", "suv", "van", "hatchback-sports", "delivery", "sedan-sports", "suv-luxury", "truck"].forEach((n) => LIST.push(["car", n]));
  ["light-square", "light-curved"].forEach((n) => LIST.push(["road", n]));
  async function loadAll(base, onProg) { base = base || "models"; let i = 0, done = 0; await Promise.all(Array.from({ length: 3 }, async () => { while (i < LIST.length) { const [d, f] = LIST[i++]; await loadOne(d + "/" + f, base + "/" + d, f); done++; if (onProg) onProg(done, LIST.length); await new Promise((r) => setTimeout(r, 30)); } })); }
  return { models, loadAll, get: (k) => models[k], has: (k) => !!models[k] };
})();
