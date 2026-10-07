'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
export default function LoyaltyRedeem({recompensa,onDone}){
 const [busy,setBusy]=useState(false),[msg,setMsg]=useState('');
 async function resgatar(){
  setBusy(true);setMsg('');
  try{
   const {data}=await supabaseBrowser().auth.getSession();if(!data.session)throw new Error('Valide seu e-mail para resgatar.');
   const r=await fetch('/api/fidelidade/resgatar',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:JSON.stringify({recompensaId:recompensa.id})});
   const d=await r.json();if(!r.ok)throw new Error(d.erro||'Não foi possível resgatar.');
   setMsg('Resgate realizado. Código: '+d.resgate.codigo);onDone?.();
  }catch(e){setMsg(e.message)}finally{setBusy(false)}
 }
 return <div className="loyalty-redeem"><button onClick={resgatar} disabled={busy}>{busy?'Resgatando...':'Resgatar'}</button>{msg&&<small className={msg.startsWith('Resgate realizado')?'ok':'err'}>{msg}</small>}</div>;
}
