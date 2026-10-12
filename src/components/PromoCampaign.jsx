'use client';
import {useEffect,useState} from 'react';
export default function PromoCampaign({banners=[],produtos=[]}){
 const [open,setOpen]=useState(false);
 const banner=banners.find(b=>b.imagem_url&&b.titulo);
 const product=produtos.find(p=>p.ativo!==false&&p.foto_url&&p.destaque&&Array.isArray(p.opcoes)&&p.opcoes.length);
 const item=banner||(!banners.length?product:null);
 const key='jm-promo-seen-'+(item?.id||'');
 useEffect(()=>{if(!item)return;try{const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());if(localStorage.getItem(key)!==date)setOpen(true)}catch{}},[key,!!item]);
 useEffect(()=>{if(!open)return;const onKey=e=>{if(e.key==='Escape')close()};document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey)},[open]);
 function close(){setOpen(false);try{const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());localStorage.setItem(key,date)}catch{}}
 if(!open||!item)return null;
 const title=banner?.titulo||product?.nome||'';
 const photo=banner?.imagem_url||product?.foto_url;
 const prices=(!banner&&product?.opcoes?.length?product.opcoes:[]).map(o=>Number(o.preco)).filter(v=>Number.isFinite(v)&&v>0);
 const price=prices.length?Math.min(...prices):null;
 function cta(){close();const link=banner?.link;if(link&&link.startsWith('/')&&!link.startsWith('//')){window.location.assign(link)}else{document.getElementById('cardapio')?.scrollIntoView({behavior:'smooth'})}}
 return <div className="jm-live-promo-overlay" onClick={close}><section className="jm-live-promo" role="dialog" aria-modal="true" aria-labelledby="jm-live-promo-title" onClick={e=>e.stopPropagation()}><button className="jm-live-promo-close" onClick={close} aria-label="Fechar promoção">×</button><div className="jm-live-promo-copy"><small>✦ JEITO DE MÃE DELÍCIAS CASEIRAS ✦</small><p>Hoje tem sabor de casa!</p><h2 id="jm-live-promo-title">{title}</h2>{banner?.texto&&<p className="jm-live-promo-description">{banner.texto}</p>}</div><div className="jm-live-promo-photo"><img src={photo} alt={title}/>{price!=null&&Number.isFinite(price)&&<span>A partir de <strong>{price.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</strong></span>}</div><div className="jm-live-promo-bottom"><p>Preparado com carinho, especialmente para você ♡</p><button onClick={cta}>{banner?.cta||'Ver cardápio'} <span>→</span></button></div></section></div>
}