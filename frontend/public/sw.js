
self.addEventListener('push', (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: 'ProjectHealth AI',
      body: 'You have a new notification.'
    };
  }

  const title = data.title || 'ProjectHealth AI';

  const options = {
    body: data.body || 'You have a new project update.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'projecthealth-notification',
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const destination = new URL(
    event.notification.data?.url || '/',
    self.location.origin
  );

  if (destination.origin !== self.location.origin) {
    return;
  }

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(async (windowClients) => {
      for (const client of windowClients) {
        if (client.url === destination.href && 'focus' in client) {
          return client.focus();
        }
      }

      return clients.openWindow(destination.href);
    })
  );
});
