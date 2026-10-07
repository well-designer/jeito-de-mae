import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';
import { exigirEntregador } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { processarFidelidadePedido } from '@/lib/fidelidadePedido';
export const dynamic='force-dynamic';

export async function GET(){
 const user=await exigirEntregador(); if(!user)return NextResponse.json({erro:'nao autorizado'},{status:401});
 const {data,error}=await supabaseAdmin().from('pedidos').select('id,codigo,cliente_nome,cliente_telefone,cliente_endereco,cliente_referencia,total,pagamento,status_pagamento,status,entregador_id,saiu_entrega_em,chegou_entrega_em,troco_para,entrega_codigo_necessario,criado_em').eq('tipo','entrega').eq('status','entrega').or(`entregador_id.is.null,entregador_id.eq.${user.id}`).order('pronto_em',{ascending:true});
 if(error)return NextResponse.json({erro:'falha ao carregar entregas'},{status:500});
 return NextResponse.json({entregas:data||[],usuario_id:user.id});
}

export async function PATCH(request){
 const user=await exigirEntregador(); if(!user)return NextResponse.json({erro:'nao autorizado'},{status:401});
 const body=await request.json().catch(()=>({})); const id=String(body.id||''),acao=String(body.acao||'');
 if(!/^[0-9a-f-]{36}$/i.test(id)||!['assumir','cheguei','entregue'].includes(acao))return NextResponse.json({erro:'dados invalidos'},{status:400});
 const sb=supabaseAdmin(); const {data:p}=await sb.from('pedidos').select('id,status,tipo,entregador_id,pagamento,status_pagamento,entrega_codigo_necessario,entrega_codigo_hash').eq('id',id).maybeSingle();
 if(!p||p.tipo!=='entrega'||p.status!=='entrega')return NextResponse.json({erro:'entrega indisponivel'},{status:409});
 if(p.entregador_id&&p.entregador_id!==user.id)return NextResponse.json({erro:'entrega atribuida a outro entregador'},{status:409});
 let patch={};
 if(acao==='assumir')patch={entregador_id:user.id,saiu_entrega_em:new Date().toISOString()};
 if(acao==='cheguei'){if(!p.entregador_id)return NextResponse.json({erro:'assuma a entrega primeiro'},{status:409});patch={chegou_entrega_em:new Date().toISOString()};}
 if(acao==='entregue'){
   if(!p.entregador_id)return NextResponse.json({erro:'assuma a entrega primeiro'},{status:409});
   if(p.entrega_codigo_necessario){
     const codigo=String(body.codigo||'').trim();
     if(!/^\d{6}$/.test(codigo)||!p.entrega_codigo_hash)return NextResponse.json({erro:'informe o codigo de 6 digitos do cliente'},{status:400});
     const recebido=Buffer.from(createHash('sha256').update(codigo).digest('hex'),'hex');
     const esperado=Buffer.from(p.entrega_codigo_hash,'hex');
     if(recebido.length!==esperado.length||!timingSafeEqual(recebido,esperado))return NextResponse.json({erro:'codigo de entrega incorreto'},{status:409});
     patch.entrega_confirmacao_metodo='codigo';
   } else patch.entrega_confirmacao_metodo='manual';

   if(p.pagamento==='dinheiro'&&p.status_pagamento!=='pago')patch.status_pagamento='pago';
   patch.status='concluido'; patch.concluido_em=new Date().toISOString();
 }
 const {data,error}=await sb.from('pedidos').update(patch).eq('id',id).eq('status','entrega').select().single();
 if(error)return NextResponse.json({erro:'falha ao atualizar entrega'},{status:500});
 if(acao==='entregue') await processarFidelidadePedido(sb,data).catch(e=>console.error('[fidelidade] entrega:',e));
 return NextResponse.json({pedido:data});
}