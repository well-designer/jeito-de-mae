import { NextResponse } from 'next/server';
import { exigirAdmin } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic='force-dynamic';
async function autorizado(){
  return await exigirAdmin();
}
export async function GET(request){
  const user=await autorizado();
  if(!user)return NextResponse.json({erro:'Acesso restrito.'},{status:403});
  const chave=new URL(request.url).searchParams.get('cliente')||'';
  if(chave.length<5||chave.length>120)return NextResponse.json({erro:'Cliente inválido.'},{status:400});
  const {data,error}=await supabaseAdmin().from('crm_contatos')
    .select('id,cliente_chave,cliente_nome,canal,tipo,situacao,observacao,criado_em')
    .eq('cliente_chave',chave).order('criado_em',{ascending:false}).limit(50);
  if(error)return NextResponse.json({erro:'Histórico indisponível. Verifique a migração do CRM.'},{status:503});
  return NextResponse.json({contatos:data||[]});
}
export async function POST(request){
  const user=await autorizado();
  if(!user)return NextResponse.json({erro:'Acesso restrito.'},{status:403});
  let body;try{body=await request.json()}catch{return NextResponse.json({erro:'Dados inválidos.'},{status:400})}
  const chave=String(body?.cliente_chave||''),nome=String(body?.cliente_nome||'').trim();
  const observacao=String(body?.observacao||'').trim();
  if(chave.length<5||chave.length>120||!nome||nome.length>120||observacao.length>1000)
    return NextResponse.json({erro:'Dados inválidos.'},{status:400});
  const {data,error}=await supabaseAdmin().from('crm_contatos').insert({
    cliente_chave:chave,cliente_nome:nome,observacao,
    canal:'whatsapp',tipo:'atendimento',situacao:'registrado_manualmente',criado_por:user.id,
  }).select('id,cliente_chave,cliente_nome,canal,tipo,situacao,observacao,criado_em').single();
  if(error)return NextResponse.json({erro:'Não foi possível salvar. Verifique a migração do CRM.'},{status:503});
  return NextResponse.json({contato:data},{status:201});
}
