import { db } from './db';

// Base64 to Uint8Array conversion for VAPID key
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications are not supported by this browser.');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Notification permission denied.');
      return null;
    }

    const registration = await navigator.serviceWorker.ready;
    
    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BDQ_jLH36RMyWtb17fz7gYDSXWw5zgw2_5aZ_yZhJHimNQg3JKRJ6w0iy2n-0c8hrLxRQbRn2C3d8O8OHl75Cx8';
      if (!publicVapidKey) {
        throw new Error('VITE_VAPID_PUBLIC_KEY is not set in environment variables.');
      }

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
      });
    }

    // Save to local IndexedDB (settings table)
    await db.settings.put({
      key: 'push_subscription',
      value: JSON.parse(JSON.stringify(subscription))
    });

    console.log('Push subscription saved successfully.');
    return subscription;
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    return null;
  }
}

export async function getSavedPushSubscription() {
  const record = await db.settings.get('push_subscription');
  return record ? record.value : null;
}
