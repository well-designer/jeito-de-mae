import { NextResponse } from 'next/server';
import { exigirAdmin } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
export async function POST(request){
 const user=await exigirAdmin();if(!user)return NextResponse.json({erro:'Não autorizado.'},{status:401});
 const b=await request.json().catch(()=>({}));const nome=String(b.nome||'').trim().slice(0,80),descricao=String(b.descricao||'').trim().slice(0,180),pontos=Number(b.pontos);
 if(!nome||!Number.isInteger(pontos)||pontos<=0)return NextResponse.json({erro:'Informe nome e pontos válidos.'},{status:400});
 const {data,error}=await supabaseAdmin().from('fidelidade_recompensas').insert({nome,descricao,pontos,ativo:true,ordem:Number.isInteger(Number(b.ordem))?Number(b.ordem):0}).select().single();
 if(error)return NextResponse.json({erro:'Não foi possível criar a recompensa.'},{status:500});return NextResponse.json({recompensa:data});
}
export async function DELETE(request){
 const user=await exigirAdmin();if(!user)return NextResponse.json({erro:'Não autorizado.'},{status:401});
 const id=new URL(request.url).searchParams.get('id');if(!/^[0-9a-f-]{36}$/i.test(id||''))return NextResponse.json({erro:'Recompensa inválida.'},{status:400});
 const {error}=await supabaseAdmin().from('fidelidade_recompensas').update({ativo:false}).eq('id',id);
 if(error)return NextResponse.json({erro:'Não foi possível desativar.'},{status:500});return NextResponse.json({ok:true});
}
