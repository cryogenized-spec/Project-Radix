self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.body || 'New notification',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: data.data || {}
      };
      event.waitUntil(
        self.registration.showNotification(data.title || 'Project RADIX', options)
      );
    } catch (e) {
      const options = {
        body: event.data.text(),
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png'
      };
      event.waitUntil(
        self.registration.showNotification('Project RADIX', options)
      );
    }
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus();
      }
      return clients.openWindow('/');
    })
  );
});
