self.addEventListener('push', event => {
  const data = event.data.json();
  
  const title = data.title || 'Ponto Eletrônico';
  const options = {
    body: data.body || 'Lembrete de Ponto',
    icon: '/vite.svg',
    badge: '/vite.svg',
    vibrate: [200, 100, 200],
    tag: 'ponto-lembrete',
    renotify: true,
    data: {
      url: data.url || '/',
    },
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});