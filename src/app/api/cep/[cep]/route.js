import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(_request, { params }) {
  const cep = String(params?.cep || '').replace(/\D/g, '').slice(0, 8);
  if (cep.length !== 8) {
    return NextResponse.json({ erro: 'CEP inválido.' }, { status: 400 });
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error('Falha ViaCEP');
    const data = await response.json();
    if (data?.erro) {
      return NextResponse.json({ erro: 'CEP não encontrado.' }, { status: 404 });
    }
    return NextResponse.json({
      cep: data.cep || cep,
      endereco: data.logradouro || '',
      bairro: data.bairro || '',
      cidade: data.localidade || '',
      uf: data.uf || '',
    });
  } catch {
    return NextResponse.json({ erro: 'Não foi possível consultar o CEP agora.' }, { status: 502 });
  }
}
