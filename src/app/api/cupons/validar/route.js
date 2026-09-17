import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { soDigitos } from '@/lib/validation';
import { limitar, ipDe } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!limitar(`validar-cupom:${ipDe(request)}`, 20, 60_000)) {
    return NextResponse.json(
      {
        erro: 'Muitas tentativas. Aguarde um minuto e tente novamente.',
      },
      { status: 429 }
    );
  }

  let corpo;

  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json(
      { erro: 'Requisição inválida.' },
      { status: 400 }
    );
  }

  const codigo = String(corpo.codigo || '')
    .trim()
    .toUpperCase();

  const telefoneNormalizado = soDigitos(
    String(corpo.telefone || '')
  );

  const subtotal = Number(corpo.subtotal);

  if (!codigo) {
    return NextResponse.json(
      { erro: 'Informe o código do cupom.' },
      { status: 400 }
    );
  }

  if (codigo.length > 40) {
    return NextResponse.json(
      { erro: 'Cupom inválido.' },
      { status: 400 }
    );
  }

  if (!Number.isFinite(subtotal) || subtotal <= 0) {
    return NextResponse.json(
      { erro: 'Adicione itens ao carrinho antes de aplicar o cupom.' },
      { status: 400 }
    );
  }

  const sb = supabaseAdmin();

  // ---------------------------------------------------------------
  // Procura o cupom
  // ---------------------------------------------------------------

  const {
    data: cupom,
    error: erroCupom,
  } = await sb
    .from('cupons')
    .select('*')
    .eq('codigo', codigo)
    .maybeSingle();

  if (erroCupom) {
    console.error('[validar-cupom] buscar:', erroCupom);

    return NextResponse.json(
      { erro: 'Não foi possível validar o cupom.' },
      { status: 500 }
    );
  }

  if (!cupom) {
    return NextResponse.json(
      { erro: 'Cupom inválido.' },
      { status: 400 }
    );
  }

  // ---------------------------------------------------------------
  // Cupom ativo
  // ---------------------------------------------------------------

  if (!cupom.ativo) {
    return NextResponse.json(
      { erro: 'Este cupom não está ativo.' },
      { status: 400 }
    );
  }

  // ---------------------------------------------------------------
  // Datas de validade
  // ---------------------------------------------------------------

  const agora = new Date();

  if (
    cupom.valido_de &&
    agora < new Date(cupom.valido_de)
  ) {
    return NextResponse.json(
      { erro: 'Este cupom ainda não está válido.' },
      { status: 400 }
    );
  }

  if (
    cupom.valido_ate &&
    agora > new Date(cupom.valido_ate)
  ) {
    return NextResponse.json(
      { erro: 'Este cupom expirou.' },
      { status: 400 }
    );
  }

  // ---------------------------------------------------------------
  // Limite total de utilizações
  // ---------------------------------------------------------------

  if (cupom.limite_usos !== null) {
    const {
      count,
      error: erroContagem,
    } = await sb
      .from('cupom_usos')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq('cupom_id', cupom.id);

    if (erroContagem) {
      console.error(
        '[validar-cupom] limite:',
        erroContagem
      );

      return NextResponse.json(
        {
          erro: 'Não foi possível validar o limite do cupom.',
        },
        { status: 500 }
      );
    }

    if (
      (count || 0) >=
      Number(cupom.limite_usos)
    ) {
      return NextResponse.json(
        {
          erro: 'Este cupom atingiu o limite de utilizações.',
        },
        { status: 400 }
      );
    }
  }

  // ---------------------------------------------------------------
  // Primeira compra
  // ---------------------------------------------------------------

  if (cupom.primeira_compra) {
    if (!telefoneNormalizado) {
      return NextResponse.json(
        {
          erro: 'Informe seu telefone para validar este cupom de primeira compra.',
          precisaTelefone: true,
        },
        { status: 400 }
      );
    }

    const {
      count: comprasAnteriores,
      error: erroHistorico,
    } = await sb
      .from('pedidos')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq(
        'cliente_telefone_normalizado',
        telefoneNormalizado
      )
      .neq('status', 'cancelado');

    if (erroHistorico) {
      console.error(
        '[validar-cupom] primeira compra:',
        erroHistorico
      );

      return NextResponse.json(
        {
          erro: 'Não foi possível validar a primeira compra.',
        },
        { status: 500 }
      );
    }

    if ((comprasAnteriores || 0) > 0) {
      return NextResponse.json(
        {
          erro: 'Este cupom é exclusivo para a primeira compra.',
        },
        { status: 400 }
      );
    }
  }

  // ---------------------------------------------------------------
  // Calcula o desconto para EXIBIÇÃO no carrinho.
  //
  // O route.js de /api/pedidos continuará recalculando tudo no
  // servidor na finalização. Portanto o navegador não determina
  // o valor real do pedido.
  // ---------------------------------------------------------------

  let desconto = 0;

  if (cupom.tipo === 'percentual') {
    desconto = Number(
      (
        subtotal *
        (Number(cupom.valor) / 100)
      ).toFixed(2)
    );
  } else if (cupom.tipo === 'fixo') {
    desconto = Number(
      Number(cupom.valor).toFixed(2)
    );
  } else {
    return NextResponse.json(
      { erro: 'Configuração de cupom inválida.' },
      { status: 500 }
    );
  }

  desconto = Math.min(
    Math.max(desconto, 0),
    subtotal
  );

  const subtotalComDesconto = Number(
    Math.max(
      0,
      subtotal - desconto
    ).toFixed(2)
  );

  return NextResponse.json({
    ok: true,

    cupom: {
      codigo: cupom.codigo,
      descricao: cupom.descricao || '',
      tipo: cupom.tipo,
      valor: Number(cupom.valor),
      primeira_compra: !!cupom.primeira_compra,
    },

    desconto,
    subtotal,
    subtotalComDesconto,
  });
}
