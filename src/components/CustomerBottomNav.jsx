'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function CustomerBottomNav() {
  const pathname = usePathname();
  const itens = [
    {href:'/',label:'Início',outline:'/nav-home-outline.svg',filled:'/nav-home-filled.svg'},
    {href:'/#cardapio',label:'Cardápio',outline:'/nav-loyalty-outline.svg',filled:'/nav-loyalty-filled.svg'},
    {href:'/meus-pedidos',label:'Pedidos',outline:'/nav-order-outline.svg',filled:'/nav-order-filled.svg'},
    {href:'/conta',label:'Perfil',outline:'/nav-user-outline.svg',filled:'/nav-user-filled.svg'},
  ];

  return (
    <nav className="customer-bottom-nav" aria-label="Navegação principal">
      {itens.map((item) => {
        const ativo = item.href === '/' ? pathname === '/' : item.href === '/#cardapio' ? false : pathname.startsWith(item.href);
        const icon=ativo?item.filled:item.outline;
        return <Link key={item.href} href={item.href} className={ativo ? 'active' : ''}>
          <span className="customer-nav-icon" aria-hidden="true" style={{WebkitMaskImage:`url("${icon}")`,maskImage:`url("${icon}")`}}/>
          <b>{item.label}</b>
        </Link>;
      })}
    </nav>
  );
}
