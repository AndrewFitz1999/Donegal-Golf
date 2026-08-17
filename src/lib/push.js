const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

// iOS Safari only implements Web Push for sites added to the Home Screen —
// a normal browser tab silently has no PushManager/Notification support
// there, which pushSupported() already catches. This just tells the UI
// whether to show "add to Home Screen first" instead of a generic
// "unsupported" message on iOS specifically.
export function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null)
  return navigator.serviceWorker.register('/sw.js')
}

export async function getPushSubscription() {
  if (!pushSupported()) return null
  const registration = await navigator.serviceWorker.ready
  return registration.pushManager.getSubscription()
}

export async function subscribeToPush() {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notification permission denied')

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  })
  return subscription
}

export async function unsubscribeFromPush(subscription) {
  await subscription.unsubscribe()
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}
