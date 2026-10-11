import { supabaseAdmin } from '@/lib/supabaseAdmin';
import Loja from '@/components/Loja';
import CustomerBottomNav from '@/components/CustomerBottomNav';
import './loja-v15.css';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
  const sb = supabaseAdmin();
  const [{ data: config }, { data: produtos }, { data: banners }, {data: campanhas}] = await Promise.all([
    sb.from('config').select('*').eq('id', 1).single(),
    sb.from('produtos').select(`id,nome,descricao,categoria,opcoes,foto_url,destaque,ordem,dias_semana,adicionais,perguntar_talher,ativo`).eq('ativo', true).order('ordem'),
    sb.from('banners').select('*').eq('ativo',true).order('prioridade',{ascending:false}).order('criado_em',{ascending:false}),
    sb.from('crm_campanhas').select('id,titulo,mensagem,segmento').eq('status','publicada').eq('segmento','Todos').order('atualizado_em',{ascending:false}).limit(2),
  ]);

  return <><Loja config={config || {}} produtos={produtos || []} banners={(banners||[]).filter(b=>{const n=Date.now();return (!b.inicio_em||new Date(b.inicio_em).getTime()<=n)&&(!b.fim_em||new Date(b.fim_em).getTime()>=n)}).slice(0,3)}/>{(campanhas||[]).length>0&&<aside aria-label="Novidades da Jeito de Mãe" style={{maxWidth:700,margin:'12px auto 96px',padding:'0 16px'}}><h2 style={{fontSize:20,color:'#593323'}}>Novidades para você</h2>{campanhas.map(c=><article key={c.id} style={{background:'#fff9f0',border:'1px solid #e8d7c2',borderRadius:14,padding:18,marginBottom:12}}><h3 style={{margin:'0 0 8px',fontSize:18}}>{c.titulo}</h3><p style={{margin:0,whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{c.mensagem}</p></article>)}</aside>}<CustomerBottomNav /></>;
}
