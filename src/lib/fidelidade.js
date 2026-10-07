export async function prepararCreditoFidelidade(sb,pedido){
 if(!pedido?.id||!pedido?.cliente_telefone_normalizado)return;
 const {data:cfg}=await sb.from('fidelidade_config').select('*').eq('id',1).maybeSingle();
 if(!cfg?.ativo)return;
 const base=Number(pedido.subtotal||0)-Number(pedido.desconto||0)+(cfg.incluir_taxa_entrega?Number(pedido.taxa||0):0);
 if(base<Number(cfg.pedido_minimo||0))return;
 if(!cfg.permitir_com_cupom&&pedido.cupom_codigo)return;
 const pontos=Math.floor(base/Number(cfg.reais_por_ponto||1));if(pontos<=0)return;
 const telefone=String(pedido.cliente_telefone_normalizado);
 let {data:cliente}=await sb.from('fidelidade_clientes').select('*').eq('telefone',telefone).maybeSingle();
 if(!cliente){const r=await sb.from('fidelidade_clientes').insert({telefone,nome:pedido.cliente_nome||''}).select().single();cliente=r.data}
 if(!cliente)return;
 let expira_em=null;if(cfg.validade_dias){const d=new Date();d.setDate(d.getDate()+Number(cfg.validade_dias));expira_em=d.toISOString()}
 await sb.from('fidelidade_movimentos').upsert({cliente_id:cliente.id,pedido_id:pedido.id,tipo:'credito',pontos,status:'pendente',descricao:'Pontos do pedido '+(pedido.codigo||''),expira_em},{onConflict:'pedido_id',ignoreDuplicates:true});
}
export async function liberarCreditoFidelidade(sb,pedido){
 if(!pedido?.id||pedido.status!=='concluido'||pedido.status_pagamento!=='pago')return;
 const {data:mov}=await sb.from('fidelidade_movimentos').select('id,cliente_id,pontos,status').eq('pedido_id',pedido.id).eq('tipo','credito').maybeSingle();
 if(!mov||mov.status!=='pendente')return;
 const {data:cliente}=await sb.from('fidelidade_clientes').select('saldo').eq('id',mov.cliente_id).single();if(!cliente)return;
 const novo=Number(cliente.saldo||0)+Number(mov.pontos||0);
 const {error}=await sb.from('fidelidade_clientes').update({saldo:novo,atualizado_em:new Date().toISOString()}).eq('id',mov.cliente_id).eq('saldo',cliente.saldo);
 if(error)return;
 await sb.from('fidelidade_movimentos').update({status:'disponivel'}).eq('id',mov.id).eq('status','pendente');
}
