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
 // A conta autenticada tem prioridade sobre o telefone digitado no checkout.
 // Isso evita que uma compra com telefone de terceiros movimente o saldo alheio.
 if(pedido.auth_user_id){
  const {data:contaAutenticada}=await sb.from('fidelidade_clientes').select('*').eq('auth_user_id',pedido.auth_user_id).maybeSingle();
  if(contaAutenticada)cliente=contaAutenticada;
  else if(cliente?.auth_user_id && cliente.auth_user_id!==pedido.auth_user_id)return;
  else if(cliente&&!cliente.auth_user_id){
   // Pontos anteriores exigem comprovacao de titularidade; nao vincular pelo telefone.
   return;
  }
 }
 if(!cliente){
  const novo={telefone,nome:pedido.cliente_nome||''};
  if(pedido.auth_user_id)novo.auth_user_id=pedido.auth_user_id;
  const {data:criado,error:erroCriacao}=await sb.from('fidelidade_clientes').insert(novo).select().maybeSingle();
  if(erroCriacao){
   // Uma solicitacao simultanea pode ter criado o registro primeiro.
   const {data:existente}=await sb.from('fidelidade_clientes').select('*').eq('telefone',telefone).maybeSingle();
   if(!existente||pedido.auth_user_id&&existente.auth_user_id!==pedido.auth_user_id)return;
   cliente=existente;
  }else cliente=criado;
 }
 if(!cliente)return;
 let expira_em=null;if(cfg.validade_dias){const d=new Date();d.setDate(d.getDate()+Number(cfg.validade_dias));expira_em=d.toISOString()}
 await sb.from('fidelidade_movimentos').upsert({cliente_id:cliente.id,pedido_id:pedido.id,tipo:'credito',pontos,status:'pendente',descricao:'Pontos do pedido '+(pedido.codigo||''),expira_em},{onConflict:'pedido_id',ignoreDuplicates:true});
}
export async function liberarCreditoFidelidade(sb,pedido){
 if(!pedido?.id||pedido.status!=='concluido'||pedido.status_pagamento!=='pago')return false;
 const {data,error}=await sb.rpc('liberar_pontos_fidelidade',{p_pedido_id:pedido.id});
 if(error){console.error('[fidelidade] liberar pontos:',error);return false}
 return data===true;
}
