// ============================================================
// ZAMZAM RESTAURANT — Service Worker v1.0
// Firebase Cloud Messaging + Offline Cache + Background Sync
// ============================================================

const CACHE_NAME = 'zamzam-cache-v2';
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyB1x64GzJFU2yRll59RoGN6yzOBg7WeRS4",
  authDomain: "zamzam-restaurant-cafe.firebaseapp.com",
  databaseURL: "https://zamzam-restaurant-cafe-default-rtdb.firebaseio.com",
  projectId: "zamzam-restaurant-cafe",
  storageBucket: "zamzam-restaurant-cafe.appspot.com",
  messagingSenderId: "669077377507",
  appId: "1:669077377507:web:d308d8bdc3047b719bd0d6"
};

// ====== INSTALL — Cache الأصول الأساسية ======
self.addEventListener('install', e => {
  console.log('[SW] Installing...');
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll([
        '/',
        '/index.html'
      ]).catch(() => {}); // تجاهل لو بعض الملفات مش موجودة
    })
  );
  self.skipWaiting();
});

// ====== ACTIVATE — حذف الـ Cache القديم ======
self.addEventListener('activate', e => {
  console.log('[SW] Activating...');
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ====== FETCH — Offline Support (Network First) ======
self.addEventListener('fetch', e => {
  // تجاهل Firebase requests والـ APIs
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
        // Cache نسخة من الـ HTML الرئيسية
        if (e.request.mode === 'navigate' || e.request.url.endsWith('.html')) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() => {
        // Offline: رجّع من الـ Cache
        return caches.match(e.request).then(cached => {
          if (cached) return cached;
          // لو navigation request وملوقتوش → رجّع الـ index
          if (e.request.mode === 'navigate') {
            return caches.match('/') || caches.match('/index.html');
          }
        });
      })
  );
});

// ====== PUSH — إشعارات من Firebase Cloud Messaging ======
self.addEventListener('push', e => {
  console.log('[SW] Push received:', e.data?.text());
  let data = {};
  try { data = e.data?.json() || {}; } catch { data = { title: '🔔 إشعار جديد', body: e.data?.text() || '' }; }

  const title = data.title || data.notification?.title || '🔔 زمزم — إشعار جديد';
  const body  = data.body  || data.notification?.body  || '';
  const icon  = data.icon  || 'https://res.cloudinary.com/dk3xw0x5v/image/upload/v1778698476/Gemini_Generated_Image_1%D8%BA%D8%BAix4ur1ix4ur1ix4_x2fzvd_zgujcf.png';
  const badge = icon;
  const tag   = data.tag || 'zamzam-push-' + Date.now();
  const url   = data.url || data.click_action || '/';

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      requireInteraction: true,
      vibrate: [400, 100, 400, 100, 600],
      data: { url, orderId: data.orderId, type: data.type },
      actions: data.type === 'new_order' ? [
        { action: 'open',    title: '📋 فتح الطلب' },
        { action: 'dismiss', title: '✕ إغلاق'      }
      ] : [
        { action: 'open', title: '📋 فتح التطبيق' }
      ]
    })
  );
});

// ====== NOTIFICATION CLICK — فتح التطبيق عند الضغط ======
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const { url, orderId, type } = e.notification.data || {};
  const targetUrl = url || '/';

  if (e.action === 'dismiss') return;

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // لو التطبيق مفتوح بالفعل — بعت رسالة ليه
      for (const client of clientList) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.postMessage({ type: 'NOTIFICATION_CLICK', orderId, notifType: type });
          return;
        }
      }
      // لو مش مفتوح — افتحه
      return clients.openWindow(targetUrl + (orderId ? '#order-' + orderId : ''));
    })
  );
});

// ====== MESSAGE — استقبال رسائل من الـ App ======
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();

  // إرسال Push notification داخلي (من نفس الجهاز)
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

console.log('[SW] Zamzam Service Worker loaded ✅');
