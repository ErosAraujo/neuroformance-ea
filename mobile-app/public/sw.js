self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Hora de registrar seu sono.';
  const body = data.body || 'Registre como foi sua noite para atualizar sua prontidão de treino.';
  event.waitUntil(self.registration.showNotification(title, { body, icon: '/icon.png', badge: '/icon.png' }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow('/'));
});
