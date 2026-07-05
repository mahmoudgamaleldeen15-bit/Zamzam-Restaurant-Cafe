importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
// ============================================================
// ZAMZAM RESTAURANT — Service Worker v2.0
// Offline Cache + Push Notifications
// ============================================================

const CACHE_NAME = 'zamzam-cache-v3';

// ====== INSTALL ======
self.addEventListener('install', e => {
  console.log('[SW] Installing v2...');
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(['/', '/index.html']).catch(() => {});
    })
  );
  self.skipWaiting();
});

// ====== ACTIVATE ======
self.addEventListener('activate', e => {
  console.log('[SW] Activating...');
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ====== FETCH — Offline Support ======
self.addEventListener('fetch', e => {
  if (
    e.request.url.includes('firebaseio.com') ||
    e.request.url.includes('googleapis.com') ||
    e.request.url.includes('cloudinary.com') ||
    e.request.url.includes('fcm.googleapis.com') ||
    e.request.method !== 'GET'
  ) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (e.request.mode === 'navigate' || e.request.url.endsWith('.html')) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() => {
        return caches.match(e.request).then(cached => {
          if (cached) return cached;
          if (e.request.mode === 'navigate') {
            return caches.match('/') || caches.match('/index.html');
          }
        });
      })
  );
});

// ====== PUSH — إشعارات ======
self.addEventListener('push', e => {
  console.log('[SW] Push received');
  let data = {};
  try { data = e.data?.json() || {}; } catch { data = { title: '🔔 إشعار جديد', body: e.data?.text() || '' }; }

  const title = data.title || data.notification?.title || '🔔 زمزم';
  const body  = data.body  || data.notification?.body  || '';
  const icon  = 'https://res.cloudinary.com/dk3xw0x5v/image/upload/v1778698476/Gemini_Generated_Image_1%D8%BA%D8%BAix4ur1ix4ur1ix4_x2fzvd_zgujcf.png';
  const tag   = data.tag || 'zamzam-push-' + Date.now();
  const url   = data.url || '/';

  e.waitUntil(
    self.registration.showNotification(title, {
      body, icon, badge: icon, tag,
      requireInteraction: true,
      vibrate: [400, 100, 400, 100, 600],
      data: { url, orderId: data.orderId, type: data.type },
      actions: data.type === 'new_order' ? [
        { action: 'open',    title: '📋 فتح الطلب' },
        { action: 'dismiss', title: '✕ إغلاق' }
      ] : [
        { action: 'open', title: '📋 فتح التطبيق' }
      ]
    })
  );
});

// ====== NOTIFICATION CLICK ======
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const { url, orderId, type } = e.notification.data || {};
  if (e.action === 'dismiss') return;
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.postMessage({ type: 'NOTIFICATION_CLICK', orderId, notifType: type });
          return;
        }
      }
      return clients.openWindow(
  (url && url.startsWith('http')) 
    ? url 
    : 'https://mahmoudgamaleldeen15-bit.github.io/Zamzam-Restaurant-Cafe/'
);
    })
  );
});

// ====== MESSAGE ======
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data?.type === 'SHOW_NOTIFICATION') {
    const { title, body, icon, tag, data: notifData } = e.data.payload || {};
    self.registration.showNotification(title || '🔔 زمزم', {
      body: body || '',
      icon: icon || 'https://res.cloudinary.com/dk3xw0x5v/image/upload/v1778698476/Gemini_Generated_Image_1%D8%BA%D8%BAix4ur1ix4ur1ix4_x2fzvd_zgujcf.png',
      tag: tag || 'zamzam-sw-' + Date.now(),
      requireInteraction: true,
      vibrate: [400, 100, 400],
      data: notifData || {}
    });
  }
});

console.log('[SW] Zamzam Service Worker v2 loaded ✅');
