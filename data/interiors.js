// L'INTÉRIEUR DES BÂTIMENTS. Pièce de 480 x 520. Le mur du fond fait 96 de haut.
// act : sleep, tv, eat, projects, shop, job (avec jobs:[...]). Sans act = simple décor.
const ROOM = { w: 480, h: 520, wallH: 96 };
function interiorFor(b) {
  const it = [];
  if (b.kind === "home") {
    it.push({ k: "bed", x: 28, y: 112, w: 120, h: 150, act: "sleep", label: "🛏️ Dormir" });
    it.push({ k: "tv", x: 290, y: 104, w: 160, h: 56, act: "tv", label: "📺 Télé" });
    it.push({ k: "plant", x: 176, y: 112, w: 36, h: 50 });
    it.push({ k: "rug", x: 170, y: 200, w: 150, h: 110, walk: true });
    it.push({ k: "sofa", x: 300, y: 215, w: 150, h: 64 });
    it.push({ k: "fridge", x: 28, y: 300, w: 72, h: 112, act: "eat", label: "🍚 Frigo" });
    it.push({ k: "table", x: 190, y: 350, w: 110, h: 70 });
    it.push({ k: "desk", x: 350, y: 350, w: 100, h: 70, act: "projects", label: "📓 Projets" });
    return { floor: "#d9c29c", items: it };
  }
  if (b.kind === "shop") {
    [30, 175, 320].forEach((x) => it.push({ k: "shelf", x, y: 104, w: 130, h: 62 }));
    it.push({ k: "counter", x: 110, y: 270, w: 260, h: 60, act: "shop", label: "🛒 Acheter", keeper: true });
    it.push({ k: "crate", x: 30, y: 380, w: 70, h: 60 }); it.push({ k: "crate", x: 390, y: 380, w: 60, h: 60 });
    return { floor: "#e7dfcd", items: it };
  }
  const jobs = b.jobs || [];
  const spots = jobs.length === 1 ? [[190, 250]] : [[100, 250], [280, 250], [190, 370]];
  jobs.forEach((id, i) => it.push({ k: "station", x: spots[i][0], y: spots[i][1], w: 100, h: 66, act: "job", jobs: [id], label: "💼 " + (JOBS.find((j) => j.id === id) || {}).name, style: b.id }));
  if (b.id === "usine") { it.push({ k: "machine", x: 40, y: 108, w: 120, h: 70 }); it.push({ k: "machine", x: 300, y: 108, w: 130, h: 70 }); }
  else if (b.id === "bureau") { [30, 130, 330].forEach((x) => it.push({ k: "cabinet", x, y: 106, w: 60, h: 70 })); }
  else if (b.id === "garage") { it.push({ k: "car", x: 40, y: 380, w: 150, h: 70 }); it.push({ k: "machine", x: 330, y: 108, w: 100, h: 60 }); }
  else if (b.id === "poisson") { it.push({ k: "fishtable", x: 30, y: 110, w: 150, h: 60 }); it.push({ k: "fishtable", x: 300, y: 110, w: 150, h: 60 }); }
  else { it.push({ k: "crate", x: 30, y: 110, w: 70, h: 60 }); it.push({ k: "crate", x: 380, y: 110, w: 70, h: 60 }); }
  return { floor: b.id === "bureau" ? "#cfd6e0" : "#d3d0c6", items: it };
}