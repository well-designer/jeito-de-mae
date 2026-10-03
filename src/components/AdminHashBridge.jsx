'use client';

import { useEffect } from 'react';

export default function AdminHashBridge(){
  useEffect(()=>{
    const abrir=()=>{
      const alvo=(location.hash||'#pedidos').slice(1);
      const mapa={pedidos:'Pedidos',cardapio:'Cardápio',cupons:'Cupons',config:'Configurações'};
      const texto=mapa[alvo];if(!texto)return;
      const botoes=[...document.querySelectorAll('.admin-v15-main .tabs button')];
      const botao=botoes.find(b=>b.textContent.trim().startsWith(texto));
      if(botao)botao.click();
    };
    const t=setTimeout(abrir,50);window.addEventListener('hashchange',abrir);
    return()=>{clearTimeout(t);window.removeEventListener('hashchange',abrir);};
  },[]);
  return null;
}
