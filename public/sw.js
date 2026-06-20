// Service worker do Spark Check-in (#9): cache do "shell" para o Checker
// carregar mesmo offline. NÃO intercepta /api (deixa a fila offline do app
// cuidar dos scans). Estratégia network-first com fallback para cache.
const CACHE = "spark-checker-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api")) return; // scans: tratados pelo app

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches
          .open(CACHE)
          .then((c) => c.put(req, copy))
          .catch(() => {});
        return res;
      })
      .catch(() => caches.match(req)),
  );
});
