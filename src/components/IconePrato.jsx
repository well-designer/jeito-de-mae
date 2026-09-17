/**
 * Placeholder neutro para quando um prato ainda nao tem foto.
 * Substitui os emojis: um icone de linha, discreto, que combina com
 * um cardapio profissional (sem cor viva, sem "carinha" de rede social).
 */
export default function IconePrato({ tam = 26 }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ opacity: 0.35 }}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
    </svg>
  );
}
