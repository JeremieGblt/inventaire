/**
 * Inventaire — Service Worker
 * -----------------------------
 * Stratégie "réseau d'abord, cache en secours" :
 *   - Si l'appareil est en ligne, on va TOUJOURS chercher la dernière
 *     version des fichiers sur le serveur, et on met le cache à jour au
 *     passage. Ça élimine le problème de version figée après un
 *     déploiement (plus besoin de désinstaller/vider le cache à la main).
 *   - Si l'appareil est hors-ligne, on sert la dernière version connue
 *     depuis le cache, pour que l'appli reste utilisable sans réseau.
 *
 * CACHE_VERSION : change cette valeur si tu modifies un jour la liste de
 * PRECACHE_URLS ci-dessous (nouveaux fichiers ajoutés/retirés) — ça force
 * un nettoyage propre des anciens caches. Pour de simples mises à jour de
 * contenu (CSS/JS édités), pas besoin d'y toucher : la stratégie réseau
 * d'abord s'en charge déjà automatiquement.
 */

const CACHE_VERSION = 'inv-v1';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // active la nouvelle version immédiatement, sans attendre la fermeture des onglets
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch(() => { /* ignore si un fichier manque au premier install */ })
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim()) // prend le contrôle des onglets déjà ouverts
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Ne met en cache que les requêtes vers notre propre site (pas Firebase,
  // Google Apps Script, les polices, etc. — ces services gèrent déjà leur
  // propre fraîcheur, et les mettre en cache ici n'aiderait pas).
  const isSameOrigin = new URL(event.request.url).origin === self.location.origin;
  if (!isSameOrigin){
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, responseClone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
