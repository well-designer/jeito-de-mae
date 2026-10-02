import { redirect } from 'next/navigation';
import { exigirAdmin } from '@/lib/supabaseServer';
import FinanceiroV15 from '@/components/FinanceiroV15';

export const dynamic = 'force-dynamic';

export default async function FinanceiroPage() {
  const user = await exigirAdmin();
  if (!user) redirect('/login');
  return <FinanceiroV15 />;
}
