import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req){
  try{
    const {codigo,telefone}=await req.json();
    const cod=String(codigo||'').trim().toUpperCase();
    const tel=String(telefone||'').replace(/\D/g,'');
    if(!cod||tel.length<8)return NextResponse.json({erro:'Informe o código e o WhatsApp do pedido.'},{status:400});
    const sb=supabaseAdmin();
    const {data,error}=await sb.from('pedidos').select('id,codigo,cliente_telefone').ilike('codigo',cod).limit(1).maybeSingle();
    if(error)throw error;
    const salvo=String(data?.cliente_telefone||'').replace(/\D/g,'');
    if(!data||!salvo||salvo.slice(-8)!==tel.slice(-8))return NextResponse.json({erro:'Não encontramos um pedido com esses dados.'},{status:404});
    return NextResponse.json({id:data.id});
  }catch(e){console.error('[consultar pedido]',e);return NextResponse.json({erro:'Não foi possível consultar agora.'},{status:500});}
}
