import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

import { exigirAdmin } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const FUSO = 'America/Sao_Paulo';

const DIAS = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
];

const CATEGORIAS_DESPESA = {
  alimentos: 'Alimentos',
  embalagens: 'Embalagens',
  bebidas: 'Bebidas',
  gas: 'Gás',
  limpeza: 'Limpeza',
  entrega: 'Entrega',
  outros: 'Outros',
};

const FORMAS_PAGAMENTO = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  credito: 'Crédito',
  debito: 'Débito',
  cartao: 'Cartão',
};

function diaLocal(iso) {
  return new Date(iso).toLocaleDateString(
    'en-CA',
    { timeZone: FUSO }
  );
}

function nomeDoDia(chave) {
  const [a, m, d] = chave
    .split('-')
    .map(Number);

  return DIAS[
    new Date(
      Date.UTC(a, m - 1, d)
    ).getUTCDay()
  ];
}

function chaveDataLocal(data) {
  const ano = data.getFullYear();

  const mes = String(
    data.getMonth() + 1
  ).padStart(2, '0');

  const dia = String(
    data.getDate()
  ).padStart(2, '0');

  return `${ano}-${mes}-${dia}`;
}

function intervalo(periodo) {
  const agoraLocal = new Date(
    new Date().toLocaleString(
      'en-US',
      { timeZone: FUSO }
    )
  );

  const inicio = new Date(agoraLocal);

  inicio.setHours(0, 0, 0, 0);

  if (
    periodo === 'semana' ||
    periodo === 'semana_passada'
  ) {
    const diaSemana =
      (inicio.getDay() + 6) % 7;

    inicio.setDate(
      inicio.getDate() - diaSemana
    );

    if (
      periodo === 'semana_passada'
    ) {
      inicio.setDate(
        inicio.getDate() - 7
      );
    }

    const fim = new Date(inicio);

    fim.setDate(
      fim.getDate() + 7
    );

    return {
      inicio,
      fim:
        periodo === 'semana_passada'
          ? fim
          : null,
    };
  }

  if (periodo === 'mes') {
    inicio.setDate(1);

    return {
      inicio,
      fim: null,
    };
  }

  if (periodo === 'hoje') {
    return {
      inicio,
      fim: null,
    };
  }

  return {
    inicio: new Date(2000, 0, 1),
    fim: null,
  };
}

/*
 * Calcula a quantidade de minutos
 * entre dois horários.
 */
function minutosEntre(inicio, fim) {
  if (!inicio || !fim) return null;

  const a = new Date(inicio).getTime();
  const b = new Date(fim).getTime();

  if (
    !Number.isFinite(a) ||
    !Number.isFinite(b) ||
    b < a
  ) {
    return null;
  }

  return (b - a) / 60000;
}

/*
 * Calcula uma média somente com
 * tempos válidos.
 */
function mediaMinutos(valores) {
  const validos = valores.filter(
    (v) =>
      Number.isFinite(v) &&
      v >= 0
  );

  if (!validos.length) {
    return null;
  }

  return Number(
    (
      validos.reduce(
        (s, v) => s + v,
        0
      ) / validos.length
    ).toFixed(1)
  );
}

function montarRelatorio(
  pedidos,
  despesas
) {
  /*
   * Venda considerada:
   * - não cancelada
   * - paga
   * OU pagamento em dinheiro
   */
  const vendas = pedidos.filter(
    (p) =>
      p.status !== 'cancelado' &&
      (
        p.status_pagamento === 'pago' ||
        p.pagamento === 'dinheiro'
      )
  );

  const aguardando = pedidos.filter(
    (p) =>
      p.status !== 'cancelado' &&
      p.pagamento === 'pix' &&
      p.status_pagamento !== 'pago'
  );

  const porDia = new Map();
  const porPagamento = {};

  for (const p of vendas) {
    const chave = diaLocal(
      p.criado_em
    );

    const linha =
      porDia.get(chave) || {
        dia: chave,
        nome: nomeDoDia(chave),
        vendas: 0,
        valor: 0,
      };

    linha.vendas += 1;

    linha.valor += Number(
      p.total || 0
    );

    porDia.set(
      chave,
      linha
    );

    const forma = p.pagamento;

    porPagamento[forma] =
      porPagamento[forma] || {
        vendas: 0,
        valor: 0,
      };

    porPagamento[
      forma
    ].vendas += 1;

    porPagamento[
      forma
    ].valor += Number(
      p.total || 0
    );
  }

  const total = vendas.reduce(
    (s, p) =>
      s + Number(p.total || 0),
    0
  );

  /*
   * Soma dos descontos efetivamente
   * concedidos nas vendas consideradas.
   *
   * Não será subtraído novamente do
   * resultado operacional, pois p.total
   * já contém o valor final com desconto.
   */
  const totalDescontos =
    vendas.reduce(
      (s, p) =>
        s +
        Number(
          p.desconto || 0
        ),
      0
    );

  const pedidosComDesconto =
    vendas.filter(
      (p) =>
        Number(
          p.desconto || 0
        ) > 0
    ).length;

  const entregas =
    vendas.filter(
      (p) =>
        p.tipo === 'entrega'
    ).length;

  /*
   * DESPESAS
   */
  const porCategoriaDespesa = {};

  for (const d of despesas) {
    const categoria =
      d.categoria || 'outros';

    if (
      !porCategoriaDespesa[
        categoria
      ]
    ) {
      porCategoriaDespesa[
        categoria
      ] = {
        categoria,

        nome:
          CATEGORIAS_DESPESA[
            categoria
          ] || categoria,

        quantidade: 0,
        valor: 0,
      };
    }

    porCategoriaDespesa[
      categoria
    ].quantidade += 1;

    porCategoriaDespesa[
      categoria
    ].valor += Number(
      d.valor || 0
    );
  }

  Object.values(
    porCategoriaDespesa
  ).forEach((item) => {
    item.valor = Number(
      item.valor.toFixed(2)
    );
  });

  const totalDespesas =
    despesas.reduce(
      (s, d) =>
        s +
        Number(
          d.valor || 0
        ),
      0
    );

  /*
   * O total das vendas já é líquido
   * dos cupons concedidos.
   */
  const resultadoOperacional =
    total - totalDespesas;

  /*
   * TEMPOS OPERACIONAIS
   *
   * Pedidos antigos que não possuem
   * os timestamps necessários não
   * entram nas respectivas médias.
   */
  const pedidosNaoCancelados =
    pedidos.filter(
      (p) =>
        p.status !== 'cancelado'
    );

  const temposEspera =
    pedidosNaoCancelados.map((p) =>
      minutosEntre(
        p.criado_em,
        p.confirmado_em
      )
    );

  const temposPreparo =
    pedidosNaoCancelados.map((p) =>
      minutosEntre(
        p.preparo_em,
        p.pronto_em
      )
    );

  const temposTotais =
    pedidosNaoCancelados.map((p) =>
      minutosEntre(
        p.criado_em,
        p.concluido_em
      )
    );

  const tempoMedioEspera =
    mediaMinutos(temposEspera);

  const tempoMedioPreparo =
    mediaMinutos(temposPreparo);

  const tempoMedioTotal =
    mediaMinutos(temposTotais);

  return {
    totalVendas:
      vendas.length,

    totalValor:
      Number(
        total.toFixed(2)
      ),

    totalDescontos:
      Number(
        totalDescontos.toFixed(2)
      ),

    pedidosComDesconto,

    ticketMedio:
      vendas.length
        ? Number(
            (
              total /
              vendas.length
            ).toFixed(2)
          )
        : 0,

    entregas,

    retiradas:
      vendas.length - entregas,

    cancelados:
      pedidos.filter(
        (p) =>
          p.status === 'cancelado'
      ).length,

    aguardandoPagamento: {
      vendas:
        aguardando.length,

      valor: Number(
        aguardando
          .reduce(
            (s, p) =>
              s +
              Number(
                p.total || 0
              ),
            0
          )
          .toFixed(2)
      ),
    },

    porPagamento,

    porDia: [
      ...porDia.values(),
    ]
      .map((l) => ({
        ...l,

        valor: Number(
          l.valor.toFixed(2)
        ),
      }))
      .sort(
        (a, b) =>
          a.dia.localeCompare(
            b.dia
          )
      ),

    totalDespesas:
      Number(
        totalDespesas.toFixed(2)
      ),

    quantidadeDespesas:
      despesas.length,

    resultadoOperacional:
      Number(
        resultadoOperacional.toFixed(
          2
        )
      ),

    tempoMedioEspera,
    tempoMedioPreparo,
    tempoMedioTotal,

    porCategoriaDespesa,
  };
}
