import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

async function usuario(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  const verifier = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user } } = await verifier.auth.getUser(token);
  return user || null;
}

export async function GET(request) {
  const user = await usuario(request);
  if (!user) return NextResponse.json({ erro: 'Entre na sua conta para ver seus pedidos.' }, { status: 401 });

  const { data, error } = await supabaseAdmin()
    .from('pedidos')
    .select('id,codigo,status,status_pagamento,tipo,pagamento,total,itens,cliente_endereco,criado_em,confirmado_em,preparo_em,pronto_em,saiu_entrega_em,chegou_entrega_em,concluido_em')
    .eq('auth_user_id', user.id)
    .order('criado_em', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[minha-conta] pedidos:', error);
    return NextResponse.json({ erro: 'Não foi possível carregar seus pedidos.' }, { status: 500 });
  }

  return NextResponse.json({ pedidos: data || [] });
}
