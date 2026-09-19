import { z } from 'zod';

const soDigitos = (s) => String(s || '').replace(/\D/g, '');

export const adicionalSchema = z.object({
  nome: z.string().trim().min(1).max(80),
  preco: z.number().min(0).max(9999),
});

export const itemSchema = z.object({
  produtoId: z.string().uuid(),
  opcao: z.string().min(1).max(60),
  qtd: z.number().int().min(1).max(20),

  // O navegador envia somente os nomes dos adicionais escolhidos.
  // Os preços serão conferidos novamente no servidor.
  adicionais: z.array(z.string().trim().min(1).max(80))
    .max(20)
    .optional()
    .default([]),

  // null = produto não pergunta sobre talher.
  // true/false = escolha feita pelo cliente.
  talher: z.boolean().nullable().optional().default(null),

  obs: z.string().max(250).optional().default(''),
});

export const pedidoSchema = z.object({
  nome: z.string().trim().min(3, 'Informe o nome completo').max(80),

  telefone: z.string().trim().refine(
    (v) => soDigitos(v).length >= 10 && soDigitos(v).length <= 13,
    'Telefone invalido'
  ),

  endereco: z.string().trim().max(200).optional().default(''),
  referencia: z.string().trim().max(160).optional().default(''),

  tipo: z.enum(['entrega', 'retirada']),

  pagamento: z.enum(['pix', 'credito', 'dinheiro']),

  itens: z.array(itemSchema)
    .min(1, 'Carrinho vazio')
    .max(30),

  // O cliente envia somente o código.
  // O desconto nunca será enviado pelo navegador.
  // O servidor consulta o cupom no banco e calcula o valor real.
  cupom: z.string()
    .trim()
    .max(40)
    .optional()
    .default(''),

}).refine(
  (d) => d.tipo !== 'entrega' || d.endereco.length >= 8,
  {
    message: 'Informe o endereco completo',
    path: ['endereco'],
  }
);

export const opcaoSchema = z.object({
  nome: z.string().trim().min(1).max(40),
  preco: z.number().min(0).max(9999),

  // Preço "de" é apenas visual.
  // O valor realmente cobrado continua sendo "preco".
  precoDe: z.number().min(0).max(9999).nullable().optional(),
});

export const produtoSchema = z.object({
  id: z.string().uuid().optional(),

  nome: z.string().trim().min(2).max(80),

  descricao: z.string()
    .trim()
    .max(300)
    .optional()
    .default(''),

  categoria: z.string().trim().min(2).max(40),

  opcoes: z.array(opcaoSchema)
    .min(1)
    .max(8),

  foto_url: z.string().url().nullable().optional(),

  dias_semana: z.array(
    z.enum([
      'segunda',
      'terca',
      'quarta',
      'quinta',
      'sexta',
      'sabado',
      'domingo',
    ])
  )
    .min(1, 'Escolha pelo menos um dia da semana')
    .max(7)
    .optional()
    .default([
      'segunda',
      'terca',
      'quarta',
      'quinta',
      'sexta',
      'sabado',
      'domingo',
    ]),

  adicionais: z.array(adicionalSchema)
    .max(30)
    .optional()
    .default([]),

  perguntar_talher: z.boolean()
    .optional()
    .default(false),

  ativo: z.boolean()
    .optional()
    .default(true),

  destaque: z.boolean()
    .optional()
    .default(false),

  ordem: z.number()
    .int()
    .min(0)
    .max(999)
    .optional()
    .default(0),
});

/**
 * Cupom cadastrado pelo administrador.
 *
 * Exemplos:
 *
 * PRIMEIRACOMPRA
 * percentual / 10
 *
 * MARIA10
 * percentual / 10
 *
 * DESCONTO5
 * fixo / 5
 */
export const cupomSchema = z.object({
  id: z.string().uuid().optional(),

  codigo: z.string()
    .trim()
    .min(3, 'Informe o codigo do cupom')
    .max(40)
    .transform((v) => v.toUpperCase()),

  descricao: z.string()
    .trim()
    .max(160)
    .optional()
    .default(''),

  tipo: z.enum([
    'percentual',
    'fixo',
  ]),

  valor: z.number()
    .min(0.01, 'Informe o valor do desconto')
    .max(9999),

  primeira_compra: z.boolean()
    .optional()
    .default(false),

  limite_usos: z.number()
    .int()
    .min(1)
    .nullable()
    .optional()
    .default(null),

  valido_de: z.string()
    .datetime({ offset: true })
    .nullable()
    .optional()
    .default(null),

  valido_ate: z.string()
    .datetime({ offset: true })
    .nullable()
    .optional()
    .default(null),

  ativo: z.boolean()
    .optional()
    .default(true),
}).superRefine((cupom, ctx) => {

  // Percentual não pode passar de 100%.
  if (
    cupom.tipo === 'percentual' &&
    cupom.valor > 100
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['valor'],
      message: 'O desconto percentual nao pode passar de 100%',
    });
  }

  // Se as duas datas existirem, o fim deve ser posterior ao início.
  if (
    cupom.valido_de &&
    cupom.valido_ate &&
    new Date(cupom.valido_ate) <= new Date(cupom.valido_de)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['valido_ate'],
      message: 'A data final deve ser posterior a data inicial',
    });
  }
});

export const configSchema = z.object({
  aberto: z.boolean(),

  prato_do_dia: z.string()
    .max(120)
    .optional()
    .default(''),

  recado: z.string()
    .max(200)
    .optional()
    .default(''),

  mensagem_fechado: z.string()
    .max(200)
    .optional()
    .default(''),

  horario: z.string()
    .max(80)
    .optional()
    .default(''),

  tempo_entrega: z.string()
    .max(40)
    .optional()
    .default(''),

  taxa_entrega: z.number()
    .min(0)
    .max(200),

  banner_url: z.string()
    .url()
    .nullable()
    .optional(),

  nota_media: z.number()
    .min(0)
    .max(5)
    .nullable()
    .optional(),

  total_avaliacoes: z.number()
    .int()
    .min(0)
    .max(999999)
    .optional()
    .default(0),
});

export const statusPedidoSchema = z.object({
  id: z.string().uuid(),

  status: z.enum([
    'novo',
    'confirmado',
    'preparo',
    'entrega',
    'pronto_retirada',
    'concluido',
    'cancelado',
  ]).optional(),

  status_pagamento: z.enum([
    'pendente',
    'pago',
    'expirado',
  ]).optional(),
});

export { soDigitos };
