// pay = salaire (FC), hours = durée (heures de jeu), energy = énergie perdue, rep = réputation requise
// Le bâtiment qui propose le travail est dans data/world.js (champ "jobs").
const JOBS = [
  { id: "recharge", name: "Vendre des recharges téléphone", pay: 4000,  hours: 2, energy: 15, rep: 0 },
  { id: "porteur",  name: "Porteur au marché",              pay: 6500,  hours: 3, energy: 28, rep: 0 },
  { id: "lavage",   name: "Laver des voitures",             pay: 4500,  hours: 2, energy: 20, rep: 0 },
  { id: "poisson",  name: "Vendre du poisson",              pay: 7500,  hours: 3, energy: 22, rep: 2 },
  { id: "cireur",   name: "Cirer des chaussures",           pay: 5500,  hours: 2, energy: 18, rep: 0 },
  { id: "legumes",  name: "Vendre des légumes",             pay: 5000,  hours: 2, energy: 18, rep: 0 },
  { id: "meca",     name: "Apprenti mécanicien",            pay: 9000,  hours: 3, energy: 25, rep: 3 },
  { id: "usine",    name: "Ouvrier à l'usine",              pay: 13000, hours: 4, energy: 35, rep: 5 },
  { id: "coiffeur", name: "Coiffer des clientes",         pay: 6000,  hours: 2, energy: 15, rep: 0 },
  { id: "cyber",    name: "Gérer le cybercafé",             pay: 5500,  hours: 2, energy: 12, rep: 0 },
  { id: "docker",   name: "Docker au port",                 pay: 8500,  hours: 3, energy: 30, rep: 2 },
  { id: "boulanger",name: "Aide-boulanger",                 pay: 6000,  hours: 2, energy: 20, rep: 1 },
  { id: "pompiste", name: "Pompiste",                       pay: 7000,  hours: 3, energy: 20, rep: 1 },
  { id: "stock",    name: "Magasinier à l'entrepôt",        pay: 9500,  hours: 3, energy: 28, rep: 4 },
  { id: "reception",name: "Réceptionniste d'hôtel",         pay: 15000, hours: 4, energy: 18, rep: 6 },
  { id: "caissier", name: "Caissier à la banque",           pay: 22000, hours: 4, energy: 18, rep: 10 },
  { id: "bureau",   name: "Commis de bureau",               pay: 18000, hours: 4, energy: 20, rep: 12 }
];