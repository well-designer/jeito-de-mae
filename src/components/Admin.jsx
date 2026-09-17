'use client';

import { useEffect, useState } from 'react';
import { brl, CATEGORIAS } from '@/lib/format';
import IconePrato from './IconePrato';
import IconeImagem from './IconeImagem';

const VAZIO = {
  nome: '', descricao: '', categoria: 'Prato do dia',
  opcoes: [{ nome: 'Individual', preco: 0, precoDe: '' }],
  dias_semana: ['segunda','terca','quarta','quinta','sexta','sabado','domingo'],
  adicionais: [], perguntar_talher: false,
  foto_url: null, ativo: true, destaque: false, ordem: 0,
};

const CUPOM_VAZIO = {
  codigo: '',
  descricao: '',
  tipo: 'percentual',
  valor: 10,
  primeira_compra: false,
  limite_usos: '',
  valido_de: '',
  valido_ate: '',
  ativo: true,
};

function dataParaInput(valor) {
  if (!valor) return '';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Admin({ configInicial, produtosIniciais, pedidosIniciais, email }) {
  const [config, setConfig] = useState(configInicial);
  const [produtos, setProdutos] = useState(produtosIniciais);
  const [pedidos, setPedidos] = useState(pedidosIniciais);
  const [aba, setAba] = useState('pedidos');
  const [editando, setEditando] = useState(null);
  const [toast, setToast] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [periodo, setPeriodo] = useState('semana');
  const [relatorio, setRelatorio] = useState(null);
  const [carregandoRel, setCarregandoRel] = useState(false);

  const [cupons, setCupons] = useState([]);
  const [editandoCupom, setEditandoCupom] = useState(null);
  const [carregandoCupons, setCarregandoCupons] = useState(false);
  const [salvandoCupom, setSalvandoCupom] = useState(false);

  function avisar(m) {
    setToast(m);
    setTimeout(() => setToast(''), 2200);
  }

  // Atualiza a lista de pedidos a cada 20s
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const r = await fetch('/api/admin/pedidos', { cache: 'no-store' });
        if (r.ok) setPedidos((await r.json()).pedidos);
      } catch {}
    }, 20000);

    return () => clearInterval(t);
  }, []);

  async function salvarConfig(patch) {
    const novo = { ...config, ...patch };
    setConfig(novo);

    const res = await fetch('/api/admin/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aberto: !!novo.aberto,
        prato_do_dia: novo.prato_do_dia || '',
        recado: novo.recado || '',
        mensagem_fechado: novo.mensagem_fechado || '',
        horario: novo.horario || '',
        tempo_entrega: novo.tempo_entrega || '',
        taxa_entrega: Number(novo.taxa_entrega) || 0,
        banner_url: novo.banner_url || null,
        nota_media:
          novo.nota_media === '' || novo.nota_media == null
            ? null
            : Number(novo.nota_media),
        total_avaliacoes: Number(novo.total_avaliacoes) || 0,
      }),
    });

    if (!res.ok) avisar('Não foi possível salvar');
  }

  async function atualizarPedido(id, patch) {
    setPedidos((ps) =>
      ps.map((p) => (p.id === id ? { ...p, ...patch } : p))
    );

    const res = await fetch('/api/admin/pedidos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    });

    if (!res.ok) avisar('Falha ao atualizar o pedido');
  }

  async function salvarProduto() {
    const p = editando;

    if (!p.nome.trim()) {
      return avisar('Dê um nome ao item');
    }

    const opcoes = p.opcoes
      .filter((o) => String(o.nome).trim())
      .map((o) => {
        const preco =
          Number(String(o.preco).replace(',', '.')) || 0;

        const precoDeNum =
          Number(String(o.precoDe ?? '').replace(',', '.')) || 0;

        return {
          nome: String(o.nome).trim(),
          preco,
          ...(precoDeNum > preco
            ? { precoDe: precoDeNum }
            : {}),
        };
      });

    if (!opcoes.length) {
      return avisar('Informe ao menos um tamanho e preço');
    }

    setSalvando(true);

    const res = await fetch('/api/admin/produtos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(p.id ? { id: p.id } : {}),
        nome: p.nome.trim(),
        descricao: (p.descricao || '').trim(),
        categoria: p.categoria,
        opcoes,

        dias_semana:
          Array.isArray(p.dias_semana) &&
          p.dias_semana.length
            ? p.dias_semana
            : [],

        adicionais: (p.adicionais || [])
          .filter((a) =>
            String(a.nome || '').trim()
          )
          .map((a) => ({
            nome: String(a.nome).trim(),
            preco:
              Number(
                String(a.preco ?? 0).replace(',', '.')
              ) || 0,
          })),

        perguntar_talher: !!p.perguntar_talher,
        foto_url: p.foto_url || null,
        ativo: p.ativo !== false,
        destaque: !!p.destaque,
        ordem: Number(p.ordem) || 0,
      }),
    });

    setSalvando(false);

    const d = await res.json();

    if (!res.ok) {
      return avisar(d.erro || 'Falha ao salvar');
    }

    setProdutos((lista) => {
      const existe = lista.some(
        (x) => x.id === d.produto.id
      );

      return existe
        ? lista.map((x) =>
            x.id === d.produto.id
              ? d.produto
              : x
          )
        : [...lista, d.produto];
    });

    setEditando(null);
    avisar('Item salvo');
  }

  async function excluirProduto(id) {
    if (!confirm('Excluir este item do cardápio?')) {
      return;
    }

    await fetch(`/api/admin/produtos?id=${id}`, {
      method: 'DELETE',
    });

    setProdutos((l) =>
      l.filter((x) => x.id !== id)
    );

    setEditando(null);
    avisar('Item excluído');
  }

  async function enviarFoto(file) {
    if (!file) return;

    avisar('Enviando foto...');

    const fd = new FormData();
    fd.append('file', file);

    const res = await fetch('/api/admin/upload', {
      method: 'POST',
      body: fd,
    });

    const d = await res.json();

    if (!res.ok) {
      return avisar(d.erro || 'Falha no upload');
    }

    setEditando((p) => ({
      ...p,
      foto_url: d.url,
    }));

    avisar('Foto atualizada');
  }

  async function enviarBanner(file) {
    if (!file) return;

    avisar('Enviando banner...');

    const fd = new FormData();
    fd.append('file', file);

    const res = await fetch('/api/admin/upload', {
      method: 'POST',
      body: fd,
    });

    const d = await res.json();

    if (!res.ok) {
      return avisar(d.erro || 'Falha no upload');
    }

    await salvarConfig({
      banner_url: d.url,
    });

    avisar('Banner atualizado');
  }

  // Carrega o relatório
  useEffect(() => {
    if (aba !== 'financeiro') return;

    let ativo = true;

    setCarregandoRel(true);

    fetch(
      `/api/admin/relatorio?periodo=${periodo}`,
      { cache: 'no-store' }
    )
      .then((r) => r.json())
      .then((d) => {
        if (ativo) {
          setRelatorio(d.relatorio || null);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (ativo) {
          setCarregandoRel(false);
        }
      });

    return () => {
      ativo = false;
    };
  }, [aba, periodo]);

  // Carrega os cupons quando a aba for aberta
  useEffect(() => {
    if (aba !== 'cupons') return;

    let ativo = true;

    setCarregandoCupons(true);

    fetch('/api/admin/cupons', {
      cache: 'no-store',
    })
      .then(async (r) => {
        const d = await r.json();

        if (!r.ok) {
          throw new Error(
            d.erro || 'Falha ao carregar cupons'
          );
        }

        if (ativo) {
          setCupons(d.cupons || []);
        }
      })
      .catch((e) => {
        if (ativo) {
          avisar(
            e.message ||
              'Falha ao carregar cupons'
          );
        }
      })
      .finally(() => {
        if (ativo) {
          setCarregandoCupons(false);
        }
      });

    return () => {
      ativo = false;
    };
  }, [aba]);

  async function salvarCupom() {
    const c = editandoCupom;

    if (!c) return;

    const codigo = String(
      c.codigo || ''
    )
      .trim()
      .toUpperCase();

    if (codigo.length < 3) {
      return avisar(
        'Informe um código com pelo menos 3 caracteres'
      );
    }

    const valor = Number(
      String(c.valor ?? '').replace(',', '.')
    );

    if (
      !Number.isFinite(valor) ||
      valor <= 0
    ) {
      return avisar(
        'Informe o valor do desconto'
      );
    }

    if (
      c.tipo === 'percentual' &&
      valor > 100
    ) {
      return avisar(
        'O percentual não pode passar de 100%'
      );
    }

    const limiteTexto = String(
      c.limite_usos ?? ''
    ).trim();

    const limite =
      limiteTexto === ''
        ? null
        : Number(limiteTexto);

    if (
      limite !== null &&
      (
        !Number.isInteger(limite) ||
        limite < 1
      )
    ) {
      return avisar(
        'O limite de usos deve ser um número inteiro maior que zero'
      );
    }

    let validoDe = null;
    let validoAte = null;

    if (c.valido_de) {
      const d = new Date(c.valido_de);

      if (Number.isNaN(d.getTime())) {
        return avisar(
          'Data inicial inválida'
        );
      }

      validoDe = d.toISOString();
    }

    if (c.valido_ate) {
      const d = new Date(c.valido_ate);

      if (Number.isNaN(d.getTime())) {
        return avisar(
          'Data final inválida'
        );
      }

      validoAte = d.toISOString();
    }

    if (
      validoDe &&
      validoAte &&
      new Date(validoAte) <=
        new Date(validoDe)
    ) {
      return avisar(
        'A data final deve ser posterior à data inicial'
      );
    }

    setSalvandoCupom(true);

    try {
      const res = await fetch(
        '/api/admin/cupons',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            ...(c.id
              ? { id: c.id }
              : {}),

            codigo,

            descricao: String(
              c.descricao || ''
            ).trim(),

            tipo: c.tipo,

            valor,

            primeira_compra:
              !!c.primeira_compra,

            limite_usos: limite,

            valido_de: validoDe,

            valido_ate: validoAte,

            ativo:
              c.ativo !== false,
          }),
        }
      );

      const d = await res.json();

      if (!res.ok) {
        return avisar(
          d.erro ||
            'Falha ao salvar cupom'
        );
      }

      setCupons((lista) => {
        const existe = lista.some(
          (x) =>
            x.id === d.cupom.id
        );

        return existe
          ? lista.map((x) =>
              x.id === d.cupom.id
                ? d.cupom
                : x
            )
          : [d.cupom, ...lista];
      });

      setEditandoCupom(null);

      avisar('Cupom salvo');
    } catch {
      avisar(
        'Falha ao salvar cupom'
      );
    } finally {
      setSalvandoCupom(false);
    }
  }

  async function excluirCupom(id) {
    if (
      !confirm(
        'Excluir este cupom? O código deixará de funcionar.'
      )
    ) {
      return;
    }

    const res = await fetch(
      `/api/admin/cupons?id=${id}`,
      {
        method: 'DELETE',
      }
    );

    const d = await res
      .json()
      .catch(() => ({}));

    if (!res.ok) {
      return avisar(
        d.erro ||
          'Falha ao excluir cupom'
      );
    }

    setCupons((lista) =>
      lista.filter(
        (x) => x.id !== id
      )
    );

    setEditandoCupom(null);

    avisar('Cupom excluído');
  }

  const novos = pedidos.filter(
    (p) => p.status === 'novo'
  ).length;

  return (
    <div className="admin-wrap">

      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div
          className="logo"
          style={{
            background: 'var(--brand)',
            color: '#fff',
          }}
        >
          JM
        </div>

        <div style={{ flex: 1 }}>
          <h1
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 22,
              margin: 0,
            }}
          >
            Painel da loja
          </h1>

          <small
            style={{
              color: 'var(--muted)',
            }}
          >
            {email}
          </small>
        </div>

        <a
          className="mini"
          href="/"
        >
          Ver site
        </a>

        <form
          action="/auth/signout"
          method="post"
        >
          <button
            className="mini"
            type="submit"
          >
            Sair
          </button>
        </form>
      </header>

      <div className="switch">
        <button
          className={`track ${
            config.aberto
              ? 'on'
              : ''
          }`}
          onClick={() =>
            salvarConfig({
              aberto:
                !config.aberto,
            })
          }
        >
          <span className="knob" />
        </button>

        <div style={{ flex: 1 }}>
          <b>
            {config.aberto
              ? 'Loja aberta'
              : 'Loja fechada'}
          </b>

          <br />

          <small
            style={{
              color: 'var(--muted)',
            }}
          >
            {config.aberto
              ? 'Os clientes conseguem fazer pedidos agora.'
              : 'Ninguém consegue finalizar pedidos.'}
          </small>
        </div>
      </div>

      <div className="tabs">
        {[
          [
            'pedidos',
            `Pedidos${
              novos
                ? ` (${novos})`
                : ''
            }`,
          ],
          [
            'financeiro',
            'Financeiro',
          ],
          [
            'cardapio',
            'Cardápio',
          ],
          [
            'cupons',
            'Cupons',
          ],
          [
            'config',
            'Configurações',
          ],
        ].map(
          ([id, label]) => (
            <button
              key={id}
              className={
                aba === id
                  ? 'active'
                  : ''
              }
              onClick={() =>
                setAba(id)
              }
            >
              {label}
            </button>
          )
        )}
      </div>

      {/* PEDIDOS */}

      {aba === 'pedidos' && (
        pedidos.length === 0
          ? (
            <div className="empty">
              Nenhum pedido ainda.
            </div>
          )
          : pedidos.map((p) => {
              const prox = {
                novo: 'confirmado',
                confirmado: 'preparo',
                preparo:
                  p.tipo === 'retirada'
                    ? 'pronto_retirada'
                    : 'entrega',
                entrega: 'concluido',
                pronto_retirada: 'concluido',
              }[p.status];

              const rotulo = {
                confirmado: 'Confirmar pedido',
                preparo: 'Iniciar preparo',
                entrega: 'Saiu para entrega',
                pronto_retirada: 'Pronto para retirada',
                concluido: 'Marcar concluído',
              }[prox];

              const statusRotulo = {
                novo: 'Novo pedido',
                confirmado: 'Confirmado',
                preparo: 'Em preparo',
                entrega: 'Saiu para entrega',
                pronto_retirada: 'Pronto para retirada',
                concluido: 'Concluído',
                cancelado: 'Cancelado',
              }[p.status] || p.status;

              return (
                <div
                  className="ped"
                  key={p.id}
                >
                  <div className="ped-top">
                    <span className="code">
                      {p.codigo}
                    </span>

                    <span
                      className={`chip ${p.status}`}
                    >
                      {statusRotulo}
                    </span>

                    <span
                      className={`chip ${
                        p.status_pagamento ===
                        'pago'
                          ? 'pago'
                          : 'pendente'
                      }`}
                    >
                      {p.pagamento} ·{' '}
                      {
                        p.status_pagamento
                      }
                    </span>

                    <span
                      style={{
                        marginLeft:
                          'auto',
                        fontWeight: 800,
                      }}
                    >
                      {brl(p.total)}
                    </span>
                  </div>

                  <div className="ped-items">
                    {(p.itens || []).map(
                      (i, ix) => (
                        <div key={ix}>
                          {i.qtd}×{' '}
                          {i.nome}{' '}

                          <span
                            style={{
                              color:
                                'var(--muted)',
                            }}
                          >
                            ({i.opcao})
                          </span>

                          {Array.isArray(
                            i.adicionais
                          ) &&
                            i.adicionais
                              .length >
                              0 && (
                              <div
                                style={{
                                  color:
                                    'var(--muted)',
                                }}
                              >
                                ↳ Adicionais:{' '}
                                {i.adicionais
                                  .map(
                                    (a) =>
                                      `${a.nome}${
                                        Number(
                                          a.preco
                                        ) >
                                        0
                                          ? ` (+${brl(
                                              a.preco
                                            )})`
                                          : ''
                                      }`
                                  )
                                  .join(
                                    ', '
                                  )}
                              </div>
                            )}

                          {typeof i.talher ===
                            'boolean' && (
                            <div
                              style={{
                                color:
                                  'var(--muted)',
                              }}
                            >
                              ↳ Talher:{' '}
                              {i.talher
                                ? 'Sim'
                                : 'Não'}
                            </div>
                          )}

                          {i.obs && (
                            <div
                              style={{
                                color:
                                  'var(--muted)',
                              }}
                            >
                              ↳ {i.obs}
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>

                  {Number(
                    p.desconto || 0
                  ) > 0 && (
                    <div
                      className="alert"
                      style={{
                        marginTop: 10,
                      }}
                    >
                      <b>
                        Cupom{' '}
                        {p.cupom_codigo ||
                          'aplicado'}
                      </b>{' '}
                      · desconto de{' '}
                      {brl(p.desconto)}

                      <div
                        style={{
                          fontSize: 12,
                          marginTop: 3,
                        }}
                      >
                        Subtotal{' '}
                        {brl(
                          p.subtotal
                        )}{' '}
                        + entrega{' '}
                        {brl(p.taxa)} −
                        desconto{' '}
                        {brl(
                          p.desconto
                        )}{' '}
                        = {brl(p.total)}
                      </div>
                    </div>
                  )}

                  <dl>
                    <div>
                      <dt>Cliente</dt>
                      <dd>
                        {
                          p.cliente_nome
                        }
                      </dd>
                    </div>

                    <div>
                      <dt>Telefone</dt>
                      <dd>
                        {
                          p.cliente_telefone
                        }
                      </dd>
                    </div>

                    {p.tipo ===
                    'entrega' ? (
                      <>
                        <div>
                          <dt>
                            Endereço
                          </dt>
                          <dd>
                            {
                              p.cliente_endereco
                            }
                          </dd>
                        </div>

                        <div>
                          <dt>
                            Referência
                          </dt>
                          <dd>
                            {p.cliente_referencia ||
                              '—'}
                          </dd>
                        </div>
                      </>
                    ) : (
                      <div>
                        <dt>
                          Retirada
                        </dt>
                        <dd>
                          no balcão
                        </dd>
                      </div>
                    )}

                    <div>
                      <dt>Quando</dt>
                      <dd>
                        {new Date(
                          p.criado_em
                        ).toLocaleString(
                          'pt-BR'
                        )}
                      </dd>
                    </div>
                  </dl>

                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'wrap',
                      marginTop: 12,
                    }}
                  >
                    {p.status_pagamento !==
                      'pago' &&
                      p.pagamento ===
                        'dinheiro' && (
                        <button
                          className="mini"
                          onClick={() =>
                            atualizarPedido(
                              p.id,
                              {
                                status_pagamento:
                                  'pago',
                              }
                            )
                          }
                        >
                          Recebi o
                          dinheiro
                        </button>
                      )}

                    {prox && (
                      <button
                        className="mini"
                        onClick={() =>
                          atualizarPedido(
                            p.id,
                            {
                              status:
                                prox,
                            }
                          )
                        }
                      >
                        {rotulo}
                      </button>
                    )}

                    {![
                      'cancelado',
                      'concluido',
                    ].includes(
                      p.status
                    ) && (
                      <button
                        className="mini del"
                        onClick={() =>
                          atualizarPedido(
                            p.id,
                            {
                              status:
                                'cancelado',
                            }
                          )
                        }
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              );
            })
      )}

      {/* CARDÁPIO */}

      {aba === 'cardapio' &&
        !editando && (
          <>
            <button
              className="btn"
              style={{
                marginBottom: 14,
              }}
              onClick={() =>
                setEditando({
                  ...VAZIO,
                  ordem:
                    produtos.length,
                })
              }
            >
              + Adicionar novo item
            </button>

            {produtos.map((p) => (
              <div
                className="adm-row"
                key={p.id}
              >
                <div className="th">
                  {p.foto_url ? (
                    <img
                      src={p.foto_url}
                      alt=""
                    />
                  ) : (
                    <IconePrato />
                  )}
                </div>

                <div className="info">
                  <b>
                    {p.nome}

                    {p.ativo ===
                      false && (
                      <span
                        style={{
                          color:
                            'var(--muted)',
                          fontWeight:
                            400,
                        }}
                      >
                        {' '}
                        (oculto)
                      </span>
                    )}
                  </b>

                  <small>
                    {p.categoria} ·{' '}
                    {(p.opcoes || [])
                      .map(
                        (o) =>
                          `${o.nome} ${brl(
                            o.preco
                          )}`
                      )
                      .join(' · ')}
                  </small>
                </div>

                <button
                  className="mini"
                  onClick={() =>
                    setEditando({
                      ...p,
                    })
                  }
                >
                  Editar
                </button>

                <button
                  className="mini"
                  onClick={async () => {
                    const ativo =
                      p.ativo ===
                      false;

                    setProdutos(
                      (l) =>
                        l.map(
                          (x) =>
                            x.id ===
                            p.id
                              ? {
                                  ...x,
                                  ativo,
                                }
                              : x
                        )
                    );

                    await fetch(
                      '/api/admin/produtos',
                      {
                        method:
                          'POST',
                        headers: {
                          'Content-Type':
                            'application/json',
                        },
                        body: JSON.stringify(
                          {
                            ...p,
                            ativo,
                          }
                        ),
                      }
                    );
                  }}
                >
                  {p.ativo === false
                    ? 'Mostrar'
                    : 'Ocultar'}
                </button>
              </div>
            ))}

            <p
              style={{
                color:
                  'var(--muted)',
                fontSize: 12.5,
                marginTop: 14,
              }}
            >
              Dica: use “Ocultar”
              quando um prato acabar
              no meio do dia — ele
              some do cardápio sem
              ser apagado.
            </p>
          </>
        )}

      {aba === 'cardapio' &&
        editando && (
          <div>
            <h2 className="sec">
              {editando.id
                ? 'Editar item'
                : 'Novo item'}
            </h2>

            <div
              className="adm-row"
              style={{
                marginBottom: 16,
              }}
            >
              <div
                className="th"
                style={{
                  width: 70,
                  height: 70,
                  fontSize: 28,
                }}
              >
                {editando.foto_url ? (
                  <img
                    src={
                      editando.foto_url
                    }
                    alt=""
                  />
                ) : (
                  <IconePrato
                    tam={28}
                  />
                )}
              </div>

              <div className="info">
                <b>
                  Foto do produto
                </b>

                <small>
                  JPG, PNG ou WebP
                  até 6 MB. Uma boa
                  foto vende sozinha.
                </small>
              </div>

              <label
                className="mini"
                style={{
                  cursor:
                    'pointer',
                }}
              >
                Enviar

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{
                    display:
                      'none',
                  }}
                  onChange={(e) =>
                    enviarFoto(
                      e.target
                        .files?.[0]
                    )
                  }
                />
              </label>

              {editando.foto_url && (
                <button
                  className="mini del"
                  onClick={() =>
                    setEditando({
                      ...editando,
                      foto_url:
                        null,
                    })
                  }
                >
                  Remover
                </button>
              )}
            </div>

            <label className="f">
              Nome do prato
            </label>

            <input
              className="inp"
              value={
                editando.nome
              }
              maxLength={80}
              onChange={(e) =>
                setEditando({
                  ...editando,
                  nome:
                    e.target.value,
                })
              }
            />

            <label className="f">
              Descrição
            </label>

            <textarea
              className="inp"
              value={
                editando.descricao ||
                ''
              }
              maxLength={300}
              onChange={(e) =>
                setEditando({
                  ...editando,
                  descricao:
                    e.target.value,
                })
              }
            />

            <label className="f">
              Categoria
            </label>

            <select
              className="inp"
              value={
                editando.categoria
              }
              onChange={(e) =>
                setEditando({
                  ...editando,
                  categoria:
                    e.target.value,
                })
              }
            >
              {CATEGORIAS.map(
                (c) => (
                  <option key={c}>
                    {c}
                  </option>
                )
              )}
            </select>

            <label className="f">
              Tamanhos e preços
            </label>

            <p
              style={{
                color:
                  'var(--muted)',
                fontSize: 12.5,
                margin:
                  '-4px 0 10px',
              }}
            >
              "De" é opcional —
              preencha só quando o
              item estiver em
              promoção. Deixe vazio
              no dia a dia.
            </p>

            {editando.opcoes.map(
              (o, i) => (
                <div
                  className="opt-edit"
                  key={i}
                >
                  <input
                    className="inp"
                    value={o.nome}
                    placeholder="Individual / Grande / 300ml"
                    onChange={(e) => {
                      const opcoes =
                        [
                          ...editando.opcoes,
                        ];

                      opcoes[i] = {
                        ...opcoes[i],
                        nome:
                          e.target
                            .value,
                      };

                      setEditando({
                        ...editando,
                        opcoes,
                      });
                    }}
                  />

                  <input
                    className="inp"
                    style={{
                      maxWidth: 90,
                    }}
                    inputMode="decimal"
                    value={
                      o.precoDe ??
                      ''
                    }
                    placeholder="De (opc.)"
                    onChange={(e) => {
                      const opcoes =
                        [
                          ...editando.opcoes,
                        ];

                      opcoes[i] = {
                        ...opcoes[i],
                        precoDe:
                          e.target
                            .value,
                      };

                      setEditando({
                        ...editando,
                        opcoes,
                      });
                    }}
                  />

                  <input
                    className="inp"
                    style={{
                      maxWidth: 90,
                    }}
                    inputMode="decimal"
                    value={o.preco}
                    placeholder="Por 0,00"
                    onChange={(e) => {
                      const opcoes =
                        [
                          ...editando.opcoes,
                        ];

                      opcoes[i] = {
                        ...opcoes[i],
                        preco:
                          e.target
                            .value,
                      };

                      setEditando({
                        ...editando,
                        opcoes,
                      });
                    }}
                  />

                  {editando.opcoes
                    .length > 1 && (
                    <button
                      className="mini del"
                      onClick={() =>
                        setEditando({
                          ...editando,
                          opcoes:
                            editando.opcoes.filter(
                              (
                                _,
                                ix
                              ) =>
                                ix !==
                                i
                            ),
                        })
                      }
                    >
                      ✕
                    </button>
                  )}
                </div>
              )
            )}

            <button
              className="mini"
              onClick={() =>
                setEditando({
                  ...editando,
                  opcoes: [
                    ...editando.opcoes,
                    {
                      nome: '',
                      preco: 0,
                      precoDe: '',
                    },
                  ],
                })
              }
            >
              + Adicionar tamanho
            </button>

            <label
              className="f"
              style={{
                marginTop: 22,
              }}
            >
              Dias em que este
              prato aparece
            </label>

            <p
              style={{
                color:
                  'var(--muted)',
                fontSize: 12.5,
                margin:
                  '-4px 0 10px',
              }}
            >
              Marque todos os dias
              em que este item pode
              ser pedido. Domingo
              fica disponível para
              uso futuro.
            </p>

            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              {[
                [
                  'segunda',
                  'Seg',
                ],
                [
                  'terca',
                  'Ter',
                ],
                [
                  'quarta',
                  'Qua',
                ],
                [
                  'quinta',
                  'Qui',
                ],
                [
                  'sexta',
                  'Sex',
                ],
                [
                  'sabado',
                  'Sáb',
                ],
                [
                  'domingo',
                  'Dom',
                ],
              ].map(
                ([
                  valor,
                  rotulo,
                ]) => {
                  const marcados =
                    Array.isArray(
                      editando.dias_semana
                    )
                      ? editando.dias_semana
                      : [];

                  const ativo =
                    marcados.includes(
                      valor
                    );

                  return (
                    <button
                      key={valor}
                      type="button"
                      className={`mini ${
                        ativo
                          ? 'active'
                          : ''
                      }`}
                      onClick={() =>
                        setEditando({
                          ...editando,

                          dias_semana:
                            ativo
                              ? marcados.filter(
                                  (
                                    d
                                  ) =>
                                    d !==
                                    valor
                                )
                              : [
                                  ...marcados,
                                  valor,
                                ],
                        })
                      }
                    >
                      {ativo
                        ? '✓ '
                        : ''}
                      {rotulo}
                    </button>
                  );
                }
              )}

              <button
                type="button"
                className="mini"
                onClick={() =>
                  setEditando({
                    ...editando,

                    dias_semana:
                      [
                        'segunda',
                        'terca',
                        'quarta',
                        'quinta',
                        'sexta',
                        'sabado',
                        'domingo',
                      ],
                  })
                }
              >
                Todos os dias
              </button>
            </div>

            <label
              className="f"
              style={{
                marginTop: 22,
              }}
            >
              Adicionais deste
              prato
            </label>

            <p
              style={{
                color:
                  'var(--muted)',
                fontSize: 12.5,
                margin:
                  '-4px 0 10px',
              }}
            >
              Cadastre somente os
              extras que podem ser
              escolhidos neste
              produto. O preço pode
              ser R$ 0,00.
            </p>

            {(editando.adicionais ||
              []).map((a, i) => (
              <div
                className="opt-edit"
                key={i}
              >
                <input
                  className="inp"
                  value={
                    a.nome || ''
                  }
                  placeholder="Ex.: Bisteca extra"
                  onChange={(e) => {
                    const adicionais =
                      [
                        ...(editando.adicionais ||
                          []),
                      ];

                    adicionais[i] = {
                      ...adicionais[
                        i
                      ],
                      nome:
                        e.target
                          .value,
                    };

                    setEditando({
                      ...editando,
                      adicionais,
                    });
                  }}
                />

                <input
                  className="inp"
                  style={{
                    maxWidth: 110,
                  }}
                  inputMode="decimal"
                  value={
                    a.preco ?? ''
                  }
                  placeholder="R$ 0,00"
                  onChange={(e) => {
                    const adicionais =
                      [
                        ...(editando.adicionais ||
                          []),
                      ];

                    adicionais[i] = {
                      ...adicionais[
                        i
                      ],
                      preco:
                        e.target
                          .value,
                    };

                    setEditando({
                      ...editando,
                      adicionais,
                    });
                  }}
                />

                <button
                  type="button"
                  className="mini del"
                  onClick={() =>
                    setEditando({
                      ...editando,

                      adicionais:
                        (
                          editando.adicionais ||
                          []
                        ).filter(
                          (
                            _,
                            ix
                          ) =>
                            ix !== i
                        ),
                    })
                  }
                >
                  ✕
                </button>
              </div>
            ))}

            <button
              type="button"
              className="mini"
              onClick={() =>
                setEditando({
                  ...editando,

                  adicionais: [
                    ...(editando.adicionais ||
                      []),

                    {
                      nome: '',
                      preco: 0,
                    },
                  ],
                })
              }
            >
              + Adicionar adicional
            </button>

            <label
              className="opt"
              style={{
                marginTop: 18,
              }}
              onClick={() =>
                setEditando({
                  ...editando,

                  perguntar_talher:
                    !editando.perguntar_talher,
                })
              }
            >
              <input
                type="checkbox"
                readOnly
                checked={
                  !!editando.perguntar_talher
                }
              />

              <span className="on">
                Perguntar se deseja
                talher descartável
                <br />

                <small
                  style={{
                    fontWeight:
                      400,
                    color:
                      'var(--muted)',
                  }}
                >
                  O cliente escolherá
                  sim ou não antes de
                  adicionar ao
                  carrinho.
                </small>
              </span>
            </label>

            <label
              className="opt"
              style={{
                marginTop: 18,
              }}
              onClick={() =>
                setEditando({
                  ...editando,

                  destaque:
                    !editando.destaque,
                })
              }
            >
              <input
                type="checkbox"
                readOnly
                checked={
                  !!editando.destaque
                }
              />

              <span className="on">
                Marcar como prato do
                dia
                <br />

                <small
                  style={{
                    fontWeight:
                      400,
                    color:
                      'var(--muted)',
                  }}
                >
                  Ganha selo dourado
                  no cardápio
                </small>
              </span>
            </label>

            <button
              className="btn"
              style={{
                marginTop: 16,
              }}
              disabled={salvando}
              onClick={
                salvarProduto
              }
            >
              {salvando
                ? 'Salvando...'
                : 'Salvar item'}
            </button>

            {editando.id && (
              <button
                className="btn ghost"
                style={{
                  marginTop: 8,
                  color:
                    'var(--danger)',
                }}
                onClick={() =>
                  excluirProduto(
                    editando.id
                  )
                }
              >
                Excluir do cardápio
              </button>
            )}

            <button
              className="btn ghost"
              style={{
                marginTop: 8,
              }}
              onClick={() =>
                setEditando(null)
              }
            >
              Voltar
            </button>
          </div>
        )}

      {/* CUPONS */}

      {aba === 'cupons' &&
        !editandoCupom && (
          <div>
            <button
              className="btn"
              style={{
                marginBottom: 14,
              }}
              onClick={() =>
                setEditandoCupom({
                  ...CUPOM_VAZIO,
                })
              }
            >
              + Criar novo cupom
            </button>

            <p
              style={{
                color:
                  'var(--muted)',
                fontSize: 12.5,
                margin:
                  '0 0 14px',
              }}
            >
              Crie códigos de
              desconto para primeira
              compra, divulgação,
              influenciadores ou
              campanhas. A validação
              e o cálculo acontecem
              no servidor.
            </p>

            {carregandoCupons && (
              <div className="empty">
                Carregando cupons...
              </div>
            )}

            {!carregandoCupons &&
              cupons.length ===
                0 && (
                <div className="empty">
                  Nenhum cupom
                  cadastrado ainda.
                </div>
              )}

            {!carregandoCupons &&
              cupons.map((c) => {
                const expirado =
                  c.valido_ate &&
                  new Date(
                    c.valido_ate
                  ) < new Date();

                const limiteAtingido =
                  c.limite_usos !=
                    null &&
                  Number(
                    c.usos || 0
                  ) >=
                    Number(
                      c.limite_usos
                    );

                const disponivel =
                  c.ativo !== false &&
                  !expirado &&
                  !limiteAtingido;

                return (
                  <div
                    className="adm-row"
                    key={c.id}
                    style={{
                      alignItems:
                        'center',
                    }}
                  >
                    <div className="info">
                      <b>
                        {c.codigo}

                        {!disponivel && (
                          <span
                            style={{
                              color:
                                'var(--muted)',
                              fontWeight:
                                400,
                            }}
                          >
                            {' '}
                            (indisponível)
                          </span>
                        )}
                      </b>

                      <small>
                        {c.tipo ===
                        'percentual'
                          ? `${Number(
                              c.valor
                            )}% de desconto`
                          : `${brl(
                              c.valor
                            )} de desconto`}

                        {c.primeira_compra
                          ? ' · primeira compra'
                          : ''}

                        {' · '}

                        {Number(
                          c.usos || 0
                        )}{' '}
                        {Number(
                          c.usos || 0
                        ) === 1
                          ? 'uso'
                          : 'usos'}

                        {c.limite_usos !=
                        null
                          ? ` de ${c.limite_usos}`
                          : ''}
                      </small>

                      {c.descricao && (
                        <small>
                          {
                            c.descricao
                          }
                        </small>
                      )}

                      {(c.valido_de ||
                        c.valido_ate) && (
                        <small>
                          {c.valido_de
                            ? `Início: ${new Date(
                                c.valido_de
                              ).toLocaleString(
                                'pt-BR'
                              )}`
                            : 'Sem data inicial'}

                          {' · '}

                          {c.valido_ate
                            ? `Fim: ${new Date(
                                c.valido_ate
                              ).toLocaleString(
                                'pt-BR'
                              )}`
                            : 'Sem vencimento'}
                        </small>
                      )}
                    </div>

                    <button
                      className="mini"
                      onClick={() =>
                        setEditandoCupom({
                          ...c,

                          valido_de:
                            dataParaInput(
                              c.valido_de
                            ),

                          valido_ate:
                            dataParaInput(
                              c.valido_ate
                            ),

                          limite_usos:
                            c.limite_usos ??
                            '',
                        })
                      }
                    >
                      Editar
                    </button>
                  </div>
                );
              })}
          </div>
        )}

      {aba === 'cupons' &&
        editandoCupom && (
          <div>
            <h2 className="sec">
              {editandoCupom.id
                ? 'Editar cupom'
                : 'Novo cupom'}
            </h2>

            <label className="f">
              Código do cupom
            </label>

            <input
              className="inp"
              value={
                editandoCupom.codigo ||
                ''
              }
              maxLength={40}
              placeholder="Ex.: PRIMEIRACOMPRA"
              onChange={(e) =>
                setEditandoCupom({
                  ...editandoCupom,

                  codigo:
                    e.target.value
                      .toUpperCase()
                      .replace(
                        /\s+/g,
                        ''
                      ),
                })
              }
            />

            <p
              style={{
                color:
                  'var(--muted)',
                fontSize: 12.5,
                margin:
                  '6px 0 14px',
              }}
            >
              O código será salvo em
              letras maiúsculas.
              Evite espaços.
            </p>

            <label className="f">
              Descrição interna
            </label>

            <input
              className="inp"
              value={
                editandoCupom.descricao ||
                ''
              }
              maxLength={160}
              placeholder="Ex.: Campanha de primeira compra"
              onChange={(e) =>
                setEditandoCupom({
                  ...editandoCupom,

                  descricao:
                    e.target.value,
                })
              }
            />

            <div className="row">
              <div>
                <label className="f">
                  Tipo de desconto
                </label>

                <select
                  className="inp"
                  value={
                    editandoCupom.tipo
                  }
                  onChange={(e) =>
                    setEditandoCupom({
                      ...editandoCupom,

                      tipo:
                        e.target
                          .value,
                    })
                  }
                >
                  <option value="percentual">
                    Percentual (%)
                  </option>

                  <option value="fixo">
                    Valor fixo (R$)
                  </option>
                </select>
              </div>

              <div>
                <label className="f">
                  {editandoCupom.tipo ===
                  'percentual'
                    ? 'Percentual (%)'
                    : 'Valor do desconto (R$)'}
                </label>

                <input
                  className="inp"
                  inputMode="decimal"
                  value={
                    editandoCupom.valor ??
                    ''
                  }
                  placeholder={
                    editandoCupom.tipo ===
                    'percentual'
                      ? '10'
                      : '5,00'
                  }
                  onChange={(e) =>
                    setEditandoCupom({
                      ...editandoCupom,

                      valor:
                        e.target
                          .value,
                    })
                  }
                />
              </div>
            </div>

            <label
              className="opt"
              style={{
                marginTop: 18,
              }}
              onClick={() =>
                setEditandoCupom({
                  ...editandoCupom,

                  primeira_compra:
                    !editandoCupom.primeira_compra,
                })
              }
            >
              <input
                type="checkbox"
                readOnly
                checked={
                  !!editandoCupom.primeira_compra
                }
              />

              <span className="on">
                Somente primeira
                compra
                <br />

                <small
                  style={{
                    fontWeight:
                      400,
                    color:
                      'var(--muted)',
                  }}
                >
                  O telefone do
                  cliente será
                  conferido no
                  histórico de
                  pedidos.
                </small>
              </span>
            </label>

            <label
              className="f"
              style={{
                marginTop: 18,
              }}
            >
              Limite total de
              utilizações
            </label>

            <input
              className="inp"
              inputMode="numeric"
              value={
                editandoCupom.limite_usos ??
                ''
              }
              placeholder="Deixe vazio para ilimitado"
              onChange={(e) =>
                setEditandoCupom({
                  ...editandoCupom,

                  limite_usos:
                    e.target.value.replace(
                      /\D/g,
                      ''
                    ),
                })
              }
            />

            <div
              className="row"
              style={{
                marginTop: 6,
              }}
            >
              <div>
                <label className="f">
                  Válido a partir de
                </label>

                <input
                  className="inp"
                  type="datetime-local"
                  value={
                    editandoCupom.valido_de ||
                    ''
                  }
                  onChange={(e) =>
                    setEditandoCupom({
                      ...editandoCupom,

                      valido_de:
                        e.target
                          .value,
                    })
                  }
                />
              </div>

              <div>
                <label className="f">
                  Válido até
                </label>

                <input
                  className="inp"
                  type="datetime-local"
                  value={
                    editandoCupom.valido_ate ||
                    ''
                  }
                  onChange={(e) =>
                    setEditandoCupom({
                      ...editandoCupom,

                      valido_ate:
                        e.target
                          .value,
                    })
                  }
                />
              </div>
            </div>

            <p
              style={{
                color:
                  'var(--muted)',
                fontSize: 12.5,
                margin:
                  '8px 0 0',
              }}
            >
              As datas são opcionais.
              Sem data final, o cupom
              não vence
              automaticamente.
            </p>

            <label
              className="opt"
              style={{
                marginTop: 18,
              }}
              onClick={() =>
                setEditandoCupom({
                  ...editandoCupom,

                  ativo:
                    editandoCupom.ativo ===
                    false,
                })
              }
            >
              <input
                type="checkbox"
                readOnly
                checked={
                  editandoCupom.ativo !==
                  false
                }
              />

              <span className="on">
                Cupom ativo
                <br />

                <small
                  style={{
                    fontWeight:
                      400,
                    color:
                      'var(--muted)',
                  }}
                >
                  Desative para
                  interromper o uso
                  sem excluir o
                  histórico.
                </small>
              </span>
            </label>

            {editandoCupom.id && (
              <div
                className="alert"
                style={{
                  marginTop: 18,
                }}
              >
                Este cupom já foi
                utilizado{' '}
                <b>
                  {Number(
                    editandoCupom.usos ||
                      0
                  )}
                </b>{' '}
                {Number(
                  editandoCupom.usos ||
                    0
                ) === 1
                  ? 'vez'
                  : 'vezes'}.
              </div>
            )}

            <button
              className="btn"
              style={{
                marginTop: 18,
              }}
              disabled={
                salvandoCupom
              }
              onClick={
                salvarCupom
              }
            >
              {salvandoCupom
                ? 'Salvando...'
                : 'Salvar cupom'}
            </button>

            {editandoCupom.id && (
              <button
                className="btn ghost"
                style={{
                  marginTop: 8,
                  color:
                    'var(--danger)',
                }}
                onClick={() =>
                  excluirCupom(
                    editandoCupom.id
                  )
                }
              >
                Excluir cupom
              </button>
            )}

            <button
              className="btn ghost"
              style={{
                marginTop: 8,
              }}
              onClick={() =>
                setEditandoCupom(
                  null
                )
              }
            >
              Voltar
            </button>
          </div>
        )}

      {/* FINANCEIRO */}

      {aba === 'financeiro' && (
        <div>
          <div
            className="cats-in"
            style={{
              marginBottom: 16,
            }}
          >
            {[
              ['hoje', 'Hoje'],
              [
                'semana',
                'Esta semana',
              ],
              [
                'semana_passada',
                'Semana passada',
              ],
              [
                'mes',
                'Este mês',
              ],
              [
                'tudo',
                'Tudo',
              ],
            ].map(([v, t]) => (
              <button
                key={v}
                className={`cat ${
                  periodo === v
                    ? 'active'
                    : ''
                }`}
                onClick={() =>
                  setPeriodo(v)
                }
              >
                {t}
              </button>
            ))}
          </div>

          {carregandoRel && (
            <div className="empty">
              Somando os pedidos...
            </div>
          )}

          {!carregandoRel &&
            relatorio && (
              <>
                <div
                  className="grid"
                  style={{
                    gridTemplateColumns:
                      'repeat(auto-fit,minmax(150px,1fr))',
                  }}
                >
                  {[
                    [
                      'Vendas',
                      relatorio.totalVendas,
                    ],
                    [
                      'Faturamento',
                      brl(
                        relatorio.totalValor
                      ),
                    ],
                    [
                      'Ticket médio',
                      brl(
                        relatorio.ticketMedio
                      ),
                    ],
                    [
                      'Entregas',
                      `${relatorio.entregas} de ${relatorio.totalVendas}`,
                    ],
                  ].map(
                    ([
                      rotulo,
                      valor,
                    ]) => (
                      <div
                        key={
                          rotulo
                        }
                        style={{
                          background:
                            'var(--surface)',
                          border:
                            '1px solid var(--line)',
                          borderRadius:
                            14,
                          padding:
                            '14px 16px',
                          boxShadow:
                            'var(--shadow)',
                        }}
                      >
                        <small
                          style={{
                            color:
                              'var(--muted)',
                            fontSize:
                              12,
                            textTransform:
                              'uppercase',
                            letterSpacing:
                              .4,
                            fontWeight:
                              700,
                          }}
                        >
                          {
                            rotulo
                          }
                        </small>

                        <div
                          style={{
                            fontFamily:
                              'var(--serif)',
                            fontSize:
                              24,
                            fontWeight:
                              700,
                            color:
                              'var(--brand)',
                            marginTop:
                              2,
                          }}
                        >
                          {valor}
                        </div>
                      </div>
                    )
                  )}
                </div>

                <h2 className="sec">
                  Dia a dia
                </h2>

                {relatorio.porDia
                  .length === 0 ? (
                  <div className="empty">
                    Nenhuma venda
                    neste período.
                  </div>
                ) : (
                  relatorio.porDia.map(
                    (l) => (
                      <div
                        className="adm-row"
                        key={
                          l.dia
                        }
                      >
                        <div className="info">
                          <b>
                            {
                              l.nome
                            }
                          </b>

                          <small>
                            {l.dia
                              .split(
                                '-'
                              )
                              .reverse()
                              .join(
                                '/'
                              )}{' '}
                            ·{' '}
                            {
                              l.vendas
                            }{' '}
                            {l.vendas ===
                            1
                              ? 'venda'
                              : 'vendas'}
                          </small>
                        </div>

                        <span
                          style={{
                            fontWeight:
                              800,
                            color:
                              'var(--brand)',
                          }}
                        >
                          {brl(
                            l.valor
                          )}
                        </span>
                      </div>
                    )
                  )
                )}

                <h2 className="sec">
                  Por forma de
                  pagamento
                </h2>

                {Object.entries(
                  relatorio.porPagamento
                ).length === 0 ? (
                  <div className="empty">
                    Sem pagamentos
                    no período.
                  </div>
                ) : (
                  Object.entries(
                    relatorio.porPagamento
                  ).map(
                    ([
                      forma,
                      d,
                    ]) => (
                      <div
                        className="adm-row"
                        key={
                          forma
                        }
                      >
                        <div className="info">
                          <b
                            style={{
                              textTransform:
                                'capitalize',
                            }}
                          >
                            {
                              forma
                            }
                          </b>

                          <small>
                            {
                              d.vendas
                            }{' '}
                            {d.vendas ===
                            1
                              ? 'venda'
                              : 'vendas'}
                          </small>
                        </div>

                        <span
                          style={{
                            fontWeight:
                              800,
                          }}
                        >
                          {brl(
                            d.valor
                          )}
                        </span>
                      </div>
                    )
                  )
                )}

                {relatorio
                  .aguardandoPagamento
                  .vendas >
                  0 && (
                  <div
                    className="alert"
                    style={{
                      marginTop:
                        16,
                    }}
                  >
                    <b>
                      {
                        relatorio
                          .aguardandoPagamento
                          .vendas
                      }{' '}
                      Pix ainda não
                      confirmado(s)
                    </b>{' '}
                    somando{' '}
                    {brl(
                      relatorio
                        .aguardandoPagamento
                        .valor
                    )}
                    . Esses valores
                    não entram no
                    faturamento
                    acima.
                  </div>
                )}

                {relatorio.cancelados >
                  0 && (
                  <p
                    style={{
                      color:
                        'var(--muted)',
                      fontSize:
                        13,
                    }}
                  >
                    {
                      relatorio.cancelados
                    }{' '}
                    pedido(s)
                    cancelado(s) no
                    período, fora da
                    conta.
                  </p>
                )}

                <a
                  className="btn"
                  style={{
                    marginTop: 20,
                  }}
                  href={`/api/admin/relatorio?periodo=${periodo}&formato=csv`}
                >
                  Baixar planilha
                  deste período
                </a>

                <p
                  style={{
                    color:
                      'var(--muted)',
                    fontSize: 12.5,
                    marginTop: 10,
                    textAlign:
                      'center',
                  }}
                >
                  Abre direto no
                  Excel e no Google
                  Planilhas.
                </p>
              </>
            )}
        </div>
      )}

      {/* CONFIGURAÇÕES */}

      {aba === 'config' && (
        <div>
          <label className="f">
            Banner do topo (estilo
            iFood)
          </label>

          <div
            className="adm-row"
            style={{
              marginBottom: 4,
            }}
          >
            <div
              className="th"
              style={{
                width: 70,
                height: 46,
                borderRadius: 8,
              }}
            >
              {config.banner_url ? (
                <img
                  src={
                    config.banner_url
                  }
                  alt=""
                />
              ) : (
                <IconeImagem />
              )}
            </div>

            <div className="info">
              <b>
                Imagem de fundo do
                cabeçalho
              </b>

              <small>
                Recomendado 1200 ×
                400 px, JPG ou WebP,
                até 6 MB
              </small>
            </div>

            <label
              className="mini"
              style={{
                cursor: 'pointer',
              }}
            >
              Enviar

              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{
                  display: 'none',
                }}
                onChange={(e) =>
                  enviarBanner(
                    e.target
                      .files?.[0]
                  )
                }
              />
            </label>

            {config.banner_url && (
              <button
                className="mini del"
                onClick={() =>
                  salvarConfig({
                    banner_url:
                      null,
                  })
                }
              >
                Remover
              </button>
            )}
          </div>

          <label
            className="f"
            style={{
              marginTop: 22,
            }}
          >
            Avaliação exibida no
            topo
          </label>

          <p
            style={{
              color:
                'var(--muted)',
              fontSize: 12.5,
              margin:
                '-4px 0 10px',
            }}
          >
            Preenchimento manual —
            usem a nota que já têm no
            Google ou WhatsApp.
            Deixe a nota em branco
            para não mostrar nada.
          </p>

          <div className="row">
            <div>
              <label className="f">
                Nota (0 a 5)
              </label>

              <input
                className="inp"
                inputMode="decimal"
                value={
                  config.nota_media ??
                  ''
                }
                placeholder="Ex.: 4,8"
                onChange={(e) =>
                  setConfig({
                    ...config,

                    nota_media:
                      e.target
                        .value,
                  })
                }
              />
            </div>

            <div>
              <label className="f">
                Quantidade de
                avaliações
              </label>

              <input
                className="inp"
                inputMode="numeric"
                value={
                  config.total_avaliacoes ??
                  0
                }
                onChange={(e) =>
                  setConfig({
                    ...config,

                    total_avaliacoes:
                      e.target
                        .value,
                  })
                }
              />
            </div>
          </div>

          <label
            className="f"
            style={{
              marginTop: 22,
            }}
          >
            Prato do dia (destaque
            no topo)
          </label>

          <input
            className="inp"
            value={
              config.prato_do_dia ||
              ''
            }
            onChange={(e) =>
              setConfig({
                ...config,

                prato_do_dia:
                  e.target.value,
              })
            }
          />

          <label className="f">
            Recado sobre o prato do
            dia
          </label>

          <input
            className="inp"
            value={
              config.recado || ''
            }
            onChange={(e) =>
              setConfig({
                ...config,

                recado:
                  e.target.value,
              })
            }
          />

          <label className="f">
            Mensagem quando estiver
            fechado
          </label>

          <input
            className="inp"
            value={
              config.mensagem_fechado ||
              ''
            }
            onChange={(e) =>
              setConfig({
                ...config,

                mensagem_fechado:
                  e.target.value,
              })
            }
          />

          <div className="row">
            <div>
              <label className="f">
                Horário
              </label>

              <input
                className="inp"
                value={
                  config.horario ||
                  ''
                }
                onChange={(e) =>
                  setConfig({
                    ...config,

                    horario:
                      e.target
                        .value,
                  })
                }
              />
            </div>

            <div>
              <label className="f">
                Tempo de entrega
              </label>

              <input
                className="inp"
                value={
                  config.tempo_entrega ||
                  ''
                }
                onChange={(e) =>
                  setConfig({
                    ...config,

                    tempo_entrega:
                      e.target
                        .value,
                  })
                }
              />
            </div>
          </div>

          <label className="f">
            Taxa de entrega (R$)
          </label>

          <input
            className="inp"
            inputMode="decimal"
            value={
              config.taxa_entrega ??
              0
            }
            onChange={(e) =>
              setConfig({
                ...config,

                taxa_entrega:
                  e.target.value,
              })
            }
          />

          <button
            className="btn"
            style={{
              marginTop: 20,
            }}
            onClick={async () => {
              await salvarConfig({
                taxa_entrega:
                  Number(
                    String(
                      config.taxa_entrega
                    ).replace(
                      ',',
                      '.'
                    )
                  ) || 0,
              });

              avisar(
                'Configurações salvas'
              );
            }}
          >
            Salvar configurações
          </button>

          <div
            className="alert"
            style={{
              marginTop: 24,
            }}
          >
            A chave Pix e as
            credenciais do Mercado
            Pago ficam nas variáveis
            de ambiente do servidor,
            não aqui — assim elas
            nunca chegam ao navegador
            de ninguém.
          </div>
        </div>
      )}

      {toast && (
        <div className="toast">
          {toast}
        </div>
      )}
    </div>
  );
}
