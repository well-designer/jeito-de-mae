import './globals.css';

export const metadata = {
  title: 'Jeito de Mãe — Delícias Caseiras',
  description: 'Comida caseira feita na hora. Peça pelo site e receba em casa.',
  robots: { index: true, follow: true },
};

export const viewport = {
  themeColor: '#B3252B',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
