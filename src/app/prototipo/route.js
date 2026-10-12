import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-dynamic';

export async function GET() {
  const filePath = path.join(process.cwd(), 'Jeito de Mãe Pedidos (1).html');
  let html = await readFile(filePath, 'utf8');

  // Mantém o HTML/CSS do protótipo como fonte visual e injeta somente a identidade real.
  html = html.replace(
    '</style>\n\n<div id="root"></div>',
    `.brand-logo-img{width:100%;height:100%;object-fit:contain;border-radius:50%;display:block}.banner{background:linear-gradient(180deg,rgba(25,8,8,.12),rgba(25,8,8,.38)),linear-gradient(120deg,var(--bordo),var(--brand));background-size:cover;background-position:center}.banner span{background:rgba(0,0,0,.28);padding:5px 8px;border-radius:6px}.admin-shortcuts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.admin-shortcut{display:flex;flex-direction:column;gap:3px;text-decoration:none;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px}.admin-shortcut b{font-size:14px}.admin-shortcut small{color:var(--muted);font-size:11px}.admin-shortcut.primary{background:var(--brand);color:#fff;border-color:var(--brand)}.admin-shortcut.primary small{color:rgba(255,255,255,.8)}@media(max-width:520px){.admin-shortcuts{grid-template-columns:1fr}}\n</style>\n\n<div id="root"></div>`
  );

  html = html.replace(
    `'<div class="banner"><span>Foto de capa do restaurante</span></div>'+\n '<div class="hero"><div class="logo" aria-label="Logo">JM</div><h1>Jeito de Mãe Delícias Caseiras</h1>'+`,
    `'<div class="banner"><span>Jeito de Mãe · Delícias Caseiras</span></div>'+\n '<div class="hero"><div class="logo" aria-label="Logo Jeito de Mãe"><img class="brand-logo-img" src="/jeito%20de%20m%C3%A3e%20logo%20new.png" alt="Jeito de Mãe"></div><h1>Jeito de Mãe Delícias Caseiras</h1>'+`
  );

  html = html.replace(
    `'<div class="panel"><div class="row"><div><h2 style="margin:0">Restaurante '+(S.open?'aberto':'fechado')+'</h2><div class="note">Fechado bloqueia novos pedidos no site.</div></div><button class="switch" role="switch" aria-checked="'+S.open+'" aria-label="Restaurante aberto" data-act="toggleOpen"></button></div></div>'+`,
    `'<div class="panel"><div class="row"><div><h2 style="margin:0">Restaurante '+(S.open?'aberto':'fechado')+'</h2><div class="note">Fechado bloqueia novos pedidos no site.</div></div><button class="switch" role="switch" aria-checked="'+S.open+'" aria-label="Restaurante aberto" data-act="toggleOpen"></button></div></div>'+\n '<div class="panel"><h2>Operação Jeito de Mãe</h2><div class="admin-shortcuts"><a class="admin-shortcut primary" href="/admin"><b>Central de pedidos</b><small>Pedidos, status e operação</small></a><a class="admin-shortcut" href="/admin/cozinha"><b>Cozinha</b><small>Fila e preparo dos pedidos</small></a><a class="admin-shortcut" href="/admin/financeiro"><b>Financeiro</b><small>Receitas, despesas e resultados</small></a><a class="admin-shortcut" href="/admin"><b>Produtos e configurações</b><small>Cardápio, cupons e loja</small></a></div></div>'+`
  );

  return new NextResponse(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store, max-age=0',
    },
  });
}
