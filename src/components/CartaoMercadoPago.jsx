'use client';

import { useEffect, useRef, useState } from 'react';

const SDK_URL = 'https://sdk.mercadopago.com/js/v2';

function carregarSdkMercadoPago() {
  return new Promise((resolve, reject) => {
    if (window.MercadoPago) {
      resolve();
      return;
    }

    const existente = document.querySelector(
      `script[src="${SDK_URL}"]`
    );

    if (existente) {
      existente.addEventListener('load', resolve, {
        once: true,
      });

      existente.addEventListener(
        'error',
        () =>
          reject(
            new Error(
              'Não foi possível carregar o Mercado Pago.'
            )
          ),
        { once: true }
      );

      return;
    }

    const script = document.createElement('script');

    script.src = SDK_URL;
    script.async = true;

    script.onload = () => resolve();

    script.onerror = () =>
      reject(
        new Error(
          'Não foi possível carregar o Mercado Pago.'
        )
      );

    document.head.appendChild(script);
  });
}

export default function CartaoMercadoPago({
  valor,
  desabilitado = false,
  onPagar,
  onErro,
}) {
  const containerRef = useRef(null);
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
    let cancelado = false;

    async function iniciar() {
      setCarregando(true);
      setErroLocal('');

      try {
        const publicKey =
          process.env
            .NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY;

        if (!publicKey) {
          throw new Error(
            'Chave pública do Mercado Pago não configurada.'
          );
        }

        const amount = Number(valor);

        if (
          !Number.isFinite(amount) ||
          amount <= 0
        ) {
          throw new Error(
            'Valor do pagamento inválido.'
          );
        }

        await carregarSdkMercadoPago();

        if (
          cancelado ||
          !containerRef.current
        ) {
          return;
        }

        if (controllerRef.current) {
          try {
            await controllerRef.current.unmount();
          } catch {}

          controllerRef.current = null;
        }

        containerRef.current.innerHTML = '';

        const mp = new window.MercadoPago(
          publicKey,
          {
            locale: 'pt-BR',
          }
        );

        const bricksBuilder = mp.bricks();

        const settings = {
          initialization: {
            amount,
          },

          customization: {
            paymentMethods: {
              creditCard: 'all',
              debitCard: 'none',
              ticket: 'none',
              bankTransfer: 'none',
              atm: 'none',
              onboarding_credits: 'none',
              mercadoPago: 'none',
            },
          },

          callbacks: {
            onReady: () => {
              if (!cancelado) {
                setCarregando(false);
              }
            },

            onSubmit: (
              formData,
              additionalData
            ) => {
              return new Promise(
                async (resolve, reject) => {
                  try {
                    if (desabilitado) {
                      throw new Error(
                        'Aguarde o processamento do pedido.'
                      );
                    }

                    const token =
                      formData?.token;

                    const paymentMethodId =
                      formData
                        ?.payment_method_id;

                    const paymentTypeId =
                      additionalData
                        ?.paymentTypeId ||
                      'credit_card';

                    const installments =
                      Number(
                        formData
                          ?.installments || 1
                      );

                    const email =
                      formData
                        ?.payer
                        ?.email;

                    const identification =
                      formData
                        ?.payer
                        ?.identification;

                    if (
                      !token ||
                      !paymentMethodId ||
                      !email
                    ) {
                      throw new Error(
                        'Confira os dados do cartão e tente novamente.'
                      );
                    }

                    await onPagarRef.current?.({
                      token,

                      payment_method_id:
                        paymentMethodId,

                      payment_type_id:
                        paymentTypeId,

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

                    resolve();
                  } catch (erro) {
                    const mensagem =
                      erro?.message ||
                      'Não foi possível processar o cartão.';

                    setErroLocal(mensagem);

                    onErroRef.current?.(
                      mensagem
                    );

                    reject(erro);
                  }
                }
              );
            },

            onError: (erro) => {
              console.error(
                '[Mercado Pago Brick]',
                erro
              );

              const mensagem =
                'Não foi possível carregar o formulário do cartão.';

              setErroLocal(mensagem);

              onErroRef.current?.(
                mensagem
              );
            },
          },
        };

        const controller =
          await bricksBuilder.create(
            'cardPayment',
            'cardPaymentBrick_container',
            settings
          );

        if (cancelado) {
          try {
            await controller.unmount();
          } catch {}

          return;
        }

        controllerRef.current =
          controller;
      } catch (erro) {
        console.error(
          '[Mercado Pago]',
          erro
        );

        if (!cancelado) {
          const mensagem =
            erro?.message ||
            'Não foi possível iniciar o pagamento com cartão.';

          setCarregando(false);
          setErroLocal(mensagem);

          onErroRef.current?.(
            mensagem
          );
        }
      }
    }

    iniciar();

    return () => {
      cancelado = true;

      const controller =
        controllerRef.current;

      controllerRef.current = null;

      if (controller) {
        Promise.resolve(
          controller.unmount()
        ).catch(() => {});
      }
    };
  }, [valor]);

  return (
    <div style={{ marginTop: 14 }}>
      {carregando && (
        <div
          className="alert"
          style={{
            marginBottom: 12,
          }}
        >
          Carregando pagamento seguro...
        </div>
      )}

      {erroLocal && (
        <div
          className="alert err"
          style={{
            marginBottom: 12,
          }}
        >
          {erroLocal}
        </div>
      )}

      <div
        id="cardPaymentBrick_container"
        ref={containerRef}
      />
    </div>
  );
}
