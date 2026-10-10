import { NextResponse } from 'next/server';
import { exigirAdmin } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
export const dynamic='force-dynamic';
const SEGMENTOS=new Set(['Todos','Novo','Recorrente ativo','Inativo','Recorrente inativo','VIP']);
export async function GET(){
 const user=await exigirAdmin();if(!user)return NextResponse.json({erro:'Acesso restrito.'},{status:403});
 const {data,error}=await supabaseAdmin().from('crm_campanhas').select('id,titulo,mensagem,segmento,status,criado_em').order('criado_em',{ascending:false}).limit(100);
 if(error)return NextResponse.json({erro:'Rascunhos indisponíveis.'},{status:503});
 return NextResponse.json({campanhas:data||[],modo:'rascunhos_sem_envio'});
}
export async function POST(request){
 const user=await exigirAdmin();if(!user)return NextResponse.json({erro:'Acesso restrito.'},{status:403});
 let body;try{body=await request.json()}catch{return NextResponse.json({erro:'Dados inválidos.'},{status:400})}
 const titulo=String(body?.titulo||'').trim(),mensagem=String(body?.mensagem||'').trim(),segmento=String(body?.segmento||'Todos');
 if(titulo.length<3||titulo.length>120||!mensagem||mensagem.length>2000||!SEGMENTOS.has(segmento))
   return NextResponse.json({erro:'Confira título, mensagem e público.'},{status:400});
 const {data,error}=await supabaseAdmin().from('crm_campanhas').insert({titulo,mensagem,segmento,status:'rascunho',criado_por:user.id}).select('id,titulo,mensagem,segmento,status,criado_em').single();
 if(error)return NextResponse.json({erro:'Não foi possível salvar o rascunho.'},{status:503});
 return NextResponse.json({campanha:data,modo:'rascunho_sem_envio'},{status:201});
}
