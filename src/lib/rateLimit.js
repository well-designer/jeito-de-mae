/**
 * Limitador simples em memoria: segura tentativa de flood de pedidos
 * vinda do mesmo IP. Para volume maior, troque por Upstash Redis.
 */
const baldes = new Map();

export function limitar(chave, max = 8, janelaMs = 60_000) {
  const agora = Date.now();
  const atual = baldes.get(chave);
  if (!atual || agora > atual.reset) {
    baldes.set(chave, { n: 1, reset: agora + janelaMs });
    return true;
  }
  if (atual.n >= max) return false;
  atual.n += 1;
  return true;
}

export function ipDe(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'desconhecido'
  );
}
