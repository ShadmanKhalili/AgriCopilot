/*
 * Phone notifications, added to the app's service worker with
 * importScripts('push-sw.js') (see vite.config.ts).
 *
 * The server sends an encrypted JSON message: { title, body, url, tag }.
 * Anything unreadable still shows a plain notification, so a push is never
 * silently dropped (browsers expect every push to show something).
 */

self.addEventListener('push', function (event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = {};
  }
  if (!data || typeof data !== 'object') data = {};

  var title = typeof data.title === 'string' && data.title ? data.title.slice(0, 120) : 'AgriCopilot';
  var body = typeof data.body === 'string' ? data.body.slice(0, 300) : '';
  var url = typeof data.url === 'string' && data.url.charAt(0) === '/' ? data.url : '/';
  var options = {
    body: body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: { url: url },
  };
  if (typeof data.tag === 'string' && data.tag) {
    options.tag = data.tag.slice(0, 100);
    options.renotify = true;
  }
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var path = (event.notification.data && event.notification.data.url) || '/';
  var target = new URL(path, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windows) {
      for (var i = 0; i < windows.length; i++) {
        var client = windows[i];
        if (client.url.indexOf(self.location.origin) === 0 && 'focus' in client) {
          return client.focus().then(function (focused) {
            var win = focused || client;
            if ('navigate' in win) {
              return win.navigate(target).catch(function () {});
            }
          });
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
