import { z } from 'zod';

const soDigitos = (s) => String(s || '').replace(/\D/g, '');

export const itemSchema = z.object({
  produtoId: z.string().uuid(),
  opcao: z.string().min(1).max(60),
  qtd: z.number().int().min(1).max(20),
  obs: z.string().max(200).optional().default(''),
});

export const pedidoSchema = z.object({
  nome: z.string().trim().min(3, 'Informe o nome completo').max(80),
  telefone: z.string().trim().refine((v) => soDigitos(v).length >= 10 && soDigitos(v).length <= 13,
    'Telefone invalido'),
  endereco: z.string().trim().max(200).optional().default(''),
  referencia: z.string().trim().max(160).optional().default(''),
  tipo: z.enum(['entrega', 'retirada']),
  pagamento: z.enum(['pix', 'dinheiro']),
  itens: z.array(itemSchema).min(1, 'Carrinho vazio').max(30),
}).refine((d) => d.tipo !== 'entrega' || d.endereco.length >= 8, {
  message: 'Informe o endereco completo',
  path: ['endereco'],
});

export const opcaoSchema = z.object({
  nome: z.string().trim().min(1).max(40),
  preco: z.number().min(0).max(9999),
});

export const produtoSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(2).max(80),
  descricao: z.string().trim().max(300).optional().default(''),
  categoria: z.string().trim().min(2).max(40),
  opcoes: z.array(opcaoSchema).min(1).max(8),
  foto_url: z.string().url().nullable().optional(),
  ativo: z.boolean().optional().default(true),
  destaque: z.boolean().optional().default(false),
  ordem: z.number().int().min(0).max(999).optional().default(0),
});

export const configSchema = z.object({
  aberto: z.boolean(),
  prato_do_dia: z.string().max(120).optional().default(''),
  recado: z.string().max(200).optional().default(''),
  mensagem_fechado: z.string().max(200).optional().default(''),
  horario: z.string().max(80).optional().default(''),
  tempo_entrega: z.string().max(40).optional().default(''),
  taxa_entrega: z.number().min(0).max(200),
});

export const statusPedidoSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['novo', 'preparo', 'entrega', 'concluido', 'cancelado']).optional(),
  status_pagamento: z.enum(['pendente', 'pago', 'expirado']).optional(),
});

export { soDigitos };
