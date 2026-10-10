import { redirect } from 'next/navigation';
import Link from 'next/link';
import { exigirAdmin } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

function dinheiro(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default async function ClientesCRM() {
  const usuario = await exigirAdmin();
  if (!usuario) redirect('/login');
  const sb = supabaseAdmin();
  const { data: pedidos, error } = await sb.from('pedidos')
    .select('id,cliente_nome,cliente_telefone_normalizado,cliente_telefone,criado_em,total,status,status_pagamento')
    .order('criado_em', { ascending: false }).limit(1000);
  const clientes = new Map();
  for (const p of pedidos || []) {
    const telefone = String(p.cliente_telefone_normalizado || '').replace(/\D/g, '');
    if (!telefone) continue;
    if (!clientes.has(telefone)) clientes.set(telefone, {
      telefone, nome: p.cliente_nome || 'Cliente', pedidos: 0,
      concluidos: 0, total: 0, ultima: p.criado_em,
    });
    const c = clientes.get(telefone);
    if (p.status !== 'cancelado') {
      c.pedidos += 1;
      if (p.status === 'concluido') c.concluidos += 1;
      if (p.status_pagamento === 'pago') c.total += Number(p.total || 0);
    }
  }
  const agora = Date.now();
  const diasDesde = (data) => Math.max(0, Math.floor((agora - new Date(data).getTime()) / 86400000));
  const lista = [...clientes.values()].map(c => ({...c, diasSemComprar:diasDesde(c.ultima), segmento:c.pedidos>1 ? (diasDesde(c.ultima)>=30 ? 'Recorrente inativo' : 'Recorrente ativo') : (diasDesde(c.ultima)>=30 ? 'Inativo' : 'Novo')})).sort((a,b) => b.pedidos-a.pedidos || b.ultima.localeCompare(a.ultima));
  return <main style={{maxWidth:1100,margin:'0 auto',padding:'32px 20px',fontFamily:'system-ui,sans-serif'}}>
    <Link href="/admin">← Voltar ao painel</Link>
    <h1>Clientes · CRM</h1>
    <p>Resumo dos até 1.000 pedidos mais recentes. Valores representam pagamentos registrados como pagos, não faturamento contábil.</p>
    {error && <p role="alert">Não foi possível carregar os clientes. Tente novamente.</p>}
    {!error && <><p><strong>{lista.length}</strong> clientes identificados por telefone · <strong>{lista.filter(c=>c.pedidos>1).length}</strong> recorrentes · <strong>{lista.filter(c=>c.diasSemComprar>=30).length}</strong> sem comprar há 30 dias ou mais</p>
    <p>Segmentação inicial: ativo = compra nos últimos 29 dias; inativo = 30 dias ou mais. A classificação considera somente os pedidos disponíveis nesta consulta.</p>
    <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',textAlign:'left'}}>
      <thead><tr>{['Cliente','Telefone','Pedidos','Concluídos','Total pago','Última compra','Segmento'].map(x=><th key={x} style={{padding:12,borderBottom:'1px solid #ddd'}}>{x}</th>)}</tr></thead>
      <tbody>{lista.map(c=><tr key={c.telefone}><td style={{padding:12,borderBottom:'1px solid #eee'}}>{c.nome}</td><td>{c.telefone}</td><td>{c.pedidos}</td><td>{c.concluidos}</td><td>{dinheiro(c.total)}</td><td>{new Date(c.ultima).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'})}</td><td>{c.segmento}</td></tr>)}</tbody>
    </table></div>{lista.length===0&&<p>Ainda não há clientes com pedidos registrados.</p>}</>}
  </main>;
}
