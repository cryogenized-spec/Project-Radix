self.addEventListener('widgetclick', (event) => {
  // Intercept the payload defined in the Adaptive Card
  if (event.action === 'open_vtt') {
    const targetUrl = '/?mode=voice'; // The deep link to trigger VTT

    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        // 1. Check if the PWA is already open
        for (let client of windowClients) {
          if (client.url.includes(self.registration.scope) && 'focus' in client) {
            // Focus the existing window
            client.focus();
            // Send a message to the client to immediately trigger the VTT state
            client.postMessage({ type: 'TRIGGER_VTT' });
            return;
          }
        }
        
        // 2. If not open, launch a new window with the deep link parameter
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
    );
  }
});
