import Link from 'next/link';
import { redirect } from 'next/navigation';
import { exigirAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export default async function MarketingPage(){
  const user=await exigirAdmin();
  if(!user) redirect('/login');
  return <div className="marketing-v15">
    <div className="marketing-heading"><div><span>MARKETING</span><h1>Banners e campanhas</h1><p>Crie destaques para a loja e prepare campanhas com a identidade do Jeito de Mãe.</p></div><button type="button">+ Novo banner</button></div>
    <section className="marketing-ai"><div className="marketing-ai-icon">✦</div><div><span>ASSISTENTE COM IA</span><h2>Criar banner com IA</h2><p>Escolha um produto ou ocasião e receba uma sugestão de chamada, texto e direção visual. Nada é publicado sem sua aprovação.</p></div><button type="button">Criar com IA <b>→</b></button></section>
    <div className="marketing-stats"><article><small>Banners ativos</small><strong>0</strong><span>Nenhuma campanha publicada</span></article><article><small>Agendados</small><strong>0</strong><span>Campanhas futuras</span></article><article><small>Rascunhos</small><strong>0</strong><span>Ideias em preparação</span></article></div>
    <section className="marketing-list"><div className="marketing-list-head"><div><span>BANNERS DA LOJA</span><h2>Suas campanhas</h2></div><button type="button">Filtros</button></div><div className="marketing-empty"><div>▧</div><h3>Seu primeiro banner começa aqui</h3><p>Divulgue feijoada, prato do dia, promoções ou novidades diretamente na página inicial.</p><button type="button">Criar primeiro banner</button></div></section>
    <section className="marketing-ideas"><h2>Ideias para começar</h2><div><article><span>🍲</span><b>Prato do dia</b><small>Destaque uma opção do cardápio e leve o cliente direto para o pedido.</small></article><article><span>♡</span><b>Fidelidade</b><small>Apresente o programa de pontos quando ele estiver ativo.</small></article><article><span>✦</span><b>Campanha especial</b><small>Crie banners sazonais para datas e ocasiões importantes.</small></article></div></section>
    <Link className="marketing-back" href="/admin">← Voltar ao painel</Link>
  </div>;
}
