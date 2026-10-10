import { redirect } from 'next/navigation';
import Link from 'next/link';
import { exigirAdmin } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import CrmClientes from './CrmClientes';

export const dynamic = 'force-dynamic';
const LIMITE = 1000;

export default async function ClientesCRM() {
  const usuario = await exigirAdmin();
  if (!usuario) redirect('/login');

  const {data:pedidos,error} = await supabaseAdmin().from('pedidos')
    .select('id,auth_user_id,cliente_nome,cliente_telefone_normalizado,cliente_telefone,criado_em,total,status,status_pagamento,itens')
    .order('criado_em',{ascending:false}).limit(LIMITE);

  const extrairItens = itens => (Array.isArray(itens) ? itens : Array.isArray(itens?.itens) ? itens.itens : []).map(item => ({
    nome: String(item?.nome || item?.name || item?.produto_nome || '').trim(),
    quantidade: Number(item?.quantidade ?? item?.qtd ?? item?.qty ?? 1),
  })).filter(item => item.nome && Number.isFinite(item.quantidade) && item.quantidade > 0);
  const clientes = new Map();
  for (const p of pedidos || []) {
    const telefone=String(p.cliente_telefone_normalizado||p.cliente_telefone||'').replace(/\D/g,'');
    // Nao unir historicos de usuarios autenticados diferentes so por telefone.
    const id=p.auth_user_id?'auth:'+p.auth_user_id:telefone?'tel:'+telefone:null;
    if(!id)continue;
    if(!clientes.has(id))clientes.set(id,{
      id,telefone,nome:p.cliente_nome||'Cliente',pedidos:0,total:0,ultima:null,primeira:null,historico:[],produtos:{},diasSemana:[0,0,0,0,0,0,0],
    });
    const c=clientes.get(id);
    c.historico.push({
      id:p.id,criado_em:p.criado_em,total:p.total,status:p.status,
      status_pagamento:p.status_pagamento,itens:p.itens,
    });
    // Apenas pedidos concluidos ou com pagamento confirmado contam como compra.
    const valido=p.status!=='cancelado'&&(p.status==='concluido'||p.status_pagamento==='pago');
    if(!valido)continue;
    c.pedidos++;
    if(!c.primeira || p.criado_em < c.primeira)c.primeira=p.criado_em;
    const diaSemana=new Intl.DateTimeFormat('en-US',{weekday:'short',timeZone:'America/Sao_Paulo'}).format(new Date(p.criado_em));
    const indice={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[diaSemana];
    if(indice!==undefined)c.diasSemana[indice]++;
    for(const item of extrairItens(p.itens))c.produtos[item.nome]=(c.produtos[item.nome]||0)+item.quantidade;
    if(!c.ultima||p.criado_em>c.ultima)c.ultima=p.criado_em;
    if(p.status_pagamento==='pago')c.total+=Number(p.total||0);
  }
  // Consulta somente leitura: usa o saldo oficial, sem recalcular ou movimentar pontos.
  const sb=supabaseAdmin();
  const {data:contasFidelidade,error:erroFidelidade}=await sb.from('fidelidade_clientes')
    .select('id,auth_user_id,telefone,saldo').limit(5000);
  const porAuth=new Map(),porTelefone=new Map();
  for(const conta of contasFidelidade||[]){
    if(conta.auth_user_id)porAuth.set(String(conta.auth_user_id),conta);
    else if(conta.telefone)porTelefone.set(String(conta.telefone).replace(/\\D/g,''),conta);
  }
  const agora=Date.now();
  const lista=[...clientes.values()].map(c=>{
    const diasSemComprar=c.ultima?Math.max(0,Math.floor((agora-new Date(c.ultima).getTime())/86400000)):null;
    const inativo=diasSemComprar!==null&&diasSemComprar>=30;
    const conta=c.id.startsWith('auth:')?porAuth.get(c.id.slice(5)):porTelefone.get(c.telefone);
    return {...c,diasSemComprar,pontosDisponiveis:conta?Number(conta.saldo||0):null,produtosFavoritos:Object.entries(c.produtos).sort((a,b)=>b[1]-a[1]).slice(0,5),
      segmento:c.pedidos===0?'Sem compra válida':inativo?(c.pedidos>=2?'Recorrente inativo':'Inativo'):(c.pedidos>=2?'Recorrente ativo':'Novo'),
      vip:c.pedidos>=10||c.total>=500,
    };
  });
  return <main style={{maxWidth:1200,margin:'0 auto',padding:'24px 16px',background:'#f7f1e8',minHeight:'100vh'}}>
    <Link href="/admin" style={{color:'#a9432a'}}>← Voltar ao painel</Link>
    <h1 style={{fontFamily:'Georgia,serif',color:'#2b2118'}}>Clientes · CRM</h1>
    <p style={{color:'#756454'}}>Pedidos reais, preferências de consumo e saldo oficial de fidelidade (consulta somente leitura).</p>
    {erroFidelidade&&<p role="status">O saldo de fidelidade está temporariamente indisponível; os demais dados continuam acessíveis.</p>}
    {error?<p role="alert">Não foi possível consultar os pedidos. Nenhum dado foi alterado.</p>:<CrmClientes clientes={lista} limite={LIMITE}/>}
  </main>;
}
