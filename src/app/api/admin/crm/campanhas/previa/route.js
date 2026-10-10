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
  // Cruzar os identificadores presentes nos pedidos, sem aceitar telefone informado pelo navegador.
  const authIds=unicas.filter(c=>c.startsWith('auth:')).map(c=>c.slice(5));
  const {data:pedidos,error:erroPedidos}=await sb.from('pedidos')
    .select('auth_user_id,cliente_telefone_normalizado,cliente_telefone')
    .in('auth_user_id',authIds.length?authIds:['00000000-0000-0000-0000-000000000000'])
    .limit(1000);
  if(erroPedidos)return NextResponse.json({erro:'Não foi possível verificar os vínculos de clientes.'},{status:503});
  const telefonesPorAuth=new Map();
  for(const p of pedidos||[]){
    const telefone=String(p.cliente_telefone_normalizado||p.cliente_telefone||'').replace(/\D/g,'');
    if(!telefone)continue;
    const chave='auth:'+p.auth_user_id;
    if(!telefonesPorAuth.has(chave))telefonesPorAuth.set(chave,new Set());
    telefonesPorAuth.get(chave).add('tel:'+telefone);
  }
  const chavesRelacionadas=[...new Set([...unicas,...[...telefonesPorAuth.values()].flatMap(v=>[...v])])];
  if(chavesRelacionadas.length>2000)return NextResponse.json({erro:'Seleção muito ampla para conferência segura.'},{status:400});
  const {data,error} = await sb.from('crm_consentimentos')
    .select('cliente_chave,status').in('cliente_chave',chavesRelacionadas);
  if (error) return NextResponse.json({erro:'Não foi possível conferir as preferências.'},{status:503});
  const estados=new Map((data||[]).map(item=>[item.cliente_chave,item.status]));
  const autorizado=chave=>{
    if(estados.get(chave)!=='autorizado')return false;
    // Revogacao vinculada ao mesmo telefone prevalece sobre autorizacao administrativa.
    return ![...(telefonesPorAuth.get(chave)||[])].some(t=>estados.get(t)==='revogado');
  };
  return NextResponse.json({
    quantidade:unicas.filter(chave => autorizado(chave)).length,
    excluidos:unicas.filter(chave => !autorizado(chave)).length,
    modo:'simulacao',
    aviso:'Registro administrativo não comprova opt-in. Proibido usar esta prévia como autorização de envio.'
  });
}
