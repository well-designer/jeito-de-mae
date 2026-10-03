'use client';
import Link from 'next/link';
import {useState} from 'react';
import CustomerBottomNav from '@/components/CustomerBottomNav';
import '../../loja-v15.css';
export default function Cupons(){const[codigo,setCodigo]=useState('');return <><main className="customer-subpage coupon-page"><header className="customer-subhead"><Link href="/conta">‹</Link><div><h1>Cupons</h1><p>Seus descontos em um só lugar.</p></div></header><section className="coupon-add"><b>Tem um código?</b><small>Você também pode informar o cupom na sacola antes de finalizar.</small><div><input value={codigo} onChange={e=>setCodigo(e.target.value.toUpperCase())} placeholder="DIGITE O CUPOM"/><Link href={codigo?`/?cupom=${encodeURIComponent(codigo)}`:'/'}>Usar</Link></div></section><section className="coupon-empty"><span>✦</span><h2>Nenhum cupom salvo</h2><p>Quando houver cupons e benefícios disponíveis, eles poderão aparecer aqui.</p><Link href="/">Ver cardápio</Link></section></main><CustomerBottomNav/></>}
