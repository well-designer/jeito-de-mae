import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { soDigitos } from '@/lib/validation';
import { limitar, ipDe } from '@/lib/rateLimit';
export const dynamic='force-dynamic';
export async function POST(request){
 if(!limitar('fidelidade:'+ipDe(request),12,60000)) return NextResponse.json({erro:'Muitas tentativas. Aguarde um minuto.'},{status:429});
 const body=await request.json().catch(()=>({}));const telefone=soDigitos(body.telefone||'');
 if(telefone.length<10||telefone.length>13)return NextResponse.json({erro:'WhatsApp inválido.'},{status:400});
 const sb=supabaseAdmin();
 const [{data:cfg},{data:recompensas},{data:cliente}]=await Promise.all([
  sb.from('fidelidade_config').select('ativo,reais_por_ponto,pedido_minimo,validade_dias').eq('id',1).maybeSingle(),
  sb.from('fidelidade_recompensas').select('id,nome,descricao,pontos').eq('ativo',true).order('ordem'),
  sb.from('fidelidade_clientes').select('id,nome,saldo').eq('telefone',telefone).maybeSingle()
 ]);
 if(!cliente)return NextResponse.json({config:cfg||null,cliente:null,recompensas:recompensas||[],movimentos:[]});
 const {data:movimentos}=await sb.from('fidelidade_movimentos').select('id,tipo,pontos,status,descricao,expira_em,criado_em').eq('cliente_id',cliente.id).order('criado_em',{ascending:false}).limit(20);
 return NextResponse.json({config:cfg||null,cliente,recompensas:recompensas||[],movimentos:movimentos||[]});
}
