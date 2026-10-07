import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const segredo = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization') || '';

  if (!segredo || auth !== `Bearer ${segredo}`) {
    return NextResponse.json(
      { erro: 'Não autorizado.' },
      { status: 401 }
    );
  }

  const { data, error } = await supabaseAdmin().rpc(
    'expirar_pontos_fidelidade'
  );

  if (error) {
    console.error('[cron] expirar fidelidade:', error);
    return NextResponse.json(
      { erro: 'Falha ao expirar pontos.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    expirados: Number(data || 0),
  });
}
