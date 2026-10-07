import { supabaseAdmin } from '@/lib/supabaseAdmin';
import Loja from '@/components/Loja';
import CustomerBottomNav from '@/components/CustomerBottomNav';
import './loja-v15.css';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
  const sb = supabaseAdmin();
  const [{ data: config }, { data: produtos }, { data: banners }] = await Promise.all([
    sb.from('config').select('*').eq('id', 1).single(),
    sb.from('produtos').select(`id,nome,descricao,categoria,opcoes,foto_url,destaque,ordem,dias_semana,adicionais,perguntar_talher,ativo`).eq('ativo', true).order('ordem'),
    sb.from('banners').select('*').eq('ativo',true).order('prioridade',{ascending:false}).order('criado_em',{ascending:false}),
  ]);

  return <><Loja config={config || {}} produtos={produtos || []} banners={(banners||[]).filter(b=>{const n=Date.now();return (!b.inicio_em||new Date(b.inicio_em).getTime()<=n)&&(!b.fim_em||new Date(b.fim_em).getTime()>=n)}).slice(0,3)}/><CustomerBottomNav /></>;
}
