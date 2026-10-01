import webpush from 'web-push';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

let configurado = false;

function configurarWebPush() {
  if (configurado) return;

  const publicKey =
    process.env.VAPID_PUBLIC_KEY;

  const privateKey =
    process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    throw new Error(
      'Chaves VAPID nao configuradas'
    );
  }

  webpush.setVapidDetails(
    'mailto:contato@jeitodemae.app',
    publicKey,
    privateKey
  );

  configurado = true;
}

export async function enviarPushNovoPedido(pedido) {
  try {
    configurarWebPush();

    const sb = supabaseAdmin();

    const { data: inscricoes, error } =
      await sb
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth');

    if (error) {
      console.error(
        '[push] erro ao carregar inscricoes:',
        error
      );
      return;
    }

    if (!inscricoes?.length) {
      console.log(
        '[push] nenhum aparelho cadastrado'
      );
      return;
    }

    const tipo =
      pedido.tipo === 'retirada'
        ? 'Retirada'
        : 'Entrega';

    const valor = Number(
      pedido.total || 0
    ).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

    const payload = JSON.stringify({
      title: `🔔 Novo pedido ${pedido.codigo}`,
      body: `${pedido.cliente_nome} · ${tipo} · ${valor}`,
      url: '/admin',
      tag: `pedido-${pedido.id}`,
    });

    await Promise.allSettled(
      inscricoes.map(async (item) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: item.endpoint,
              keys: {
                p256dh: item.p256dh,
                auth: item.auth,
              },
            },
            payload
          );
        } catch (erro) {
          console.error(
            '[push] falha no envio:',
            erro?.statusCode ||
              erro?.message ||
              erro
          );

          // A inscricao nao existe mais.
          // Remove automaticamente do banco.
          if (
            erro?.statusCode === 404 ||
            erro?.statusCode === 410
          ) {
            await sb
              .from('push_subscriptions')
              .delete()
              .eq('id', item.id);
          }
        }
      })
    );
  } catch (erro) {
    // Uma falha na notificacao nunca pode
    // impedir o cliente de fazer o pedido.
    console.error(
      '[push] erro geral:',
      erro
    );
  }
}
