// St. GNG School Attendance — Service Worker
const CACHE_NAME = 'stgng-attendance-v1';

// All static files to pre-cache
const STATIC_FILES = [
    '/',
    '/index.html',
    '/login.html',
    '/app.js',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png',
    '/school-building.jpg',
    '/camera-screen.html',
    '/dashboard.html',
    '/attendance-history.html',
    '/profile.html',
    '/status-screen.html',
    '/admin-dashboard.html',
    '/admin-profile.html',
    '/admin-settings.html',
    '/attendance-monitoring.html',
    '/teacher-management.html',
];

// ── Install: pre-cache static files ──
self.addEventListener('install', event => {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            // Cache what we can — ignore errors for missing files
            return Promise.allSettled(
                STATIC_FILES.map(url => cache.add(url).catch(() => { }))
            );
        }).then(() => self.skipWaiting())
    );
});

// ── Activate: clean old caches ──
self.addEventListener('activate', event => {
    console.log('[SW] Activating...');
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

// ── Fetch: Stale-While-Revalidate for UI Speed ──
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Skip non-GET, API calls, and cross-origin requests
    if (event.request.method !== 'GET') return;
    if (url.pathname.startsWith('/api/')) return;
    if (url.pathname.startsWith('/attendance/')) return;
    if (!url.origin.includes(self.location.origin)) return;

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            const fetchPromise = fetch(event.request).then(networkResponse => {
                // Update the cache with the fresh fetched version
                if (networkResponse.ok) {
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, networkResponse.clone());
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Offline fallback — return cached version if no network response
                if (!cachedResponse && event.request.headers.get('Accept')?.includes('text/html')) {
                    // Fallback to login page for HTML requests when fully offline & un-cached
                    return caches.match('/index.html');
                }
            });

            // INSTANT SPEED trick: Return cached immediately if available, while fetching in background!
            return cachedResponse || fetchPromise;
        })
    );
});
