import { NextResponse } from 'next/server';
import { exigirAdmin } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];
const MAX = 6 * 1024 * 1024; // 6 MB

export async function POST(request) {
  if (!(await exigirAdmin())) return NextResponse.json({ erro: 'nao autorizado' }, { status: 401 });

  const form = await request.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ erro: 'arquivo ausente' }, { status: 400 });
  }
  if (!TIPOS.includes(file.type)) {
    return NextResponse.json({ erro: 'Use JPG, PNG ou WebP' }, { status: 415 });
  }
  if (file.size > MAX) {
    return NextResponse.json({ erro: 'Imagem acima de 6 MB' }, { status: 413 });
  }

  const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
  const nome = `${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const sb = supabaseAdmin();
  const { error } = await sb.storage.from('produtos').upload(nome, buffer, {
    contentType: file.type,
    upsert: false,
  });
  if (error) return NextResponse.json({ erro: 'falha no upload' }, { status: 500 });

  const { data } = sb.storage.from('produtos').getPublicUrl(nome);
  return NextResponse.json({ url: data.publicUrl });
}
