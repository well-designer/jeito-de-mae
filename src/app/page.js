import { supabaseAdmin } from '@/lib/supabaseAdmin';
import Loja from '@/components/Loja';
import CustomerHeader from '@/components/CustomerHeader';
import CustomerBottomNav from '@/components/CustomerBottomNav';
import './loja-v15.css';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
  const sb = supabaseAdmin();
  const [{ data: config }, { data: produtos }] = await Promise.all([
    sb.from('config').select('*').eq('id', 1).single(),
    sb.from('produtos').select(`id,nome,descricao,categoria,opcoes,foto_url,destaque,ordem,dias_semana,adicionais,perguntar_talher`).eq('ativo', true).order('ordem'),
  ]);

  return <><CustomerHeader/><Loja config={config || {}} produtos={produtos || []}/><CustomerBottomNav /></>;
}
