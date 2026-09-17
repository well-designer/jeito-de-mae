import { NextResponse } from 'next/server';
import { supabaseSSR } from '@/lib/supabaseServer';

export async function POST(request) {
  await supabaseSSR().auth.signOut();
  return NextResponse.redirect(new URL('/login', request.url), { status: 303 });
}
