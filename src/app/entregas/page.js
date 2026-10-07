import {redirect} from 'next/navigation';
import {exigirEntregador} from '@/lib/supabaseServer';
import {supabaseAdmin} from '@/lib/supabaseAdmin';
import Entregas from '@/components/Entregas';
export const dynamic='force-dynamic';
export default async function EntregasPage(){const user=await exigirEntregador();if(!user)redirect('/login');const {data}=await supabaseAdmin().from('pedidos').select('id,codigo,cliente_nome,cliente_telefone,cliente_endereco,cliente_referencia,total,pagamento,status_pagamento,status,entregador_id,saiu_entrega_em,chegou_entrega_em,troco_para,criado_em').eq('tipo','entrega').eq('status','entrega').or(`entregador_id.is.null,entregador_id.eq.${user.id}`).order('pronto_em',{ascending:true});return <Entregas iniciais={data||[]} usuarioId={user.id}/>;}