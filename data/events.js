// ctx : "any" (partout), "job" (après un travail), "travel" (pendant un trajet)
// effect : money, energy, health, hour, rep (peut être négatif)
const EVENTS = [
  { ctx: "any", text: "Une grosse pluie tombe sur Kinshasa. Tu attends sous un abri.",
    choices: [{ label: "OK", effect: { rain: 45, energy: -5 } }] },
  { ctx: "any", text: "Le courant est coupé (délestage). Tu perds du temps.",
    choices: [{ label: "OK", effect: { hour: 1 } }] },
  { ctx: "any", text: "Tu trouves 2 000 FC par terre. Quelle chance !",
    choices: [{ label: "Les ramasser", effect: { money: 2000 } }] },
  { ctx: "travel", text: "Embouteillages sur le boulevard du 30 Juin ! Tu restes bloqué.",
    choices: [{ label: "OK", effect: { hour: 1, energy: -5 } }] },
  { ctx: "any", text: "Un policier t'arrête et demande « un petit quelque chose ».",
    choices: [
      { label: "Donner 1 000 FC", effect: { money: -1000 }, cost: 1000 },
      { label: "Discuter calmement", effect: { hour: 1, energy: -10 } }
    ] },
  { ctx: "any", text: "Un ami te demande de l'aide : 3 000 FC pour un problème.",
    choices: [
      { label: "Donner 3 000 FC", effect: { money: -3000, rep: 1 }, cost: 3000 },
      { label: "Refuser poliment", effect: {} }
    ] },
  { ctx: "job", text: "Un client content te donne un pourboire de 1 500 FC.",
    choices: [{ label: "Merci !", effect: { money: 1500, rep: 1 } }] }
];