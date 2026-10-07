'use client';
import { useMemo, useState } from 'react';

const modelos={
  prato:{kicker:'DESTAQUE DE HOJE',titulo:'Comida com aquele sabor de casa.',texto:'Escolha seu prato favorito e peça sem sair daqui.',cta:'Ver cardápio'},
  feijoada:{kicker:'QUARTA É DIA DE FEIJOADA',titulo:'Feijoada com sabor de comida feita em casa.',texto:'Peça a sua e aproveite uma refeição completa, preparada com carinho.',cta:'Quero pedir'},
  fidelidade:{kicker:'CLUBE JEITO DE MÃE',titulo:'Seus pedidos vão valer ainda mais.',texto:'Peça, acumule pontos e aproveite recompensas especiais.',cta:'Conhecer fidelidade'}
};

export default function MarketingBannerBuilder(){
 const [aberto,setAberto]=useState(false); const [tipo,setTipo]=useState('prato'); const [salvando,setSalvando]=useState(false); const [aviso,setAviso]=useState('');
 const [form,setForm]=useState({...modelos.prato,link:'/',inicio:'',fim:'',prioridade:'1',imagem:''});
 const atualizar=(k,v)=>setForm(x=>({...x,[k]:v}));
 const aplicarModelo=(v)=>{setTipo(v);setForm(x=>({...x,...modelos[v]}));};
 const preview=useMemo(()=>form,[form]);
 const salvar=async()=>{setSalvando(true);setAviso('');try{const r=await fetch('/api/admin/banners',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});const j=await r.json();if(!r.ok)throw new Error(j.erro||'Não foi possível salvar');setAviso('Rascunho salvo.');}catch(e){setAviso(e.message)}finally{setSalvando(false)}};
 if(!aberto) return <button className="marketing-builder-open" type="button" onClick={()=>setAberto(true)}>+ Criar novo banner</button>;
 return <section className="banner-builder">
   <div className="banner-builder-head"><div><span>EDITOR DE BANNER</span><h2>Nova campanha</h2><p>Monte a campanha e confira a prévia antes de publicar.</p></div><button type="button" onClick={()=>setAberto(false)}>Fechar</button></div>
   <div className="banner-builder-grid">
    <div className="banner-form">
      <label>Objetivo<select value={tipo} onChange={e=>aplicarModelo(e.target.value)}><option value="prato">Prato do dia</option><option value="feijoada">Feijoada</option><option value="fidelidade">Fidelidade</option></select></label>
      <label>Chamada curta<input value={form.kicker} onChange={e=>atualizar('kicker',e.target.value)} maxLength={45}/></label>
      <label>Título<input value={form.titulo} onChange={e=>atualizar('titulo',e.target.value)} maxLength={90}/></label>
      <label>Texto<textarea value={form.texto} onChange={e=>atualizar('texto',e.target.value)} maxLength={180}/></label>
      <div className="banner-form-row"><label>Texto do botão<input value={form.cta} onChange={e=>atualizar('cta',e.target.value)} maxLength={28}/></label><label>Destino<input value={form.link} onChange={e=>atualizar('link',e.target.value)} placeholder="/"/></label></div>
      <label>Imagem do banner<input value={form.imagem} onChange={e=>atualizar('imagem',e.target.value)} placeholder="URL da imagem (opcional)"/></label>
      <div className="banner-form-row"><label>Início<input type="datetime-local" value={form.inicio} onChange={e=>atualizar('inicio',e.target.value)}/></label><label>Fim<input type="datetime-local" value={form.fim} onChange={e=>atualizar('fim',e.target.value)}/></label></div>
      <label>Prioridade<select value={form.prioridade} onChange={e=>atualizar('prioridade',e.target.value)}><option value="1">Normal</option><option value="2">Alta</option><option value="3">Principal</option></select></label>
      <div className="banner-form-actions"><button type="button" className="ai-draft" onClick={()=>aplicarModelo(tipo)}>✦ Sugerir texto com IA</button><button type="button" className="save-draft" disabled={salvando||!form.titulo.trim()} onClick={salvar}>{salvando?'Salvando...':'Salvar rascunho'}</button></div>
      {aviso&&<small className="banner-builder-feedback">{aviso}</small>}<small className="banner-builder-note">O banner é salvo inicialmente como rascunho e só aparecerá na loja depois de ser ativado.</small>
    </div>
    <div className="banner-preview-wrap"><span>PRÉVIA NA LOJA</span><div className="banner-preview" style={preview.imagem?{backgroundImage:`linear-gradient(90deg,rgba(94,18,28,.94),rgba(176,30,45,.65)),url("${preview.imagem}")`}:undefined}><small>{preview.kicker}</small><h3>{preview.titulo}</h3><p>{preview.texto}</p><b>{preview.cta} →</b></div><div className="banner-schedule"><b>Exibição</b><span>{preview.inicio||'Imediata'} → {preview.fim||'Sem data final'}</span></div></div>
   </div>
 </section>;
}
