'use client';

import { useEffect, useRef, useState } from 'react';

function carregarSdk() {
  if (window.MercadoPago) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existente = document.querySelector('script[data-jm-mp-sdk]');
    if (existente) {
      existente.addEventListener('load', resolve, { once: true });
      existente.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://sdk.mercadopago.com/js/v2';
    script.async = true;
    script.dataset.jmMpSdk = '1';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function MercadoPagoCard({
  amount,
  onReady,
  onError,
  onSubmit,
}) {
  const container = useRef(null);
  const brick = useRef(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;

    async function montar() {
      try {
        const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;

        if (!publicKey) {
          throw new Error('Pagamento por cartão indisponível no momento.');
        }

        await carregarSdk();
        if (!ativo || !container.current) return;

        const mp = new window.MercadoPago(publicKey, { locale: 'pt-BR' });
        const bricks = mp.bricks();

        brick.current = await bricks.create(
          'cardPayment',
          container.current,
          {
            initialization: {
              amount: Number(amount),
            },
            callbacks: {
              onReady: () => onReady?.(),
              onError: (error) => {
                console.error('[mercadopago] brick:', error);
                setErro('Não foi possível carregar o cartão.');
                onError?.(error);
              },
              onSubmit: (cardFormData) => {
                onSubmit?.(cardFormData);
              },
            },
          }
        );
      } catch (e) {
        console.error('[mercadopago] iniciar cartão:', e);
        const mensagem = e?.message || 'Não foi possível carregar o cartão.';
        setErro(mensagem);
        onError?.(e);
      }
    }

    montar();

    return () => {
      ativo = false;
      if (brick.current?.unmount) brick.current.unmount();
      brick.current = null;
    };
  }, [amount, onError, onReady, onSubmit]);

  return (
    <div className="mp-card-wrap">
      <div ref={container} />
      {erro && <small className="checkout-error">{erro}</small>}
    </div>
  );
}
