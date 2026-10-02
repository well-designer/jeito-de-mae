'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

export default function CozinhaSync() {
  const router = useRouter();

  useEffect(() => {
    const supabase = supabaseBrowser();

    const atualizar = () => {
      router.refresh();
    };

    const recarregar = () => {
      window.location.reload();
    };

    // Tenta atualização leve via Realtime sempre que pedidos mudarem.
    const canal = supabase
      .channel('cozinha-pedidos')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pedidos',
        },
        atualizar
      )
      .subscribe();

    // Fallback independente do Realtime/RLS: recarrega a página periodicamente.
    // Assim a lista sempre volta a ser lida no servidor com service_role.
    const fallback = window.setInterval(recarregar, 10000);

    const aoVoltar = () => {
      if (document.visibilityState === 'visible') recarregar();
    };

    document.addEventListener('visibilitychange', aoVoltar);

    return () => {
      window.clearInterval(fallback);
      document.removeEventListener('visibilitychange', aoVoltar);
      supabase.removeChannel(canal);
    };
  }, [router]);

  return null;
}
