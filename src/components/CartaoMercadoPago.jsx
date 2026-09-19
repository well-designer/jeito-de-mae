'use client';

import { useEffect, useRef, useState } from 'react';

const SDK_URL = 'https://sdk.mercadopago.com/js/v2';

function carregarMercadoPago() {
  if (typeof window === 'undefined') {
    return Promise.reject(
      new Error('Mercado Pago disponível apenas no navegador.')
    );
  }

  if (window.MercadoPago) {
    return Promise.resolve(window.MercadoPago);
  }

  if (window.__mercadoPagoSdkPromise) {
    return window.__mercadoPagoSdkPromise;
  }

  window.__mercadoPagoSdkPromise = new Promise(
    (resolve, reject) => {
      let script = document.querySelector(
        `script[src="${SDK_URL}"]`
      );

      const verificar = () => {
        if (window.MercadoPago) {
          resolve(window.MercadoPago);
        } else {
          window.__mercadoPagoSdkPromise = null;

          reject(
            new Error(
              'O SDK abriu, mas o Mercado Pago não foi inicializado.'
            )
          );
        }
      };

      if (script) {
        if (window.MercadoPago) {
          resolve(window.MercadoPago);
          return;
        }

        script.addEventListener('load', verificar, {
          once: true,
        });

        script.addEventListener(
          'error',
          () => {
            window.__mercadoPagoSdkPromise = null;

            reject(
              new Error(
                'Não foi possível carregar o SDK do Mercado Pago.'
              )
            );
          },
          { once: true }
        );

        return;
      }

      script = document.createElement('script');
      script.src = SDK_URL;
      script.async = true;
      script.crossOrigin = 'anonymous';

      script.addEventListener('load', verificar, {
        once: true,
      });

      script.addEventListener(
        'error',
        () => {
          window.__mercadoPagoSdkPromise = null;

          reject(
            new Error(
              'Não foi possível carregar o SDK do Mercado Pago.'
            )
          );
        },
        { once: true }
      );

      document.head.appendChild(script);
    }
  );

  return window.__mercadoPagoSdkPromise;
}

export default function CartaoMercadoPago({
  valor,
  desabilitado = false,
  onPagar,
  onErro,
}) {
  const controllerRef = useRef(null);
  const onPagarRef = useRef(onPagar);
  const onErroRef = useRef(onErro);

  const [carregando, setCarregando] = useState(true);
  const [erroLocal, setErroLocal] = useState('');

  useEffect(() => {
    onPagarRef.current = onPagar;
  }, [onPagar]);

  useEffect(() => {
    onErroRef.current = onErro;
  }, [onErro]);

  useEffect(() => {
    let ativo = true;

    async function iniciar() {
      setCarregando(true);
      setErroLocal('');

      try {
        const publicKey =
          process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY;

        if (!publicKey) {
          throw new Error(
            'A chave pública do Mercado Pago não está configurada.'
          );
        }

        const amount = Number(valor);

        if (!Number.isFinite(amount) || amount <= 0) {
          throw new Error(
            'O valor do pagamento precisa ser maior que zero.'
          );
        }

        await carregarMercadoPago();

        if (!ativo) return;

        if (!window.MercadoPago) {
          throw new Error(
            'O Mercado Pago não foi disponibilizado pelo SDK.'
          );
        }

        const mp = new window.MercadoPago(publicKey, {
          locale: 'pt-BR',
        });

        const bricksBuilder = mp.bricks();

        const controller = await bricksBuilder.create(
          'cardPayment',
          'cardPaymentBrick_container',
          {
            initialization: {
              amount: Number(amount.toFixed(2)),
            },

            callbacks: {
              onReady: () => {
                if (!ativo) return;

                setCarregando(false);
                setErroLocal('');
              },

              onSubmit: async (
                formData,
                additionalData
              ) => {
                try {
                  if (desabilitado) {
                    throw new Error(
                      'Aguarde o processamento do pedido.'
                    );
                  }

                  const token = formData?.token;

                  const paymentMethodId =
                    formData?.payment_method_id;

                  const paymentTypeId =
                    additionalData?.paymentTypeId ||
                    'credit_card';

                  const installments = Number(
                    formData?.installments || 1
                  );

                  const email =
                    formData?.payer?.email;

                  const identification =
                    formData?.payer?.identification;

                  if (
                    paymentTypeId !== 'credit_card'
                  ) {
                    throw new Error(
                      'Utilize um cartão de crédito.'
                    );
                  }

                  if (
                    !token ||
                    !paymentMethodId ||
                    !email
                  ) {
                    throw new Error(
                      'Confira os dados do cartão e tente novamente.'
                    );
                  }

                  setErroLocal('');

                  if (!onPagarRef.current) {
                    throw new Error(
                      'Não foi possível enviar o pagamento.'
                    );
                  }

                  await onPagarRef.current({
                    token,

                    payment_method_id:
                      paymentMethodId,

                    payment_type_id:
                      'credit_card',

                    installments,

                    email,

                    identification:
                      identification?.type &&
                      identification?.number
                        ? {
                            type:
                              identification.type,

                            number:
                              identification.number,
                          }
                        : null,
                  });
                } catch (erro) {
                  const mensagem =
                    erro?.message ||
                    'Não foi possível processar o cartão.';

                  if (ativo) {
                    setErroLocal(mensagem);
                  }

                  onErroRef.current?.(mensagem);

                  throw erro;
                }
              },

              onError: (erro) => {
                console.error(
                  '[Mercado Pago Brick]',
                  erro
                );

                if (!ativo) return;

                const mensagem =
                  'Não foi possível abrir o formulário do cartão.';

                setCarregando(false);
                setErroLocal(mensagem);

                onErroRef.current?.(mensagem);
              },
            },
          }
        );

        if (!ativo) {
          try {
            await controller.unmount();
          } catch {}

          return;
        }

        controllerRef.current = controller;
      } catch (erro) {
        console.error(
          '[Mercado Pago]',
          erro
        );

        if (!ativo) return;

        const mensagem =
          erro?.message ||
          'Não foi possível iniciar o pagamento com cartão.';

        setCarregando(false);
        setErroLocal(mensagem);

        onErroRef.current?.(mensagem);
      }
    }

    iniciar();

    return () => {
      ativo = false;

      const controller =
        controllerRef.current;

      controllerRef.current = null;

      if (controller) {
        try {
          const resultado = controller.unmount();

          if (resultado?.catch) {
            resultado.catch(() => {});
          }
        } catch {}
      }
    };
  }, [valor]);

  return (
    <div style={{ marginTop: 14 }}>
      {carregando && (
        <div
          className="alert"
          style={{ marginBottom: 12 }}
        >
          Carregando pagamento seguro...
        </div>
      )}

      {erroLocal && (
        <div
          className="alert err"
          style={{ marginBottom: 12 }}
        >
          {erroLocal}
        </div>
      )}

      <div id="cardPaymentBrick_container" />
    </div>
  );
}
