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

    const retirada =
      pedido.tipo === 'retirada';

    const tipo =
      retirada
        ? '🏪 Retirada'
        : '🛵 Entrega';

    const valor = Number(
      pedido.total || 0
    ).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

    const pagamentoBruto =
      String(pedido.pagamento || '')
        .toLowerCase();

    const pagamento =
      pagamentoBruto === 'pix'
        ? 'Pix'
        : pagamentoBruto === 'dinheiro'
          ? 'Dinheiro'
          : pagamentoBruto === 'cartao'
            ? 'Cartão'
            : pagamentoBruto === 'cartão'
              ? 'Cartão'
              : pedido.pagamento || 'Pagamento';

    const cliente =
      pedido.cliente_nome ||
      'Cliente';

    const codigo =
      pedido.codigo ||
      'Novo pedido';

    const payload = JSON.stringify({
      title: `🔔 NOVO PEDIDO — ${codigo}`,

      body:
        `${tipo} • ${cliente}\n` +
        `💰 ${valor} • ${pagamento}`,

      url: '/admin',

      tag: `pedido-${pedido.id}`,

      pedidoId: pedido.id,
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

          // Se a assinatura deixou de existir,
          // remove automaticamente do banco.
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

export async function enviarPushTeste() {
  try {
    configurarWebPush();

    const sb = supabaseAdmin();

    const { data: inscricoes, error } =
      await sb
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth');

    if (error) {
      throw error;
    }

    if (!inscricoes?.length) {
      throw new Error(
        'Nenhum aparelho cadastrado para notificacoes'
      );
    }

    const payload = JSON.stringify({
      title: '🔔 Teste Jeito de Mãe',

      body:
        'As notificações de novos pedidos estão funcionando!',

      url: '/admin',

      tag: `teste-${Date.now()}`,
    });

    const resultados =
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

            return true;
          } catch (erro) {
            if (
              erro?.statusCode === 404 ||
              erro?.statusCode === 410
            ) {
              await sb
                .from('push_subscriptions')
                .delete()
                .eq('id', item.id);
            }

            throw erro;
          }
        })
      );

    const enviados =
      resultados.filter(
        (resultado) =>
          resultado.status === 'fulfilled'
      ).length;

    if (enviados === 0) {
      throw new Error(
        'Nao foi possivel enviar a notificacao'
      );
    }

    return {
      ok: true,
      enviados,
    };
  } catch (erro) {
    console.error(
      '[push] teste:',
      erro
    );

    throw erro;
  }
}
