import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

    if (!url) {
      return NextResponse.json(
        {
          ok: false,
          erro: 'NEXT_PUBLIC_SUPABASE_URL nao configurada',
        },
        { status: 500 }
      );
    }

    const hostname = new URL(url).hostname;
    const projectRef = hostname.split('.')[0];

    return NextResponse.json({
      ok: true,
      supabaseProject: projectRef,
      hostname,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        erro: 'URL do Supabase invalida',
      },
      { status: 500 }
    );
  }
}
