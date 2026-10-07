import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
async function usuario(request){
 const auth=request.headers.get('authorization')||'';const token=auth.startsWith('Bearer ')?auth.slice(7):'';if(!token)return null;
 const c=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user}}=await c.auth.getUser(token);return user||null;
}
export async function GET(request){
 const user=await usuario(request);if(!user)return NextResponse.json({erro:'Autenticação necessária.'},{status:401});
 const sb=supabaseAdmin();const [{data:cfg},{data:recompensas},{data:cliente}]=await Promise.all([
  sb.from('fidelidade_config').select('ativo,reais_por_ponto,pedido_minimo,validade_dias').eq('id',1).maybeSingle(),
  sb.from('fidelidade_recompensas').select('id,nome,descricao,pontos').eq('ativo',true).order('ordem'),
  sb.from('fidelidade_clientes').select('id,nome,saldo,email').eq('auth_user_id',user.id).maybeSingle()
 ]);
 if(!cliente)return NextResponse.json({config:cfg||null,cliente:null,recompensas:recompensas||[],movimentos:[]});
 const {data:movimentos}=await sb.from('fidelidade_movimentos').select('id,tipo,pontos,status,descricao,expira_em,criado_em').eq('cliente_id',cliente.id).order('criado_em',{ascending:false}).limit(20);
 return NextResponse.json({config:cfg||null,cliente,recompensas:recompensas||[],movimentos:movimentos||[]});
}
