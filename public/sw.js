self.addEventListener('push', (event) => {
  let dados = {};

  try {
    dados = event.data
      ? event.data.json()
      : {};
  } catch {
    dados = {};
  }

  const titulo =
    dados.title || 'Jeito de Mãe';

  const opcoes = {
    body:
      dados.body ||
      'Você recebeu uma nova notificação.',

    icon: '/icon-192.png',
    badge: '/icon-192.png',

    data: {
      url: dados.url || '/admin',
      pedidoId: dados.pedidoId || null,
    },

    tag:
      dados.tag ||
      `jeito-de-mae-${Date.now()}`,

    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(
      titulo,
      opcoes
    )
  );
});

self.addEventListener(
  'notificationclick',
  (event) => {
    event.notification.close();

    const destino =
      event.notification.data?.url ||
      '/admin';

    event.waitUntil(
      clients
        .matchAll({
          type: 'window',
          includeUncontrolled: true,
        })
        .then((janelas) => {
          for (const janela of janelas) {
            try {
              const url =
                new URL(janela.url);

              if (
                url.origin ===
                self.location.origin
              ) {
                if (
                  'navigate' in janela &&
                  !url.pathname.startsWith(
                    '/admin'
                  )
                ) {
                  return janela
                    .navigate(destino)
                    .then(() =>
                      janela.focus()
                    );
                }

                return janela.focus();
              }
            } catch {}
          }

          return clients.openWindow(
            destino
          );
        })
    );
  }
);
