'use client';

import { useEffect } from 'react';

export default function AdminHashBridge(){
  useEffect(()=>{
    let tentativas=0;
    let timer;
    const abrir=()=>{
      const alvo=(location.hash||'#pedidos').slice(1);
      const mapa={pedidos:'Pedidos',financeiro:'Financeiro',cardapio:'Cardápio',cupons:'Cupons',config:'Configurações'};
      const texto=mapa[alvo];
      if(!texto)return;
      const botoes=[...document.querySelectorAll('.admin-v15-main .tabs button')];
      const botao=botoes.find(b=>b.textContent.trim().startsWith(texto));
      if(botao){botao.click();tentativas=0;return;}
      if(tentativas<12){tentativas+=1;timer=setTimeout(abrir,120);}
    };
    const aoHash=()=>{tentativas=0;clearTimeout(timer);abrir();};
    timer=setTimeout(abrir,120);
    window.addEventListener('hashchange',aoHash);
    document.addEventListener('click',(e)=>{
      const link=e.target.closest?.('a[href^="/admin#"]');
      if(!link)return;
      const hash=new URL(link.href,location.origin).hash;
      if(location.pathname==='/admin'&&location.hash===hash){
        e.preventDefault();
        history.replaceState(null,'',hash);
        aoHash();
      }
    });
    return()=>{clearTimeout(timer);window.removeEventListener('hashchange',aoHash);};
  },[]);
  return null;
}
