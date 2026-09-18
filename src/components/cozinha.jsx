'use client';

import { useEffect, useState } from 'react';

const STATUS = {
  novo: 'Novo pedido',
  confirmado: 'Confirmado',
  preparo: 'Em preparo',
  entrega: 'Saiu para entrega',
  pronto_retirada: 'Pronto para retirada',
};

function proximoStatus(pedido) {
  if (pedido.status === 'novo') {
    return {
      status: 'confirmado',
      rotulo: 'Confirmar pedido',
    };
  }

  if (pedido.status === 'confirmado') {
    return {
      status: 'preparo',
      rotulo: 'Iniciar preparo',
    };
  }

  if (pedido.status === 'preparo') {
    if (pedido.tipo === 'retirada') {
      return {
        status: 'pronto_retirada',
        rotulo: 'Pedido pronto',
      };
    }

    return {
      status: 'entrega',
      rotulo: 'Saiu para entrega',
    };
  }

  if (
    pedido.status === 'entrega' ||
    pedido.status === 'pronto_retirada'
  ) {
    return {
      status: 'concluido',
      rotulo:
        pedido.tipo === 'retirada'
          ? 'Pedido retirado'
          : 'Pedido entregue',
    };
  }

  return null;
}

function tempoDesde(data) {
  if (!data) return '';

  const inicio = new Date(data).getTime();
  const agora = Date.now();

  if (!Number.isFinite(inicio)) {
    return '';
  }

  const minutos = Math.max(
    0,
    Math.floor((agora - inicio) / 60000)
  );

  if (minutos < 1) {
    return 'agora';
  }

  if (minutos < 60) {
    return `${minutos} min`;
  }

  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;

  if (!resto) {
    return `${horas}h`;
  }

  return `${horas}h ${resto}min`;
}

function tempoEtapa(pedido) {
  if (pedido.status === 'novo') {
    return `Aguardando há ${tempoDesde(pedido.criado_em)}`;
  }

  if (pedido.status === 'confirmado') {
    return `Confirmado há ${tempoDesde(
      pedido.confirmado_em || pedido.criado_em
    )}`;
  }

  if (pedido.status === 'preparo') {
    return `Em preparo há ${tempoDesde(
      pedido.preparo_em ||
        pedido.confirmado_em ||
        pedido.criado_em
    )}`;
  }

  if (pedido.status === 'entrega') {
    return `Saiu há ${tempoDesde(
      pedido.pronto_em ||
        pedido.preparo_em ||
        pedido.criado_em
    )}`;
  }

  if (pedido.status === 'pronto_retirada') {
    return `Pronto há ${tempoDesde(
      pedido.pronto_em ||
        pedido.preparo_em ||
        pedido.criado_em
    )}`;
  }

  return tempoDesde(pedido.criado_em);
}

function codigoPedido(codigo) {
  const texto = String(codigo || '').trim();
  return texto.startsWith('#') ? texto : `#${texto}`;
}

function brl(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export default function Cozinha({
  pedidosIniciais = [],
}) {
  const [pedidos, setPedidos] =
    useState(pedidosIniciais);

  const [agora, setAgora] =
    useState(Date.now());

  const [alterando, setAlterando] =
    useState(null);

  const [erro, setErro] =
    useState('');

  async function carregarPedidos() {
    try {
      const res = await fetch(
        '/api/admin/pedidos',
        {
          cache: 'no-store',
        }
      );

      if (!res.ok) {
        return;
      }

      const dados = await res.json();

      const ativos = (
        dados.pedidos || []
      )
        .filter(
          (p) =>
            ![
              'concluido',
              'cancelado',
            ].includes(p.status)
        )
        .sort(
          (a, b) =>
            new Date(a.criado_em) -
            new Date(b.criado_em)
        );

      setPedidos(ativos);
    } catch {
      // Mantém os pedidos atuais caso
      // uma atualização automática falhe.
    }
  }

  useEffect(() => {
    const atualizacao = setInterval(
      carregarPedidos,
      10000
    );

    return () =>
      clearInterval(atualizacao);
  }, []);

  useEffect(() => {
    const relogio = setInterval(
      () => setAgora(Date.now()),
      30000
    );

    return () =>
      clearInterval(relogio);
  }, []);

  async function avancarPedido(
    pedido,
    proximo
  ) {
    if (!proximo) return;

    const patch = {
      id: pedido.id,
      status: proximo.status,
    };

    if (
      proximo.status === 'concluido' &&
      pedido.pagamento === 'dinheiro' &&
      pedido.status_pagamento !== 'pago'
    ) {
      const recebeu = window.confirm(
        'O pagamento em dinheiro foi recebido?\n\nOK = Sim, marcar como pago\nCancelar = Ainda não'
      );

      if (recebeu) {
        patch.status_pagamento = 'pago';
      }
    }

    setAlterando(pedido.id);
    setErro('');

    try {
      const res = await fetch(
        '/api/admin/pedidos',
        {
          method: 'PATCH',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify(patch),
        }
      );

      if (!res.ok) {
        throw new Error();
      }

      const dados = await res.json();
      const pedidoAtualizado =
        dados.pedido || {
          ...pedido,
          ...patch,
        };

      if (
        proximo.status ===
        'concluido'
      ) {
        setPedidos((lista) =>
          lista.filter(
            (p) =>
              p.id !== pedido.id
          )
        );
      } else {
        setPedidos((lista) =>
          lista.map((p) =>
            p.id === pedido.id
              ? pedidoAtualizado
              : p
          )
        );
      }
    } catch {
      setErro(
        'Não foi possível atualizar o pedido.'
      );
    } finally {
      setAlterando(null);
    }
  }

  return (
    <main className="cozinha">
      <header className="cozinha-topo">
        <div>
          <span className="cozinha-marca">
            JEITO DE MÃE
          </span>

          <h1>Cozinha</h1>

          <p>
            Pedidos em produção
          </p>
        </div>

        <div className="cozinha-contador">
          <strong>
            {pedidos.length}
          </strong>

          <span>
            {pedidos.length === 1
              ? 'pedido ativo'
              : 'pedidos ativos'}
          </span>
        </div>
      </header>

      {erro && (
        <div className="cozinha-erro">
          {erro}
        </div>
      )}

      {pedidos.length === 0 ? (
        <div className="cozinha-vazia">
          <strong>
            Nenhum pedido em produção
          </strong>

          <span>
            Os novos pedidos aparecerão
            automaticamente aqui.
          </span>
        </div>
      ) : (
        <section className="cozinha-grid">
          {pedidos.map((pedido) => {
            const proximo =
              proximoStatus(pedido);

            return (
              <article
                className={`cozinha-card status-${pedido.status}`}
                key={pedido.id}
              >
                <div className="cozinha-card-topo">
                  <div>
                    <span className="pedido-codigo">
                      {codigoPedido(pedido.codigo)}
                    </span>

                    <span className="pedido-hora">
                      {new Date(
                        pedido.criado_em
                      ).toLocaleTimeString(
                        'pt-BR',
                        {
                          hour: '2-digit',
                          minute: '2-digit',
                        }
                      )}
                    </span>
                  </div>

                  <div className="pedido-tempo">
                    {agora && tempoEtapa(pedido)}
                  </div>
                </div>

                <div className="pedido-status">
                  {STATUS[
                    pedido.status
                  ] || pedido.status}
                </div>

                <div className="pedido-tipo">
                  {pedido.tipo ===
                  'retirada'
                    ? 'RETIRADA'
                    : 'ENTREGA'}
                </div>

                <div className="pedido-cliente">
                  <strong>
                    {pedido.cliente_nome}
                  </strong>

                  <span>
                    {pedido.cliente_telefone}
                  </span>
                </div>

                <div className="pedido-itens">
                  {(pedido.itens || []).map(
                    (item, indice) => (
                      <div
                        className="pedido-item"
                        key={indice}
                      >
                        <div className="pedido-item-principal">
                          <strong>
                            {item.qtd}×
                          </strong>

                          <div>
                            <b>
                              {item.nome}
                            </b>

                            {item.opcao && (
                              <span>
                                {item.opcao}
                              </span>
                            )}
                          </div>
                        </div>

                        {Array.isArray(
                          item.adicionais
                        ) &&
                          item.adicionais
                            .length >
                            0 && (
                            <div className="pedido-detalhe">
                              +{' '}
                              {item.adicionais
                                .map(
                                  (a) =>
                                    a.nome
                                )
                                .join(', ')}
                            </div>
                          )}

                        {typeof item.talher ===
                          'boolean' && (
                          <div className="pedido-detalhe">
                            Talher:{' '}
                            <b>
                              {item.talher
                                ? 'SIM'
                                : 'NÃO'}
                            </b>
                          </div>
                        )}

                        {item.obs && (
                          <div className="pedido-observacao">
                            Obs.: {item.obs}
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>

                {pedido.tipo ===
                  'entrega' &&
                  pedido.cliente_endereco && (
                    <div className="pedido-endereco">
                      <span>
                        Entregar em
                      </span>

                      <strong>
                        {
                          pedido.cliente_endereco
                        }
                      </strong>

                      {pedido.cliente_referencia && (
                        <small>
                          Ref.:{' '}
                          {
                            pedido.cliente_referencia
                          }
                        </small>
                      )}
                    </div>
                  )}

                <div className="pedido-rodape">
                  <div>
                    <span>Total</span>

                    <strong>
                      {brl(pedido.total)}
                    </strong>
                  </div>

                  {proximo && (
                    <button
                      type="button"
                      disabled={
                        alterando ===
                        pedido.id
                      }
                      onClick={() =>
                        avancarPedido(
                          pedido,
                          proximo
                        )
                      }
                    >
                      {alterando ===
                      pedido.id
                        ? 'Atualizando...'
                        : proximo.rotulo}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      <style jsx>{`
        .cozinha {
          min-height: 100vh;
          background: #f5f1ed;
          padding: 28px;
          color: #261b1d;
        }

        .cozinha-topo {
          max-width: 1400px;
          margin: 0 auto 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .cozinha-marca {
          display: block;
          color: #7b263d;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 1.5px;
          margin-bottom: 5px;
        }

        .cozinha-topo h1 {
          margin: 0;
          font-size: 32px;
          line-height: 1;
        }

        .cozinha-topo p {
          margin: 7px 0 0;
          color: #786f70;
        }

        .cozinha-contador {
          min-width: 130px;
          background: #fff;
          border: 1px solid #e8ded9;
          border-radius: 16px;
          padding: 13px 18px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .cozinha-contador strong {
          color: #7b263d;
          font-size: 27px;
        }

        .cozinha-contador span {
          max-width: 70px;
          color: #786f70;
          font-size: 12px;
          line-height: 1.2;
        }

        .cozinha-grid {
          max-width: 1400px;
          margin: auto;
          display: grid;
          grid-template-columns:
            repeat(
              auto-fill,
              minmax(330px, 1fr)
            );
          gap: 18px;
          align-items: start;
        }

        .cozinha-card {
          background: #fff;
          border: 1px solid #e5dbd7;
          border-top: 6px solid #7b263d;
          border-radius: 18px;
          overflow: hidden;
          box-shadow:
            0 6px 22px
            rgba(48, 30, 34, 0.06);
        }

        .status-preparo {
          border-top-color: #bc7425;
        }

        .status-entrega,
        .status-pronto_retirada {
          border-top-color: #39725a;
        }

        .cozinha-card-topo {
          padding: 18px 18px 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .pedido-codigo {
          display: block;
          font-size: 25px;
          font-weight: 900;
        }

        .pedido-hora {
          color: #786f70;
          font-size: 13px;
        }

        .pedido-tempo {
          background: #f5f1ed;
          border-radius: 100px;
          padding: 7px 11px;
          font-weight: 800;
          font-size: 13px;
        }

        .pedido-status {
          margin: 0 18px 9px;
          font-weight: 800;
          color: #7b263d;
        }

        .pedido-tipo {
          margin: 0 18px 16px;
          display: inline-block;
          background: #261b1d;
          color: white;
          border-radius: 7px;
          padding: 5px 9px;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.7px;
        }

        .pedido-cliente {
          border-top: 1px solid #eee7e3;
          border-bottom: 1px solid #eee7e3;
          padding: 13px 18px;
          display: flex;
          justify-content: space-between;
          gap: 10px;
        }

        .pedido-cliente span {
          color: #786f70;
          font-size: 13px;
        }

        .pedido-itens {
          padding: 6px 18px;
        }

        .pedido-item {
          padding: 13px 0;
          border-bottom: 1px dashed #ded4cf;
        }

        .pedido-item:last-child {
          border-bottom: 0;
        }

        .pedido-item-principal {
          display: flex;
          gap: 10px;
        }

        .pedido-item-principal > strong {
          font-size: 18px;
          color: #7b263d;
        }

        .pedido-item-principal div {
          display: flex;
          flex-direction: column;
        }

        .pedido-item-principal span {
          margin-top: 2px;
          color: #786f70;
          font-size: 12px;
        }

        .pedido-detalhe {
          margin: 6px 0 0 30px;
          font-size: 12.5px;
          color: #5f5657;
        }

        .pedido-observacao {
          margin: 8px 0 0 30px;
          background: #fff4dd;
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 12.5px;
          font-weight: 700;
        }

        .pedido-endereco {
          margin: 4px 18px 16px;
          background: #f7f3f0;
          border-radius: 11px;
          padding: 11px 13px;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .pedido-endereco span,
        .pedido-endereco small {
          color: #786f70;
          font-size: 11px;
        }

        .pedido-endereco strong {
          font-size: 13px;
        }

        .pedido-rodape {
          border-top: 1px solid #eee7e3;
          padding: 14px 18px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
        }

        .pedido-rodape > div {
          display: flex;
          flex-direction: column;
        }

        .pedido-rodape span {
          color: #786f70;
          font-size: 11px;
        }

        .pedido-rodape strong {
          font-size: 17px;
        }

        .pedido-rodape button {
          border: 0;
          border-radius: 11px;
          padding: 12px 16px;
          background: #7b263d;
          color: white;
          font-weight: 800;
          cursor: pointer;
        }

        .pedido-rodape button:disabled {
          opacity: 0.55;
          cursor: wait;
        }

        .cozinha-vazia {
          max-width: 1400px;
          margin: auto;
          min-height: 280px;
          background: #fff;
          border: 1px solid #e5dbd7;
          border-radius: 18px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 7px;
        }

        .cozinha-vazia strong {
          font-size: 20px;
        }

        .cozinha-vazia span {
          color: #786f70;
        }

        .cozinha-erro {
          max-width: 1400px;
          margin: 0 auto 16px;
          padding: 12px 15px;
          border-radius: 10px;
          background: #fff0f0;
          color: #9d2929;
          font-weight: 700;
        }

        @media (max-width: 700px) {
          .cozinha {
            padding: 18px 12px;
          }

          .cozinha-topo {
            align-items: flex-end;
          }

          .cozinha-topo h1 {
            font-size: 27px;
          }

          .cozinha-contador {
            min-width: auto;
            padding: 10px 13px;
          }

          .cozinha-contador strong {
            font-size: 22px;
          }

          .cozinha-contador span {
            display: none;
          }

          .cozinha-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
