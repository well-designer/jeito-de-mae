import Link from 'next/link';
import CustomerBottomNav from '@/components/CustomerBottomNav';
import '../loja-v15.css';

export default function FidelidadePage(){
  return <div className="loyalty-page">
    <header className="loyalty-head"><Link href="/" aria-label="Voltar">‹</Link><div><span>JEITO DE MÃE</span><h1>Fidelidade</h1></div></header>
    <main className="loyalty-content">
      <section className="loyalty-hero">
        <span className="loyalty-kicker">CLUBE JEITO DE MÃE</span>
        <h2>Seu carinho pela nossa comida volta para você.</h2>
        <p>Faça pedidos, acumule pontos e troque por recompensas.</p>
        <div className="loyalty-balance"><div><small>Seu saldo</small><strong>0 <em>pontos</em></strong></div><span>♡</span></div>
        <button type="button" disabled>Entrar para acumular pontos</button>
      </section>
      <section className="loyalty-how"><h3>Como funciona</h3><div><i>1</i><p><b>Peça pelo Jeito de Mãe</b><small>Faça seu pedido normalmente pelo cardápio.</small></p></div><div><i>2</i><p><b>Acumule pontos</b><small>Pedidos elegíveis geram pontos após a conclusão.</small></p></div><div><i>3</i><p><b>Troque por recompensas</b><small>Use seus pontos nas recompensas disponíveis.</small></p></div></section>
      <section className="loyalty-rewards"><div className="loyalty-title"><div><span>RECOMPENSAS</span><h3>Em breve por aqui</h3></div><small>Novidade</small></div><p>Estamos preparando benefícios especiais para quem pede sempre com a gente.</p><div className="loyalty-reward-placeholder"><span>♡</span><div><b>Recompensas Jeito de Mãe</b><small>Os benefícios aparecerão aqui quando o programa for ativado.</small></div></div></section>
    </main>
    <CustomerBottomNav/>
  </div>;
}
