// LA CARTE DE KINSHASA. Tout est en pixels : x = gauche, y = haut, w = largeur, h = hauteur.
const WORLD = { w: 2400, h: 2300 };
const ROADS = { h: [{ y: 600, h: 120 }, { y: 1140, h: 120 }], v: [{ x: 740, w: 120 }, { x: 1540, w: 120 }] };

const ZONES = [
  { id: "binza",    name: "Binza",              x: 0,    y: 0,    w: 740, h: 600, ground: "#86a860" },
  { id: "gombe",    name: "Gombe",              x: 860,  y: 0,    w: 680, h: 600, ground: "#a7aeb0" },
  { id: "aeroport", name: "Aéroport (bientôt)", x: 1660, y: 0,    w: 740, h: 600, ground: "#98a58a" },
  { id: "matete",   name: "Matete",             x: 0,    y: 720,  w: 740, h: 420, ground: "#cdb67f" },
  { id: "marche",   name: "Marché Central",     x: 860,  y: 720,  w: 680, h: 420, ground: "#bda77d" },
  { id: "limete",   name: "Limete",             x: 1660, y: 720,  w: 740, h: 420, ground: "#a8a298" },
  { id: "kintambo", name: "Kintambo",           x: 0,    y: 1260, w: 740, h: 540, ground: "#bfb283" },
  { id: "fleuve",   name: "Fleuve Congo",       x: 860,  y: 1260, w: 680, h: 540, ground: "#d0c493" },
  { id: "ndjili",   name: "N'djili",            x: 1660, y: 1260, w: 740, h: 540, ground: "#c9ad7c" },
  { id: "brazza",   name: "Brazzaville (bientôt)", x: 0,    y: 2100, w: 740, h: 200, ground: "#a9bd8e" },
  { id: "brazza",   name: "Brazzaville (bientôt)", x: 860,  y: 2100, w: 680, h: 200, ground: "#a9bd8e" },
  { id: "brazza",   name: "Brazzaville (bientôt)", x: 1660, y: 2100, w: 740, h: 200, ground: "#a9bd8e" }
];
const WATER = { x: 860, y: 1380, w: 680, h: 420 };
// Le fleuve Congo traverse toute la carte au sud. Deux ponts (sur les routes verticales) mènent à Brazzaville.
const RIVER = { x: 0, y: 1800, w: 2400, h: 300 };
const BRIDGE_DECK = 3;            // hauteur du pont (en unités = 20 px)
const BRIDGES = [{ x: 740, w: 120 }, { x: 1540, w: 120 }];
const BRIDGE_Y = [1600, 1800, 2100, 2300]; // début de la rampe, début du pont, fin du pont, fin de la rampe
function heightAt(x, y) {
  for (const b of BRIDGES) if (x > b.x && x < b.x + b.w) {
    if (y < BRIDGE_Y[0] || y > BRIDGE_Y[3]) return 0;
    if (y < BRIDGE_Y[1]) return BRIDGE_DECK * (y - BRIDGE_Y[0]) / (BRIDGE_Y[1] - BRIDGE_Y[0]);
    if (y <= BRIDGE_Y[2]) return BRIDGE_DECK;
    return BRIDGE_DECK * (BRIDGE_Y[3] - y) / (BRIDGE_Y[3] - BRIDGE_Y[2]);
  }
  return 0;
}
const AIRPORT = { x: 1660, y: 0, w: 740, h: 590 };   // fermé pour l'instant

// kind : home / job / shop / deco / stall / kiosk       jobs : liste d'identifiants de data/jobs.js
const BUILDINGS = [
  // Matete
  { id: "home",   name: "Ma maison",       emoji: "🏠", kind: "home", x: 80,  y: 760, w: 170, h: 130, wall: "#e9d8b4", roof: "#b5533c" },
  { id: "bout1", open: [6, 22],  name: "Boutique",        emoji: "🏪", kind: "shop", x: 300, y: 760, w: 150, h: 120, wall: "#f2c6a0", roof: "#2f6f9f" },
  { id: "lavage", open: [6, 19], name: "Lavage auto",     emoji: "🚗", kind: "job",  jobs: ["lavage"], x: 500, y: 770, w: 170, h: 110, wall: "#c9e0ee", roof: "#3a5a78" },
  { id: "kiosk",  name: "Ton kiosque",     emoji: "🏬", kind: "kiosk", x: 580, y: 950, w: 100, h: 80, wall: "#f7c948", roof: "#c0392b", needs: "kiosk" },
  // Marché Central
  { id: "recharge", name: "Recharges",     emoji: "📱", kind: "job",  jobs: ["recharge"], x: 900,  y: 760, w: 150, h: 100, wall: "#f6e3a1", roof: "#d35400" },
  { id: "depot",  name: "Dépôt",           emoji: "📦", kind: "job",  jobs: ["porteur"], x: 1100, y: 760, w: 170, h: 110, wall: "#d7c3a0", roof: "#6d4c41" },
  { id: "resto", open: [5, 23],  name: "Chez Maman",      emoji: "🍲", kind: "shop", x: 1320, y: 760, w: 170, h: 110, wall: "#f5b7a5", roof: "#8e2c2c" },
  // Gombe
  { id: "banque", open: [8, 16], name: "Banque",          emoji: "🏦", kind: "job", jobs: ["caissier"], x: 900,  y: 40,  w: 160, h: 260, wall: "#cfd8dc", roof: "#455a64" },
  { id: "bureau", open: [8, 17], name: "Bureau",          emoji: "🏢", kind: "job",  jobs: ["bureau"], x: 1100, y: 60,  w: 200, h: 300, wall: "#b0c4de", roof: "#34495e" },
  { id: "hotel", open: [0, 24], name: "Hôtel",           emoji: "🏨", kind: "job", jobs: ["reception"], x: 1340, y: 30,  w: 160, h: 250, wall: "#e6d5c3", roof: "#7b3f2e" },
  { id: "cireur", name: "Coin du cireur",  emoji: "👞", kind: "job",  jobs: ["cireur"], x: 1000, y: 420, w: 100, h: 80, wall: "#d9b38c", roof: "#5d4037" },
  // Limete
  { id: "usine", open: [6, 20],  name: "Usine",           emoji: "🏭", kind: "job",  jobs: ["usine"], x: 1760, y: 740, w: 340, h: 180, wall: "#9aa5ad", roof: "#546e7a", extra: "factory" },
  { id: "entrep", open: [6, 18], name: "Entrepôt",        emoji: "🏗️", kind: "job", jobs: ["stock"], x: 2150, y: 780, w: 200, h: 130, wall: "#b8a98c", roof: "#6d6048" },
  // Kintambo
  { id: "poisson", open: [5, 18],name: "Marché au poisson", emoji: "🐟", kind: "job", jobs: ["poisson"], x: 100, y: 1320, w: 220, h: 120, wall: "#cfe7f0", roof: "#1f6f8b" },
  { id: "kh1",    name: "",                emoji: "", kind: "deco", x: 380, y: 1330, w: 150, h: 110, wall: "#e8c9a0", roof: "#a1452f" },
  { id: "kh2",    name: "",                emoji: "", kind: "deco", x: 560, y: 1340, w: 140, h: 100, wall: "#d6e0b8", roof: "#6b8e23" },
  // N'djili
  { id: "mnd",    name: "Marché N'djili",  emoji: "🥬", kind: "job",  jobs: ["legumes"], x: 1720, y: 1320, w: 220, h: 120, wall: "#d9efc4", roof: "#2e7d32" },
  { id: "garage", open: [7, 19], name: "Garage",          emoji: "🔧", kind: "job",  jobs: ["meca"], x: 1990, y: 1320, w: 200, h: 130, wall: "#cfd3d6", roof: "#b71c1c" },
  { id: "bout2", open: [6, 22],  name: "Boutique",        emoji: "🏪", kind: "shop", x: 2240, y: 1320, w: 130, h: 120, wall: "#f2d1a8", roof: "#283593" },
  { id: "nh1",    name: "",                emoji: "", kind: "deco", x: 1740, y: 1560, w: 140, h: 110, wall: "#e9d1b0", roof: "#8d4b2b" },
  { id: "nh2",    name: "",                emoji: "", kind: "deco", x: 2000, y: 1570, w: 150, h: 110, wall: "#c8d8e8", roof: "#455a64" },
  { id: "nh3",    name: "",                emoji: "", kind: "deco", x: 2230, y: 1560, w: 130, h: 120, wall: "#e8d6b8", roof: "#9c3d2a" },
  { id: "pharma", open: [8, 21], name: "Pharmacie", emoji: "💊", kind: "shop", x: 880, y: 400, w: 110, h: 110, wall: "#e3f2e1", roof: "#2e7d32" },
  { id: "cafe", open: [6, 23], name: "Café Gombe", emoji: "☕", kind: "shop", x: 1180, y: 430, w: 150, h: 110, wall: "#f0d9c0", roof: "#6d4c41" },
  { id: "minist", name: "Ministère", emoji: "🏛️", kind: "deco", x: 1370, y: 380, w: 130, h: 140, wall: "#e0dccf", roof: "#37474f" },
  { id: "salon", open: [7, 20], name: "Salon de coiffure", emoji: "✂️", kind: "job", jobs: ["coiffeur"], x: 80, y: 330, w: 150, h: 110, wall: "#f3d1e0", roof: "#ad1457" },
  { id: "bout3", open: [6, 22], name: "Boutique", emoji: "🏪", kind: "shop", x: 300, y: 330, w: 150, h: 110, wall: "#f2c6a0", roof: "#00695c" },
  { id: "eglise", name: "Église", emoji: "⛪", kind: "deco", x: 520, y: 320, w: 150, h: 160, wall: "#f4f1e8", roof: "#5d4037" },
  { id: "cyber", open: [7, 21], name: "Cybercafé", emoji: "💻", kind: "job", jobs: ["cyber"], x: 300, y: 950, w: 170, h: 110, wall: "#d7e3f4", roof: "#283593" },
  { id: "port", open: [5, 19], name: "Port de Kintambo", emoji: "⚓", kind: "job", jobs: ["docker"], x: 100, y: 1540, w: 220, h: 120, wall: "#cfd8dc", roof: "#0d47a1" },
  { id: "boulang", open: [5, 20], name: "Boulangerie", emoji: "🥖", kind: "job", jobs: ["boulanger"], x: 380, y: 1540, w: 150, h: 110, wall: "#f6dfb5", roof: "#bf360c" },
  { id: "station", open: [6, 22], name: "Station-service", emoji: "⛽", kind: "job", jobs: ["pompiste"], x: 1760, y: 960, w: 180, h: 100, wall: "#eceff1", roof: "#c62828" },
  { id: "super", open: [8, 21], name: "Supermarché", emoji: "🛒", kind: "shop", x: 2000, y: 960, w: 170, h: 110, wall: "#e8f5e9", roof: "#1565c0" },
  // Binza (quartier résidentiel)
  { id: "bh1",    name: "",                emoji: "", kind: "deco", x: 60,  y: 60,  w: 130, h: 110, wall: "#efdcb8", roof: "#b5533c" },
  { id: "bh2",    name: "",                emoji: "", kind: "deco", x: 260, y: 80,  w: 140, h: 120, wall: "#cfe0cf", roof: "#3d6b4f" },
  { id: "bh3",    name: "",                emoji: "", kind: "deco", x: 470, y: 50,  w: 140, h: 130, wall: "#e6c9c0", roof: "#7a3b3b" }
];
// Brazzaville, de l'autre côté du fleuve (décor pour l'instant)
[[80, 2140], [300, 2150], [520, 2140], [900, 2150], [1150, 2140], [1380, 2150], [1700, 2140], [1950, 2150], [2200, 2140]].forEach((p, i) =>
  BUILDINGS.push({ id: "br" + i, name: "", emoji: "", kind: "deco", x: p[0], y: p[1], w: 120 + (i % 3) * 20, h: 100, wall: ["#f0e0c0", "#d9e6d0", "#e8cfc0"][i % 3], roof: ["#a1452f", "#3d6b4f", "#455a64"][i % 3] }));
// Petits stands décoratifs au marché
for (let i = 0; i < 6; i++) BUILDINGS.push({ id: "st" + i, name: "", kind: "stall", x: 900 + i * 100, y: 930, w: 80, h: 56, colors: [["#e53935", "#fff"], ["#1e88e5", "#fff"], ["#fdd835", "#e53935"], ["#43a047", "#fff"], ["#8e24aa", "#fff"], ["#fb8c00", "#fff"]][i] });

// Zones libres où les passants se promènent
const PLAZAS = [
  { x: 60, y: 910, w: 470, h: 210, n: 4 }, { x: 900, y: 1010, w: 600, h: 110, n: 8 },
  { x: 880, y: 500, w: 620, h: 85, n: 3 }, { x: 1120, y: 385, w: 380, h: 100, n: 3 },
  { x: 1680, y: 990, w: 700, h: 130, n: 3 }, { x: 30, y: 1470, w: 700, h: 190, n: 4 },
  { x: 1680, y: 1470, w: 700, h: 80, n: 5 }, { x: 30, y: 300, w: 700, h: 270, n: 3 },
  { x: 880, y: 1285, w: 640, h: 80, n: 3 }
];