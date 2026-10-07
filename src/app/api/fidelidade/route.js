import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/*
 * Endpoint legado desativado.
 *
 * O saldo e o historico de fidelidade agora so podem ser consultados
 * por uma sessao autenticada em /api/fidelidade/conta.
 * Isso evita expor dados de um cliente apenas pelo numero de telefone.
 */
export async function POST() {
  return NextResponse.json(
    { erro: 'Valide seu e-mail para consultar sua fidelidade.' },
    { status: 401 }
  );
}
