/**
 * Aviso de pedido novo pela WhatsApp Cloud API (API OFICIAL da Meta).
 *
 * Por que nao usar whatsapp-web.js / Baileys / bot em celular:
 * essas bibliotecas se passam pelo WhatsApp Web e violam os termos de
 * uso. Contas que fazem disso costumam ser banidas, e um ban leva junto
 * o numero comercial da familia. A Cloud API e gratuita ate um limite
 * generoso de conversas por mes e nao corre esse risco.
 *
 * Como a mensagem parte do sistema (e nao e resposta a um cliente),
 * ela precisa ser um TEMPLATE aprovado na Meta. Veja o README.
 */
export async function avisarPedidoNovo(pedido) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const destino = process.env.WHATSAPP_DESTINO;
  const template = process.env.WHATSAPP_TEMPLATE || 'novo_pedido';

  if (!token || !phoneId || !destino) {
    console.warn('[whatsapp] variaveis nao configuradas - aviso ignorado');
    return { enviado: false, motivo: 'nao_configurado' };
  }

  const resumo = (pedido.itens || [])
    .map((i) => `${i.qtd}x ${i.nome} (${i.opcao})`)
    .join(', ')
    .slice(0, 900);

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: destino,
        type: 'template',
        template: {
          name: template,
          language: { code: 'pt_BR' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: pedido.codigo },
                { type: 'text', text: pedido.cliente_nome },
                { type: 'text', text: resumo || 'sem itens' },
                { type: 'text', text: 'R$ ' + Number(pedido.total).toFixed(2).replace('.', ',') },
              ],
            },
          ],
        },
      }),
    });

    if (!res.ok) {
      const erro = await res.text();
      console.error('[whatsapp] falha:', erro);
      return { enviado: false, motivo: 'erro_api' };
    }
    return { enviado: true };
  } catch (e) {
    console.error('[whatsapp] excecao:', e);
    return { enviado: false, motivo: 'excecao' };
  }
}
