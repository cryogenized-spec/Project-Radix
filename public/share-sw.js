self.addEventListener('fetch', (event) => {
  if (event.request.method === 'POST' && event.request.url.includes('/share-target')) {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        const image = formData.get('image');
        const title = formData.get('title') || '';
        const text = formData.get('text') || '';
        const url = formData.get('url') || '';

        if (!image) {
          return Response.redirect('/?share_error=no_image', 303);
        }

        // Store the shared file in IndexedDB
        const db = await new Promise((resolve, reject) => {
          const request = indexedDB.open('SharedImagesDB', 1);
          request.onupgradeneeded = (e) => {
            e.target.result.createObjectStore('shared', { keyPath: 'id' });
          };
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });

        const id = Date.now().toString();
        await new Promise((resolve, reject) => {
          const tx = db.transaction('shared', 'readwrite');
          const store = tx.objectStore('shared');
          store.put({ id, image, title, text, url, timestamp: Date.now() });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });

        // Redirect to the app with the shared ID
        return Response.redirect(`/?shared_id=${id}`, 303);
      } catch (err) {
        console.error('Share target error:', err);
        return Response.redirect('/?share_error=1', 303);
      }
    })());
  }
});
