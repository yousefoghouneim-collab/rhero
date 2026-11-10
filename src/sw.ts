/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { clientsClaim } from 'workbox-core';

declare let self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
// app shell for every page (works offline)
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

// Web push (daily report / alerts)
self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; url?: string; tag?: string } = {};
  try { data = event.data?.json() ?? {}; } catch { data = { title: 'RHero', body: event.data?.text() }; }
  event.waitUntil(
    self.registration.showNotification(data.title || 'RHero', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/favicon-32.png',
      tag: data.tag,
      data: { url: data.url || '/' },
    }),
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if ('focus' in c) { await (c as WindowClient).focus(); (c as WindowClient).navigate(url).catch(() => undefined); return; }
    }
    await self.clients.openWindow(url);
  })());
});
