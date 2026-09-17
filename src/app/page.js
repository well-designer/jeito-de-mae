import { supabaseAdmin } from '@/lib/supabaseAdmin';
import Loja from '@/components/Loja';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Pagina publica. O cardapio e lido no SERVIDOR e entregue pronto ao
 * navegador - o visitante nunca fala com o banco direto.
 */
export default async function Home() {
  const sb = supabaseAdmin();

  const [{ data: config }, { data: produtos }] = await Promise.all([
    sb
      .from('config')
      .select('*')
      .eq('id', 1)
      .single(),

    sb
      .from('produtos')
      .select(`
        id,
        nome,
        descricao,
        categoria,
        opcoes,
        foto_url,
        destaque,
        ordem,
        dias_semana,
        adicionais,
        perguntar_talher
      `)
      .eq('ativo', true)
      .order('ordem'),
  ]);

  return (
    <Loja
      config={config || {}}
      produtos={produtos || []}
    />
  );
}
