import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// A chave VAPID publica e destinada ao navegador. Nunca retornar a chave privada.
export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || '';
  if (!publicKey) {
    return NextResponse.json({ erro: 'Notificações indisponíveis.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json({ publicKey }, { headers: { 'Cache-Control': 'no-store' } });
}
