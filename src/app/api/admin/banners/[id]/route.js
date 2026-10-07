import { NextResponse } from 'next/server';
import { exigirAdmin } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function PATCH(req,{params}){
 const user=await exigirAdmin();if(!user)return NextResponse.json({erro:'Não autorizado'},{status:401});
 const {id}=await params;const body=await req.json();const patch={atualizado_em:new Date().toISOString()};
 if(typeof body.ativo==='boolean')patch.ativo=body.ativo;
 if(body.kicker!==undefined)patch.kicker=String(body.kicker||'').slice(0,60);
 if(body.titulo!==undefined)patch.titulo=String(body.titulo||'').slice(0,120);
 if(body.texto!==undefined)patch.texto=String(body.texto||'').slice(0,240);
 if(body.cta!==undefined)patch.cta=String(body.cta||'').slice(0,40);
 if(body.link!==undefined)patch.link=String(body.link||'/').slice(0,300);
 if(body.imagem!==undefined)patch.imagem_url=body.imagem?String(body.imagem).slice(0,1000):null;
 if(body.inicio!==undefined)patch.inicio_em=body.inicio||null;
 if(body.fim!==undefined)patch.fim_em=body.fim||null;
 if(body.prioridade!==undefined)patch.prioridade=Math.min(3,Math.max(1,Number(body.prioridade)||1));
 const {data,error}=await supabaseAdmin().from('banners').update(patch).eq('id',id).select().single();
 if(error)return NextResponse.json({erro:error.message},{status:500});return NextResponse.json({banner:data});
}
export async function DELETE(req,{params}){
 const user=await exigirAdmin();if(!user)return NextResponse.json({erro:'Não autorizado'},{status:401});
 const {id}=await params;const {error}=await supabaseAdmin().from('banners').delete().eq('id',id);
 if(error)return NextResponse.json({erro:error.message},{status:500});return NextResponse.json({ok:true});
}
