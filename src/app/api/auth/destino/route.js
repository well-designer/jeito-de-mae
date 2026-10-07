import {NextResponse} from 'next/server';
import {exigirPapel} from '@/lib/supabaseServer';
export const dynamic='force-dynamic';
export async function GET(){const u=await exigirPapel(['admin','proprietario','atendente','cozinha','entregador']);if(!u)return NextResponse.json({destino:'/login'},{status:401});const destinos={admin:'/admin',proprietario:'/admin',atendente:'/atendimento',cozinha:'/cozinha',entregador:'/entregas'};return NextResponse.json({destino:destinos[u.papel]||'/login'});}