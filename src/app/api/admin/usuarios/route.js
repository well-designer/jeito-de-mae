import { NextResponse } from 'next/server';
import { exigirAdmin } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
const PAPEIS = ['proprietario','atendente','cozinha','entregador','sem_acesso'];

export async function GET() {
  if (!(await exigirAdmin())) return NextResponse.json({ erro:'nao autorizado' },{status:401});
  const sb=supabaseAdmin();
  const [{data:perfis,error},{data:auth}] = await Promise.all([
    sb.from('perfis').select('id,papel').order('papel'),
    sb.auth.admin.listUsers({page:1,perPage:200}),
  ]);
  if(error) return NextResponse.json({erro:'falha ao carregar usuarios'},{status:500});
  const usuarios=(perfis||[]).map(p=>{const u=auth?.users?.find(x=>x.id===p.id);return {id:p.id,papel:p.papel,email:u?.email||'',ultimo_acesso:u?.last_sign_in_at||null};});
  return NextResponse.json({usuarios});
}

export async function PATCH(request) {
  const atual=await exigirAdmin();
  if(!atual) return NextResponse.json({erro:'nao autorizado'},{status:401});
  const body=await request.json().catch(()=>({}));
  const id=String(body.id||''); const papel=String(body.papel||'');
  if(!/^[0-9a-f-]{36}$/i.test(id)||!PAPEIS.includes(papel)) return NextResponse.json({erro:'dados invalidos'},{status:400});
  if(id===atual.id && papel!=='proprietario' && papel!=='admin') return NextResponse.json({erro:'voce nao pode remover seu proprio acesso de proprietario'},{status:409});
  const sb=supabaseAdmin();
  if(papel!=='proprietario'){
    const {count}=await sb.from('perfis').select('id',{count:'exact',head:true}).in('papel',['proprietario','admin']);
    const {data:alvo}=await sb.from('perfis').select('papel').eq('id',id).maybeSingle();
    if((alvo?.papel==='proprietario'||alvo?.papel==='admin')&&(count||0)<=1) return NextResponse.json({erro:'a loja precisa manter pelo menos um proprietario'},{status:409});
  }
  const {data,error}=await sb.from('perfis').update({papel}).eq('id',id).select('id,papel').single();
  if(error) return NextResponse.json({erro:'falha ao atualizar permissao'},{status:500});
  return NextResponse.json({perfil:data});
}
