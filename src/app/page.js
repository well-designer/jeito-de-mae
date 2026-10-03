export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <main style={{ margin: 0, width: '100%', height: '100dvh', overflow: 'hidden', background: '#EFE7E4' }}>
      <iframe
        src="/prototipo"
        title="Jeito de Mãe Pedidos"
        style={{ display: 'block', width: '100%', height: '100%', border: 0 }}
      />
    </main>
  );
}
