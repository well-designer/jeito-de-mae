import { NextResponse } from 'next/server';
import { exigirAdmin } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function PATCH(req,{params}){
 const user=await exigirAdmin();if(!user)return NextResponse.json({erro:'Não autorizado'},{status:401});
 const {id}=await params;const body=await req.json();const patch={atualizado_em:new Date().toISOString()};
 if(typeof body.ativo==='boolean')patch.ativo=body.ativo;
 const {data,error}=await supabaseAdmin().from('banners').update(patch).eq('id',id).select().single();
 if(error)return NextResponse.json({erro:error.message},{status:500});return NextResponse.json({banner:data});
}
export async function DELETE(req,{params}){
 const user=await exigirAdmin();if(!user)return NextResponse.json({erro:'Não autorizado'},{status:401});
 const {id}=await params;const {error}=await supabaseAdmin().from('banners').delete().eq('id',id);
 if(error)return NextResponse.json({erro:error.message},{status:500});return NextResponse.json({ok:true});
}
