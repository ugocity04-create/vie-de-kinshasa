// FILTRE DE GROS MOTS : remplace les mots interdits par des étoiles (côté joueur ET côté serveur).
const Filter = (function () {
  "use strict";
  const BAD = ["merde", "putain", "pute", "salope", "connard", "connasse", "encule", "enculer", "nique", "niquer", "ntm", "fdp", "batard", "bordel", "salaud", "trouduc", "couille", "couilles",
    "fuck", "fucking", "fucker", "shit", "bitch", "asshole", "dick", "pussy", "cunt", "bastard", "slut", "whore", "nigger", "nigga", "faggot", "ashawo", "oloshi", "olodo"];
  const set = new Set(BAD);
  const norm = (w) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e").replace(/4|@/g, "a").replace(/5|\$/g, "s").replace(/7/g, "t").replace(/(.)\1+/g, "$1");
  const setN = new Set(BAD.map(norm));
  function clean(text) { return String(text || "").replace(/[^\s]+/g, (tok) => { const core = tok.replace(/^[^A-Za-z0-9À-ÿ@$]+|[^A-Za-z0-9À-ÿ@$]+$/g, ""); const n = norm(core); return core && (setN.has(n) || set.has(core.toLowerCase())) ? tok.replace(core, "*".repeat(core.length)) : tok; }); }
  return { clean };
})();
