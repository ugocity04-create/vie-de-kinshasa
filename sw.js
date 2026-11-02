// Permet de jouer sans internet après la première visite.
const C = "lvk-v7";
const FILES = ["./", "index.html", "styles.css", "game.js", "manifest.json", "data/fr.js", "data/world.js", "data/jobs.js", "data/events.js", "data/shop.js", "data/missions.js", "data/config.js", "audio.js", "net.js", "render3d.js", "phone.js", "data/interiors.js"];
self.addEventListener("install", (e) => e.waitUntil(caches.open(C).then((c) => c.addAll(FILES))));
self.addEventListener("fetch", (e) => e.respondWith(fetch(e.request).catch(() => caches.match(e.request))));
