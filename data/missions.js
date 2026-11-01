// OBJECTIFS : le joueur reçoit une récompense pour chaque objectif réussi, dans l'ordre.
// stats : jobs, meals, houses, earned, zones (liste), jobIds (liste)
const MISSIONS = [
  { id: "m1",  text: "Entre dans ta maison",                       reward: 500,   check: (s) => s.stats.houses >= 1 },
  { id: "m2",  text: "Fais ton premier travail",                   reward: 1000,  check: (s) => s.stats.jobs >= 1 },
  { id: "m3",  text: "Mange quelque chose",                        reward: 500,   check: (s) => s.stats.meals >= 1 },
  { id: "m4",  text: "Visite Gombe, le centre-ville",              reward: 1000,  check: (s) => s.stats.zones.includes("Gombe") },
  { id: "m5",  text: "Gagne 20 000 FC en travaillant",             reward: 2000,  check: (s) => s.stats.earned >= 20000 },
  { id: "m6",  text: "Atteins 5 de réputation",                    reward: 2500,  check: (s) => s.rep >= 5 },
  { id: "m7",  text: "Visite N'djili et Kintambo",                 reward: 3000,  check: (s) => s.stats.zones.includes("N'djili") && s.stats.zones.includes("Kintambo") },
  { id: "m8",  text: "Travaille à l'usine de Limete",              reward: 5000,  check: (s) => s.stats.jobIds.includes("usine") },
  { id: "m9",  text: "Obtiens un travail de bureau à Gombe",       reward: 10000, check: (s) => s.stats.jobIds.includes("bureau") },
  { id: "m10", text: "Ouvre ton kiosque (carnet dans ta maison)",  reward: 10000, check: (s) => s.kiosk },
  { id: "m11", text: "Achète une moto",                            reward: 20000, check: (s) => s.moto }
];