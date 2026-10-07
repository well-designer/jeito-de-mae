import { redirect } from 'next/navigation';
import { exigirAdmin } from '@/lib/supabaseServer';
import UsuariosAdmin from '@/components/UsuariosAdmin';
export const dynamic='force-dynamic';
export default async function UsuariosPage(){const user=await exigirAdmin();if(!user)redirect('/login');return <UsuariosAdmin/>;}
