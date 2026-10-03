'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function CustomerBottomNav() {
  const pathname = usePathname();
  const itens = [
    ['/', '⌂', 'Início'],
    ['/meus-pedidos', '▤', 'Pedidos'],
    ['/conta', '♙', 'Conta'],
  ];

  return (
    <nav className="customer-bottom-nav" aria-label="Navegação principal">
      {itens.map(([href, icon, label]) => {
        const ativo = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return <Link key={href} href={href} className={ativo ? 'active' : ''}><span aria-hidden="true">{icon}</span><b>{label}</b></Link>;
      })}
    </nav>
  );
}
