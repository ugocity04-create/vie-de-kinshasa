// Boutique (Matete et Marché Central)
const SHOP = [
  { name: "Beignets",              price: 500,  effect: { food: 15 } },
  { name: "Fufu et poisson",       price: 3000, effect: { food: 50 } },
  { name: "Boisson énergisante",   price: 1500, effect: { energy: 25 } },
  { name: "Médicament",            price: 2500, effect: { health: 25 } }
];
// Projets (à Matete)
const PROJECTS = [
  { id: "kiosk", name: "Ouvrir un kiosque", price: 150000, desc: "Rapporte 8 000 FC chaque nuit." },
  { id: "moto",  name: "Acheter une moto",  price: 400000, desc: "Transport gratuit et deux fois plus rapide." }
];
// Choix de départ : tout le monde ne commence pas pareil !
const PROFILES = [
  { name: "Étudiant sans le sou",   desc: "5 000 FC. Le mode difficile.",                       money: 5000,    rep: 0 },
  { name: "Famille de commerçants", desc: "150 000 FC et un peu de réputation.",                money: 150000,  rep: 3 },
  { name: "Fils de ministre",       desc: "2 000 000 FC. Le jeu devient très facile 😄",        money: 2000000, rep: 10 }
];
const RENT = 14000, RENT_EVERY = 7, KIOSK_INCOME = 8000;