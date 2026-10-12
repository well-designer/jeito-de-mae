import { redirect } from 'next/navigation';
import { exigirAdmin } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import FidelidadeAdmin from '@/components/FidelidadeAdmin';
export const dynamic='force-dynamic';
export default async function Page(){
 const user=await exigirAdmin();if(!user)redirect('/login');
 const sb=supabaseAdmin();const [{data:config},{data:recompensas}]=await Promise.all([sb.from('fidelidade_config').select('*').eq('id',1).single(),sb.from('fidelidade_recompensas').select('*').order('ordem')]);
 return <FidelidadeAdmin inicial={config||{}} recompensas={recompensas||[]}/>;
}
