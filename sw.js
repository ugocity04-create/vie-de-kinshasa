// Permet de jouer sans internet après la première visite.
const C = "lvk-v9";
const FILES = ["./", "index.html", "styles.css", "game.js", "manifest.json", "data/fr.js", "data/world.js", "data/jobs.js", "data/events.js", "data/shop.js", "data/missions.js", "data/config.js", "audio.js", "net.js", "render3d.js", "phone.js", "data/interiors.js"];
self.addEventListener("install", (e) => e.waitUntil(caches.open(C).then((c) => c.addAll(FILES))));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== C).map((k) => caches.delete(k))))));
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  if (u.pathname.includes("/models/")) { e.respondWith(caches.open(C).then((c) => c.match(e.request).then((r) => r || fetch(e.request).then((n) => { if (n.ok) c.put(e.request, n.clone()); return n; })))); return; }
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
