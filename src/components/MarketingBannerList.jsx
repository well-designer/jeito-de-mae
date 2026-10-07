'use client';
import { useState } from 'react';

export default function MarketingBannerList({iniciais=[]}){
 const [banners,setBanners]=useState(iniciais); const [busy,setBusy]=useState('');
 const alterar=async(id,acao)=>{setBusy(id+acao);try{const r=await fetch('/api/admin/banners/'+id,{method:acao==='excluir'?'DELETE':'PATCH',headers:{'Content-Type':'application/json'},body:acao==='excluir'?undefined:JSON.stringify({ativo:acao==='ativar'})});if(!r.ok)throw new Error();if(acao==='excluir')setBanners(x=>x.filter(b=>b.id!==id));else setBanners(x=>x.map(b=>b.id===id?{...b,ativo:acao==='ativar'}:b));}finally{setBusy('')}};
 if(!banners.length)return <div className="marketing-empty"><div>▧</div><h3>Seu primeiro banner começa aqui</h3><p>Divulgue feijoada, prato do dia, promoções ou novidades diretamente na página inicial.</p></div>;
 return <div className="banner-admin-list">{banners.map(b=><article key={b.id}><div className="banner-admin-thumb" style={b.imagem_url?{backgroundImage:`url("${b.imagem_url}")`}:undefined}>✦</div><div className="banner-admin-copy"><small>{b.kicker||'CAMPANHA'}</small><b>{b.titulo}</b><span>{b.ativo?'Ativo na loja':'Rascunho'} · prioridade {b.prioridade}</span></div><div className="banner-admin-actions"><button disabled={!!busy} onClick={()=>alterar(b.id,b.ativo?'desativar':'ativar')}>{b.ativo?'Desativar':'Ativar'}</button><button className="danger" disabled={!!busy} onClick={()=>alterar(b.id,'excluir')}>Excluir</button></div></article>)}</div>;
}
