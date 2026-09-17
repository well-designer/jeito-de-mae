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

    porCategoriaDespesa,
  };
}

function rotuloPeriodo(periodo) {
  return {
    hoje: 'Hoje',
    semana: 'Esta semana',
    semana_passada: 'Semana passada',
    mes: 'Este mês',
    tudo: 'Período completo',
  }[periodo] || periodo;
}

function nomeArquivoPeriodo(periodo) {
  return {
    hoje: 'hoje',
    semana: 'esta-semana',
    semana_passada: 'semana-passada',
    mes: 'este-mes',
    tudo: 'completo',
  }[periodo] || periodo;
}

function dataBR(data) {
  if (!data) return '';

  const partes = String(data).split('-');

  if (partes.length !== 3) {
    return String(data);
  }

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function moeda(cell) {
  cell.numFmt =
    '"R$" #,##0.00;[Red]-"R$" #,##0.00';
}

function borda(cell) {
  cell.border = {
    top: {
      style: 'thin',
      color: { argb: 'FFD9D9D9' },
    },
    left: {
      style: 'thin',
      color: { argb: 'FFD9D9D9' },
    },
    bottom: {
      style: 'thin',
      color: { argb: 'FFD9D9D9' },
    },
    right: {
      style: 'thin',
      color: { argb: 'FFD9D9D9' },
    },
  };
}

function cabecalhoTabela(row) {
  row.font = {
    bold: true,
    color: {
      argb: 'FFFFFFFF',
    },
  };

  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: {
      argb: 'FF6B1F32',
    },
  };

  row.alignment = {
    vertical: 'middle',
  };

  row.height = 22;

  row.eachCell((cell) => {
    borda(cell);
  });
}

function tituloSecao(
  ws,
  linha,
  titulo,
  ultimaColuna = 5
) {
  ws.mergeCells(
    linha,
    1,
    linha,
    ultimaColuna
  );

  const cell =
    ws.getCell(linha, 1);

  cell.value = titulo;

  cell.font = {
    bold: true,
    size: 12,
    color: {
      argb: 'FFFFFFFF',
    },
  };

  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: {
      argb: 'FF6B1F32',
    },
  };

  cell.alignment = {
    vertical: 'middle',
  };

  ws.getRow(linha).height = 24;
}

function linhaResumo(
  ws,
  linha,
  titulo,
  valor,
  tipo = 'numero'
) {
  const tituloCell =
    ws.getCell(linha, 1);

  const valorCell =
    ws.getCell(linha, 2);

  tituloCell.value = titulo;
  valorCell.value = valor;

  tituloCell.font = {
    bold: true,
  };

  tituloCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: {
      argb: 'FFF3F3F3',
    },
  };

  valorCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: {
      argb: 'FFF9F9F9',
    },
  };

  borda(tituloCell);
  borda(valorCell);

  if (tipo === 'moeda') {
    moeda(valorCell);
  }

  return linha + 1;
}

async function gerarExcel(
  rel,
  despesas,
  periodo
) {
  const workbook =
    new ExcelJS.Workbook();

  workbook.creator =
    'Jeito de Mãe';

  workbook.company =
    'Jeito de Mãe - Delícias Caseiras';

  workbook.created =
    new Date();

  /*
   * ABA 1
   * RELATÓRIO FINANCEIRO
   */
  const ws =
    workbook.addWorksheet(
      'Relatório Financeiro',
      {
        views: [
          {
            showGridLines: false,
          },
        ],
      }
    );

  ws.columns = [
    { width: 27 },
    { width: 22 },
    { width: 18 },
    { width: 20 },
    { width: 22 },
  ];

  ws.mergeCells('A1:E1');

  const titulo =
    ws.getCell('A1');

  titulo.value =
    'JEITO DE MÃE — DELÍCIAS CASEIRAS';

  titulo.font = {
    bold: true,
    size: 18,
    color: {
      argb: 'FFFFFFFF',
    },
  };

  titulo.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: {
      argb: 'FF6B1F32',
    },
  };

  titulo.alignment = {
    horizontal: 'center',
    vertical: 'middle',
  };

  ws.getRow(1).height = 34;

  ws.mergeCells('A2:E2');

  const subtitulo =
    ws.getCell('A2');

  subtitulo.value =
    'Relatório Financeiro';

  subtitulo.font = {
    bold: true,
    size: 14,
    color: {
      argb: 'FF6B1F32',
    },
  };

  subtitulo.alignment = {
    horizontal: 'center',
  };

  ws.mergeCells('A3:E3');

  ws.getCell('A3').value =
    `Período: ${rotuloPeriodo(periodo)}`;

  ws.getCell('A3').alignment = {
    horizontal: 'center',
  };

  ws.mergeCells('A4:E4');

  ws.getCell('A4').value =
    `Gerado em: ${new Date().toLocaleString(
      'pt-BR',
      { timeZone: FUSO }
    )}`;

  ws.getCell('A4').alignment = {
    horizontal: 'center',
  };

  /*
   * RESUMO FINANCEIRO
   */
  tituloSecao(
    ws,
    6,
    'RESUMO FINANCEIRO'
  );

  let linha = 7;

  linha = linhaResumo(
    ws,
    linha,
    'Faturamento',
    rel.totalValor,
    'moeda'
  );

  linha = linhaResumo(
    ws,
    linha,
    'Descontos concedidos',
    rel.totalDescontos,
    'moeda'
  );

  linha = linhaResumo(
    ws,
    linha,
    'Pedidos com desconto',
    rel.pedidosComDesconto
  );

  linha = linhaResumo(
    ws,
    linha,
    'Despesas',
    rel.totalDespesas,
    'moeda'
  );

  linha = linhaResumo(
    ws,
    linha,
    'Resultado operacional',
    rel.resultadoOperacional,
    'moeda'
  );

  linha = linhaResumo(
    ws,
    linha,
    'Total de vendas',
    rel.totalVendas
  );

  linha = linhaResumo(
    ws,
    linha,
    'Ticket médio',
    rel.ticketMedio,
    'moeda'
  );

  linha = linhaResumo(
    ws,
    linha,
    'Entregas',
    rel.entregas
  );

  linha = linhaResumo(
    ws,
    linha,
    'Retiradas',
    rel.retiradas
  );

  linha = linhaResumo(
    ws,
    linha,
    'Pedidos cancelados',
    rel.cancelados
  );

  linha = linhaResumo(
    ws,
    linha,
    'Pix aguardando pagamento',
    rel.aguardandoPagamento.vendas
  );

  linha = linhaResumo(
    ws,
    linha,
    'Valor Pix aguardando',
    rel.aguardandoPagamento.valor,
    'moeda'
  );

  /*
   * VENDAS POR DIA
   */
  linha += 2;

  tituloSecao(
    ws,
    linha,
    'VENDAS POR DIA'
  );

  linha += 1;

  const cabDia =
    ws.getRow(linha);

  cabDia.values = [
    'Dia',
    'Data',
    'Vendas',
    'Faturamento',
    'Ticket médio',
  ];

  cabecalhoTabela(cabDia);

  linha += 1;

  if (!rel.porDia.length) {
    ws.mergeCells(
      linha,
      1,
      linha,
      5
    );

    ws.getCell(
      linha,
      1
    ).value =
      'Nenhuma venda no período.';

    linha += 1;
  } else {
    for (
      const item of rel.porDia
    ) {
      const row =
        ws.getRow(linha);

      row.values = [
        item.nome,
        dataBR(item.dia),
        item.vendas,
        item.valor,
        item.vendas
          ? Number(
              (
                item.valor /
                item.vendas
              ).toFixed(2)
            )
          : 0,
      ];

      moeda(row.getCell(4));
      moeda(row.getCell(5));

      row.eachCell((cell) => {
        borda(cell);
      });

      linha += 1;
    }
  }

  /*
   * FORMAS DE PAGAMENTO
   */
  linha += 2;

  tituloSecao(
    ws,
    linha,
    'FORMAS DE PAGAMENTO'
  );

  linha += 1;

  const cabPagamento =
    ws.getRow(linha);

  cabPagamento.values = [
    'Forma de pagamento',
    'Vendas',
    'Valor',
  ];

  cabecalhoTabela(
    cabPagamento
  );

  linha += 1;

  const pagamentos =
    Object.entries(
      rel.porPagamento
    );

  if (!pagamentos.length) {
    ws.mergeCells(
      linha,
      1,
      linha,
      3
    );

    ws.getCell(
      linha,
      1
    ).value =
      'Nenhum pagamento no período.';

    linha += 1;
  } else {
    for (
      const [forma, dados]
      of pagamentos
    ) {
      const row =
        ws.getRow(linha);

      row.values = [
        FORMAS_PAGAMENTO[
          forma
        ] || forma,
        dados.vendas,
        dados.valor,
      ];

      moeda(row.getCell(3));

      row.eachCell((cell) => {
        borda(cell);
      });

      linha += 1;
    }
  }

  /*
   * DESPESAS POR CATEGORIA
   */
  linha += 2;

  tituloSecao(
    ws,
    linha,
    'DESPESAS POR CATEGORIA'
  );

  linha += 1;

  const cabDespesas =
    ws.getRow(linha);

  cabDespesas.values = [
    'Categoria',
    'Lançamentos',
    'Valor',
  ];

  cabecalhoTabela(
    cabDespesas
  );

  linha += 1;

  const categorias =
    Object.values(
      rel.porCategoriaDespesa
    );

  if (!categorias.length) {
    ws.mergeCells(
      linha,
      1,
      linha,
      3
    );

    ws.getCell(
      linha,
      1
    ).value =
      'Nenhuma despesa no período.';

    linha += 1;
  } else {
    for (
      const item of categorias
    ) {
      const row =
        ws.getRow(linha);

      row.values = [
        item.nome,
        item.quantidade,
        item.valor,
      ];

      moeda(row.getCell(3));

      row.eachCell((cell) => {
        borda(cell);
      });

      linha += 1;
    }
  }

  /*
   * Destaque do resultado operacional
   */
  ws.getCell('A11').font = {
    bold: true,
    color: {
      argb: 'FFFFFFFF',
    },
  };

  ws.getCell('B11').font = {
    bold: true,
    color: {
      argb: 'FFFFFFFF',
    },
  };

  ws.getCell('A11').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: {
      argb: 'FF6B1F32',
    },
  };

  ws.getCell('B11').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: {
      argb: 'FF6B1F32',
    },
  };

  /*
   * ABA 2
   * LANÇAMENTOS DE DESPESAS
   */
  const wsDespesas =
    workbook.addWorksheet(
      'Lançamentos de Despesas',
      {
        views: [
          {
            showGridLines: false,
          },
        ],
      }
    );

  wsDespesas.columns = [
    { width: 15 },
    { width: 34 },
    { width: 22 },
    { width: 18 },
    { width: 45 },
  ];

  wsDespesas.mergeCells(
    'A1:E1'
  );

  const tituloDespesa =
    wsDespesas.getCell('A1');

  tituloDespesa.value =
    'JEITO DE MÃE — DESPESAS';

  tituloDespesa.font = {
    bold: true,
    size: 18,
    color: {
      argb: 'FFFFFFFF',
    },
  };

  tituloDespesa.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: {
      argb: 'FF6B1F32',
    },
  };

  tituloDespesa.alignment = {
    horizontal: 'center',
    vertical: 'middle',
  };

  wsDespesas.getRow(1).height = 34;

  wsDespesas.mergeCells(
    'A2:E2'
  );

  wsDespesas.getCell(
    'A2'
  ).value =
    `Período: ${rotuloPeriodo(
      periodo
    )}`;

  wsDespesas.getCell(
    'A2'
  ).alignment = {
    horizontal: 'center',
  };

  const header =
    wsDespesas.getRow(4);

  header.values = [
    'Data',
    'Descrição',
    'Categoria',
    'Valor',
    'Observação',
  ];

  cabecalhoTabela(header);

  let linhaDespesa = 5;

  if (!despesas.length) {
    wsDespesas.mergeCells(
      linhaDespesa,
      1,
      linhaDespesa,
      5
    );

    wsDespesas.getCell(
      linhaDespesa,
      1
    ).value =
      'Nenhuma despesa lançada neste período.';
  } else {
    for (
      const despesa of despesas
    ) {
      const row =
        wsDespesas.getRow(
          linhaDespesa
        );

      row.values = [
        dataBR(despesa.data),
        despesa.descricao,
        CATEGORIAS_DESPESA[
          despesa.categoria
        ] || despesa.categoria,
        Number(
          despesa.valor || 0
        ),
        despesa.observacao || '',
      ];

      moeda(row.getCell(4));

      row.eachCell((cell) => {
        borda(cell);
      });

      linhaDespesa += 1;
    }

    linhaDespesa += 1;

    const totalRow =
      wsDespesas.getRow(
        linhaDespesa
      );

    totalRow.getCell(
      3
    ).value =
      'TOTAL DE DESPESAS';

    totalRow.getCell(
      4
    ).value =
      rel.totalDespesas;

    totalRow.getCell(
      3
    ).font = {
      bold: true,
    };

    totalRow.getCell(
      4
    ).font = {
      bold: true,
    };

    moeda(
      totalRow.getCell(4)
    );

    borda(
      totalRow.getCell(3)
    );

    borda(
      totalRow.getCell(4)
    );
  }

  /*
   * Congela o topo das planilhas
   */
  ws.views = [
    {
      state: 'frozen',
      ySplit: 4,
      showGridLines: false,
    },
  ];

  wsDespesas.views = [
    {
      state: 'frozen',
      ySplit: 4,
      showGridLines: false,
    },
  ];

  const buffer =
    await workbook.xlsx.writeBuffer();

  return buffer;
}

export async function GET(
  request
) {
  if (
    !(await exigirAdmin())
  ) {
    return NextResponse.json(
      {
        erro:
          'nao autorizado',
      },
      { status: 401 }
    );
  }

  const periodo =
    request.nextUrl.searchParams.get(
      'periodo'
    ) || 'semana';

  const formato =
    request.nextUrl.searchParams.get(
      'formato'
    );

  const { inicio, fim } =
    intervalo(periodo);

  /*
   * PEDIDOS
   */
  let qPedidos =
    supabaseAdmin()
      .from('pedidos')
      .select(
        'total, desconto, pagamento, status, status_pagamento, tipo, criado_em'
      )
      .gte(
        'criado_em',
        inicio.toISOString()
      )
      .order(
        'criado_em',
        { ascending: true }
      );

  if (fim) {
    qPedidos = qPedidos.lt(
      'criado_em',
      fim.toISOString()
    );
  }

  /*
   * DESPESAS
   */
  const inicioDespesa =
    chaveDataLocal(inicio);

  let qDespesas =
    supabaseAdmin()
      .from('despesas')
      .select(
        'id, descricao, categoria, valor, data, observacao, criado_em'
      )
      .gte(
        'data',
        inicioDespesa
      )
      .order(
        'data',
        { ascending: true }
      );

  if (fim) {
    const fimDespesa =
      chaveDataLocal(fim);

    qDespesas =
      qDespesas.lt(
        'data',
        fimDespesa
      );
  }

  const [
    pedidosResultado,
    despesasResultado,
  ] = await Promise.all([
    qPedidos,
    qDespesas,
  ]);

  if (
    pedidosResultado.error
  ) {
    return NextResponse.json(
      {
        erro:
          'falha ao ler pedidos',
      },
      { status: 500 }
    );
  }

  if (
    despesasResultado.error
  ) {
    return NextResponse.json(
      {
        erro:
          'falha ao ler despesas',
      },
      { status: 500 }
    );
  }

  const despesas =
    despesasResultado.data || [];

  const rel =
    montarRelatorio(
      pedidosResultado.data || [],
      despesas
    );

  /*
   * EXPORTAÇÃO EXCEL
   */
  if (
    formato === 'xlsx'
  ) {
    const rotulo =
      nomeArquivoPeriodo(
        periodo
      );

    const buffer =
      await gerarExcel(
        rel,
        despesas,
        periodo
      );

    return new NextResponse(
      buffer,
      {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

          'Content-Disposition':
            `attachment; filename="jeito-de-mae-${rotulo}.xlsx"`,

          'Cache-Control':
            'no-store',
        },
      }
    );
  }

  return NextResponse.json({
    relatorio: rel,
    periodo,
  });
}
