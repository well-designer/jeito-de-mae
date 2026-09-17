import { NextResponse } from 'next/server';
import { exigirAdmin } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const FUSO = 'America/Sao_Paulo';
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/** Data no fuso de Brasilia, no formato AAAA-MM-DD. */
function diaLocal(iso) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: FUSO });
}
function nomeDoDia(chave) {
  const [a, m, d] = chave.split('-').map(Number);
  return DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
}

/** Intervalo pedido pelo painel, sempre alinhado a semana que comeca na segunda. */
function intervalo(periodo) {
  const agoraLocal = new Date(new Date().toLocaleString('en-US', { timeZone: FUSO }));
  const inicio = new Date(agoraLocal);
  inicio.setHours(0, 0, 0, 0);

  if (periodo === 'semana' || periodo === 'semana_passada') {
    const diaSemana = (inicio.getDay() + 6) % 7; // 0 = segunda
    inicio.setDate(inicio.getDate() - diaSemana);
    if (periodo === 'semana_passada') inicio.setDate(inicio.getDate() - 7);
    const fim = new Date(inicio);
    fim.setDate(fim.getDate() + 7);
    return { inicio, fim: periodo === 'semana_passada' ? fim : null };
  }
  if (periodo === 'mes') {
    inicio.setDate(1);
    return { inicio, fim: null };
  }
  if (periodo === 'hoje') return { inicio, fim: null };
  return { inicio: new Date(2000, 0, 1), fim: null }; // tudo
}

function montarRelatorio(pedidos) {
  // Venda de verdade: nao cancelada e ja paga (ou a pagar em dinheiro).
  const vendas = pedidos.filter(
    (p) => p.status !== 'cancelado' && (p.status_pagamento === 'pago' || p.pagamento === 'dinheiro')
  );
  const aguardando = pedidos.filter(
    (p) => p.status !== 'cancelado' && p.pagamento === 'pix' && p.status_pagamento !== 'pago'
  );

  const porDia = new Map();
  const porPagamento = {};

  for (const p of vendas) {
    const chave = diaLocal(p.criado_em);
    const linha = porDia.get(chave) || { dia: chave, nome: nomeDoDia(chave), vendas: 0, valor: 0 };
    linha.vendas += 1;
    linha.valor += Number(p.total);
    porDia.set(chave, linha);

    const forma = p.pagamento;
    porPagamento[forma] = porPagamento[forma] || { vendas: 0, valor: 0 };
    porPagamento[forma].vendas += 1;
    porPagamento[forma].valor += Number(p.total);
  }

  const total = vendas.reduce((s, p) => s + Number(p.total), 0);
  const entregas = vendas.filter((p) => p.tipo === 'entrega').length;

  return {
    totalVendas: vendas.length,
    totalValor: Number(total.toFixed(2)),
    ticketMedio: vendas.length ? Number((total / vendas.length).toFixed(2)) : 0,
    entregas,
    retiradas: vendas.length - entregas,
    cancelados: pedidos.filter((p) => p.status === 'cancelado').length,
    aguardandoPagamento: {
      vendas: aguardando.length,
      valor: Number(aguardando.reduce((s, p) => s + Number(p.total), 0).toFixed(2)),
    },
    porPagamento,
    porDia: [...porDia.values()]
      .map((l) => ({ ...l, valor: Number(l.valor.toFixed(2)) }))
      .sort((a, b) => a.dia.localeCompare(b.dia)),
  };
}

/** CSV com ; e BOM: abre certinho no Excel e no Google Sheets em portugues. */
function gerarCSV(rel, periodo) {
  const n = (v) => String(Number(v).toFixed(2)).replace('.', ',');
  const br = (d) => d.split('-').reverse().join('/');
  const linhas = [
    ['Jeito de Mae - Delicias Caseiras'],
    ['Periodo', periodo],
    ['Gerado em', new Date().toLocaleString('pt-BR', { timeZone: FUSO })],
    [],
    ['Dia', 'Data', 'Vendas', 'Valor total (R$)', 'Ticket medio (R$)'],
    ...rel.porDia.map((l) => [
      l.nome, br(l.dia), l.vendas, n(l.valor), n(l.vendas ? l.valor / l.vendas : 0),
    ]),
    [],
    ['TOTAL', '', rel.totalVendas, n(rel.totalValor), n(rel.ticketMedio)],
    [],
    ['Forma de pagamento', 'Vendas', 'Valor (R$)'],
    ...Object.entries(rel.porPagamento).map(([forma, d]) => [forma, d.vendas, n(d.valor)]),
    [],
    ['Entregas', rel.entregas],
    ['Retiradas', rel.retiradas],
    ['Pedidos cancelados', rel.cancelados],
    ['Pix aguardando pagamento', rel.aguardandoPagamento.vendas, n(rel.aguardandoPagamento.valor)],
  ];
  const csv = linhas
    .map((l) => l.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';'))
    .join('\r\n');
  return '\uFEFF' + csv;
}

export async function GET(request) {
  if (!(await exigirAdmin())) return NextResponse.json({ erro: 'nao autorizado' }, { status: 401 });

  const periodo = request.nextUrl.searchParams.get('periodo') || 'semana';
  const formato = request.nextUrl.searchParams.get('formato');
  const { inicio, fim } = intervalo(periodo);

  let q = supabaseAdmin()
    .from('pedidos')
    .select('total, pagamento, status, status_pagamento, tipo, criado_em')
    .gte('criado_em', inicio.toISOString())
    .order('criado_em', { ascending: true });
  if (fim) q = q.lt('criado_em', fim.toISOString());

  const { data, error } = await q;
  if (error) return NextResponse.json({ erro: 'falha ao ler pedidos' }, { status: 500 });

  const rel = montarRelatorio(data || []);

  if (formato === 'csv') {
    const rotulo = {
      hoje: 'hoje', semana: 'esta-semana', semana_passada: 'semana-passada',
      mes: 'este-mes', tudo: 'completo',
    }[periodo] || periodo;
    return new NextResponse(gerarCSV(rel, rotulo), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="jeito-de-mae-${rotulo}.csv"`,
      },
    });
  }

  return NextResponse.json({ relatorio: rel, periodo });
}
