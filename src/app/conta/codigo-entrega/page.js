'use client';
import Link from 'next/link';
import CustomerBottomNav from '@/components/CustomerBottomNav';
import DeliveryMascot from '@/components/DeliveryMascot';
import '../../loja-v15.css';
export default function CodigoEntrega(){return <><main className="delivery-code-page"><header className="delivery-code-head"><Link href="/conta">‹</Link><h1>Código de entrega</h1><span/></header><section className="delivery-code-illustration"><DeliveryMascot/></section><section className="delivery-code-content"><h2>Seu código de entrega</h2><p className="delivery-code-intro">Mais segurança e carinho em cada entrega.</p><div className="delivery-code-card"><strong>— — — —</strong><button type="button" disabled>Alterar código</button></div><div className="delivery-code-off"><b>Recurso desativado</b><p>Seus pedidos não exigem código de entrega no momento. Quando a função for ativada, você receberá orientações aqui.</p></div></section></main><CustomerBottomNav/></>}
