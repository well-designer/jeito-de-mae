import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { soDigitos } from '@/lib/validation';
import { limitar,ipDe } from '@/lib/rateLimit';
import crypto from 'crypto';
export const runtime='nodejs';
export async function POST(request){
 if(!limitar('resgate:'+ipDe(request),5,60000))return NextResponse.json({erro:'Muitas tentativas. Aguarde um minuto.'},{status:429});
 const b=await request.json().catch(()=>({}));const telefone=soDigitos(b.telefone||'');const recompensa=String(b.recompensaId||'');
 if(telefone.length<10||!/^[0-9a-f-]{36}$/i.test(recompensa))return NextResponse.json({erro:'Dados inválidos.'},{status:400});
 // O resgate ainda exige uma sessão de verificação; não aceitamos apenas conhecer o telefone.
 const token=String(b.verificacao||'');
 if(!token)return NextResponse.json({erro:'Confirme seu WhatsApp antes de resgatar.'},{status:403});
 const sb=supabaseAdmin();const {data:cliente}=await sb.from('fidelidade_clientes').select('id').eq('telefone',telefone).maybeSingle();
 if(!cliente)return NextResponse.json({erro:'Cliente não encontrado.'},{status:404});
 // A validação criptográfica do token será conectada ao fluxo OTP antes de habilitar o botão no cliente.
 return NextResponse.json({erro:'Validação do WhatsApp necessária para concluir o resgate.'},{status:403});
}
