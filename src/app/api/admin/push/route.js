import { NextResponse } from 'next/server';
import { exigirAdmin } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { enviarPushTeste } from '@/lib/push';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await exigirAdmin())) {
    return NextResponse.json(
      { erro: 'nao autorizado' },
      { status: 401 }
    );
  }

  const publicKey =
    process.env.VAPID_PUBLIC_KEY;

  if (!publicKey) {
    return NextResponse.json(
      { erro: 'VAPID nao configurado' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    publicKey,
  });
}

export async function POST(request) {
  if (!(await exigirAdmin())) {
    return NextResponse.json(
      { erro: 'nao autorizado' },
      { status: 401 }
    );
  }

  const body = await request
    .json()
    .catch(() => ({}));

  const subscription = body.subscription;

  const endpoint =
    subscription?.endpoint;

  const p256dh =
    subscription?.keys?.p256dh;

  const auth =
    subscription?.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { erro: 'inscricao invalida' },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin()
    .from('push_subscriptions')
    .upsert(
      {
        endpoint,
        p256dh,
        auth,
        atualizado_em:
          new Date().toISOString(),
      },
      {
        onConflict: 'endpoint',
      }
    );

  if (error) {
    console.error(
      '[push] erro ao salvar inscricao',
      error
    );

    return NextResponse.json(
      { erro: 'falha ao salvar inscricao' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
  });
}
