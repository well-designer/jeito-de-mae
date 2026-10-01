self.addEventListener('push', (event) => {
  let dados = {};

  try {
    dados = event.data ? event.data.json() : {};
  } catch {
    dados = {};
  }

  const titulo = dados.title || 'Jeito de Mãe';

  const opcoes = {
    body: dados.body || 'Você recebeu uma nova notificação.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: {
      url: dados.url || '/admin',
    },
    tag: dados.tag || 'jeito-de-mae',
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(titulo, opcoes)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url =
    event.notification.data?.url || '/admin';

  event.waitUntil(
    clients.openWindow(url)
  );
});
