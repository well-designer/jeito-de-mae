import { NextResponse } from 'next/server';
import { exigirAdmin } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

function dataValida(v){return !v || !Number.isNaN(new Date(v).getTime())}
function destinoValido(v){
 if(!v)return true;
 if(v.startsWith('/') && !v.startsWith('//'))return true;
 try{const u=new URL(v);return u.protocol==='https:';}catch{return false}
}
function imagemValida(v){
 if(!v)return true;
 try{const u=new URL(v);return u.protocol==='https:';}catch{return false}
}
export async function GET(){
 const user=await exigirAdmin();if(!user)return NextResponse.json({erro:'Não autorizado'},{status:401});
 const {data,error}=await supabaseAdmin().from('banners').select('*').order('prioridade',{ascending:false}).order('criado_em',{ascending:false});
 if(error)return NextResponse.json({erro:'Não foi possível carregar os banners.'},{status:500});
 return NextResponse.json({banners:data||[]});
}
export async function POST(req){
 const user=await exigirAdmin();if(!user)return NextResponse.json({erro:'Não autorizado'},{status:401});
 const b=await req.json().catch(()=>({}));
 const titulo=String(b.titulo||'').trim().slice(0,120);
 const link=String(b.link||'/').trim().slice(0,300);
 const imagem=String(b.imagem||'').trim().slice(0,1000);
 const inicio=b.inicio||null,fim=b.fim||null;
 if(!titulo)return NextResponse.json({erro:'Título obrigatório'},{status:400});
 if(!destinoValido(link))return NextResponse.json({erro:'Destino inválido. Use uma rota da loja ou endereço HTTPS.'},{status:400});
 if(!imagemValida(imagem))return NextResponse.json({erro:'A imagem precisa usar um endereço HTTPS válido.'},{status:400});
 if(!dataValida(inicio)||!dataValida(fim))return NextResponse.json({erro:'Data de exibição inválida.'},{status:400});
 if(inicio&&fim&&new Date(fim)<=new Date(inicio))return NextResponse.json({erro:'A data final precisa ser posterior à data inicial.'},{status:400});
 const prioridade=Math.min(3,Math.max(1,Number(b.prioridade)||1));
 const payload={kicker:String(b.kicker||'').trim().slice(0,60),titulo,texto:String(b.texto||'').trim().slice(0,240),cta:String(b.cta||'').trim().slice(0,40),link,imagem_url:imagem||null,inicio_em:inicio,fim_em:fim,prioridade,ativo:false};
 const {data,error}=await supabaseAdmin().from('banners').insert(payload).select().single();
 if(error){console.error('[banners] criar:',error);return NextResponse.json({erro:'Não foi possível salvar o banner.'},{status:500})}
 return NextResponse.json({banner:data},{status:201});
}
