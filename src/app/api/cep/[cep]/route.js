import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function limpar(valor){return String(valor||'').replace(/\D/g,'').slice(0,8)}
function resposta(d,cep){return {cep:d.cep||cep,endereco:d.endereco||'',bairro:d.bairro||'',cidade:d.cidade||'',uf:d.uf||''}}

async function viaCep(cep){
 const r=await fetch(`https://viacep.com.br/ws/${cep}/json/`,{cache:'no-store',headers:{Accept:'application/json'},signal:AbortSignal.timeout(4500)});
 if(!r.ok)throw new Error('ViaCEP indisponível');const d=await r.json();if(d?.erro)return null;
 return resposta({cep:d.cep,endereco:d.logradouro,bairro:d.bairro,cidade:d.localidade,uf:d.uf},cep);
}
async function brasilApi(cep){
 const r=await fetch(`https://brasilapi.com.br/api/cep/v1/${cep}`,{cache:'no-store',headers:{Accept:'application/json'},signal:AbortSignal.timeout(4500)});
 if(r.status===404)return null;if(!r.ok)throw new Error('BrasilAPI indisponível');const d=await r.json();
 return resposta({cep:d.cep,endereco:d.street,bairro:d.neighborhood,cidade:d.city,uf:d.state},cep);
}

export async function GET(_request,{params}){
 const cep=limpar(params?.cep);if(cep.length!==8)return NextResponse.json({erro:'CEP inválido.'},{status:400});
 let encontrouNao=false;
 for(const consultar of [viaCep,brasilApi]){try{const d=await consultar(cep);if(d)return NextResponse.json(d);encontrouNao=true}catch{}}
 if(encontrouNao)return NextResponse.json({erro:'CEP não encontrado.'},{status:404});
 return NextResponse.json({erro:'Não foi possível consultar o CEP agora. Tente novamente em instantes.'},{status:502});
}
