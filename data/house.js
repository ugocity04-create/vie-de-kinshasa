// MEUBLES À ACHETER POUR DÉCORER SA MAISON. w/h = taille au sol dans la pièce (480 x 520).
const HCAT = [
  { k: "bed", name: "Lit", emoji: "🛏️", price: 0, w: 120, h: 150, act: "sleep", label: "🛏️ Dormir", start: [28, 112] },
  { k: "tv", name: "Télé", emoji: "📺", price: 0, w: 160, h: 56, act: "tv", label: "📺 Télé", start: [290, 104] },
  { k: "fridge", name: "Frigo", emoji: "🧊", price: 0, w: 72, h: 112, act: "eat", label: "🍚 Frigo", start: [28, 300] },
  { k: "table", name: "Table", emoji: "🍽️", price: 0, w: 110, h: 70, start: [190, 350] },
  { k: "desk", name: "Bureau", emoji: "📓", price: 6000, w: 100, h: 70, act: "projects", label: "📓 Projets", start: [350, 350] },
  { k: "plant", name: "Plante", emoji: "🪴", price: 500, w: 36, h: 50 },
  { k: "chair", name: "Chaise", emoji: "🪑", price: 800, w: 40, h: 40 },
  { k: "lamp", name: "Lampe", emoji: "💡", price: 1200, w: 30, h: 30 },
  { k: "radio", name: "Radio", emoji: "📻", price: 1500, w: 44, h: 30 },
  { k: "pouf", name: "Pouf", emoji: "🟤", price: 1800, w: 44, h: 44 },
  { k: "rug", name: "Tapis", emoji: "🟥", price: 3000, w: 150, h: 110, walk: true },
  { k: "shelf", name: "Étagère", emoji: "📚", price: 4000, w: 110, h: 56 },
  { k: "stove", name: "Cuisinière", emoji: "🍳", price: 8000, w: 70, h: 70 },
  { k: "sofa", name: "Canapé", emoji: "🛋️", price: 12000, w: 150, h: 64 },
  { k: "wardrobe", name: "Armoire", emoji: "🚪", price: 15000, w: 90, h: 60 },
  { k: "aquarium", name: "Aquarium", emoji: "🐠", price: 25000, w: 90, h: 50 },
  { k: "piano", name: "Piano", emoji: "🎹", price: 80000, w: 130, h: 70 }
];
const HSTYLES = {
  floor: [["#d9c29c", "Beige"], ["#c9a77a", "Bois"], ["#8d6e63", "Bois foncé"], ["#cfd8dc", "Carrelage"], ["#a5d6a7", "Vert"], ["#90caf9", "Bleu"]],
  wall: [["#e9d8b4", "Crème"], ["#f8bbd0", "Rose"], ["#bbdefb", "Bleu ciel"], ["#c8e6c9", "Menthe"], ["#fff59d", "Jaune"], ["#b39ddb", "Violet"]]
};
