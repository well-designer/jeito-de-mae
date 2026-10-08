'use client';
import Link from 'next/link';
import CustomerBottomNav from '@/components/CustomerBottomNav';
import '../../loja-v15.css';
export default function CodigoEntrega(){return <><main className="delivery-code-page"><header className="delivery-code-head"><Link href="/conta">‹</Link><h1>Código de entrega</h1><span/></header><section className="delivery-code-illustration"><div className="delivery-woman" aria-hidden="true"><span>JM</span><b>♡</b></div></section><section className="delivery-code-content"><h2>Seu código de entrega</h2><div className="delivery-code-card"><strong>— — — —</strong><button type="button" disabled>Alterar código</button></div><div className="delivery-code-off"><b>Recurso desativado</b><p>Seus pedidos não exigem código de entrega no momento.</p></div></section></main><CustomerBottomNav/></>}
