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

    // Atualiza assim que a tela abre para evitar dados antigos do primeiro render.
    atualizar();

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

    // Fallback: mesmo que o Realtime seja interrompido pelo navegador/rede,
    // a cozinha se reconcilia periodicamente com o servidor.
    const fallback = window.setInterval(atualizar, 10000);

    const aoVoltar = () => {
      if (document.visibilityState === 'visible') atualizar();
    };

    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('focus', atualizar);

    return () => {
      window.clearInterval(fallback);
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('focus', atualizar);
      supabase.removeChannel(canal);
    };
  }, [router]);

  return null;
}
