import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

// Handle PWA asset caching
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Include OneSignal SDK in the same service worker so they don't conflict
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js')
