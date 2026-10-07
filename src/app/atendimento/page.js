import {redirect} from 'next/navigation';
import {exigirAtendimento} from '@/lib/supabaseServer';
import {supabaseAdmin} from '@/lib/supabaseAdmin';
import Cozinha from '@/components/cozinha';
export const dynamic='force-dynamic';
export default async function AtendimentoPage(){const u=await exigirAtendimento();if(!u)redirect('/login');const {data}=await supabaseAdmin().from('pedidos').select('*').not('status','in','(concluido,cancelado)').order('criado_em',{ascending:true}).limit(120);return <Cozinha pedidosIniciais={data||[]}/>;}