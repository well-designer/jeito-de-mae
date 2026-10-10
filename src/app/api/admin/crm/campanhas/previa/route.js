import { NextResponse } from 'next/server';
import { exigirAdmin } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
const SEGMENTOS = new Set(['Todos','Novo','Recorrente ativo','Inativo','Recorrente inativo','VIP']);

// Apenas contagem: nenhuma lista de telefone e nenhuma autorizacao de disparo.
export async function POST(request) {
  const usuario = await exigirAdmin();
  if (!usuario) return NextResponse.json({erro:'Acesso restrito.'},{status:403});
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({erro:'Dados inválidos.'},{status:400}); }
  const segmento = String(body?.segmento || 'Todos');
  const chaves = body?.clientes;
  if (!SEGMENTOS.has(segmento) || !Array.isArray(chaves) || chaves.length > 1000 ||
      chaves.some(chave => typeof chave !== 'string' || chave.length < 5 || chave.length > 120))
    return NextResponse.json({erro:'Seleção inválida.'},{status:400});
  const unicas = [...new Set(chaves)];
  if (!unicas.length) return NextResponse.json({quantidade:0,excluidos:0,modo:'simulacao'});
  const sb=supabaseAdmin();
  // Relacoes historicas podem ser ambiguas. Se a consulta ultrapassar o limite,
  // negar a simulacao em vez de presumir ausencia de revogacao.
  const authIds=unicas.filter(c=>c.startsWith('auth:')).map(c=>c.slice(5));
  const telefones=unicas.filter(c=>c.startsWith('tel:')).map(c=>c.slice(4));
  const relacoes=[];
  if(authIds.length){
    const {data,error}=await sb.from('pedidos')
      .select('auth_user_id,cliente_telefone_normalizado,cliente_telefone')
      .in('auth_user_id',authIds).limit(1001);
    if(error||!data||data.length>1000)return NextResponse.json({erro:'Vínculos de contas incompletos; conferência indisponível.'},{status:503});
    relacoes.push(...data);
  }
  if(telefones.length){
    const {data,error}=await sb.from('pedidos')
      .select('auth_user_id,cliente_telefone_normalizado,cliente_telefone')
      .in('cliente_telefone_normalizado',telefones).limit(1001);
    if(error||!data||data.length>1000)return NextResponse.json({erro:'Vínculos de telefone incompletos; conferência indisponível.'},{status:503});
    relacoes.push(...data);
  }
  const vinculadas=new Map();
  const vincular=(a,b)=>{
    if(!vinculadas.has(a))vinculadas.set(a,new Set());
    if(!vinculadas.has(b))vinculadas.set(b,new Set());
    vinculadas.get(a).add(b);vinculadas.get(b).add(a);
  };
  for(const p of relacoes){
    if(!p.auth_user_id)continue;
    const tel=String(p.cliente_telefone_normalizado||p.cliente_telefone||'').replace(/\\D/g,'');
    if(tel)vincular('auth:'+p.auth_user_id,'tel:'+tel);
  }
  const chavesRelacionadas=[...new Set([...unicas,...[...vinculadas.values()].flatMap(v=>[...v])])];
  if(chavesRelacionadas.length>2000)return NextResponse.json({erro:'Seleção muito ampla para conferência segura.'},{status:400});
  const {data,error} = await sb.from('crm_consentimentos')
    .select('cliente_chave,status').in('cliente_chave',chavesRelacionadas);
  if (error) return NextResponse.json({erro:'Não foi possível conferir as preferências.'},{status:503});
  const estados=new Map((data||[]).map(item=>[item.cliente_chave,item.status]));
  const autorizado=chave=>{
    if(estados.get(chave)!=='autorizado')return false;
    // Uma revogacao em qualquer identificador diretamente vinculado prevalece.
    return ![...(vinculadas.get(chave)||[])].some(outra=>estados.get(outra)==='revogado');
  };
  return NextResponse.json({
    quantidade:unicas.filter(chave => autorizado(chave)).length,
    excluidos:unicas.filter(chave => !autorizado(chave)).length,
    modo:'simulacao',
    aviso:'Registro administrativo não comprova opt-in. Proibido usar esta prévia como autorização de envio.'
  });
}
