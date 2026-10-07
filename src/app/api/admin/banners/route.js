import { NextResponse } from 'next/server';
import { exigirAdmin } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(){
 const user=await exigirAdmin(); if(!user)return NextResponse.json({erro:'Não autorizado'},{status:401});
 const {data,error}=await supabaseAdmin().from('banners').select('*').order('prioridade',{ascending:false}).order('criado_em',{ascending:false});
 if(error)return NextResponse.json({erro:error.message},{status:500});
 return NextResponse.json({banners:data||[]});
}
export async function POST(req){
 const user=await exigirAdmin(); if(!user)return NextResponse.json({erro:'Não autorizado'},{status:401});
 const b=await req.json();
 const payload={kicker:String(b.kicker||'').slice(0,60),titulo:String(b.titulo||'').slice(0,120),texto:String(b.texto||'').slice(0,240),cta:String(b.cta||'').slice(0,40),link:String(b.link||'/').slice(0,300),imagem_url:b.imagem?String(b.imagem).slice(0,1000):null,inicio_em:b.inicio||null,fim_em:b.fim||null,prioridade:Number(b.prioridade)||1,ativo:false};
 if(!payload.titulo)return NextResponse.json({erro:'Título obrigatório'},{status:400});
 const {data,error}=await supabaseAdmin().from('banners').insert(payload).select().single();
 if(error)return NextResponse.json({erro:error.message},{status:500});
 return NextResponse.json({banner:data},{status:201});
}
