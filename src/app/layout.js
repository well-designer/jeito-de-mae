import './globals.css';

export const metadata = {
  title: 'Jeito de Mãe',
  description: 'Comida caseira feita na hora. Peça pelo site e receba em casa.',
  robots: { index: true, follow: true },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/jeito%20de%20m%C3%A3e_app.png', type: 'image/png' }],
    shortcut: ['/jeito%20de%20m%C3%A3e_app.png'],
    apple: [{ url: '/jeito%20de%20m%C3%A3e_app.png', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Jeito de Mãe',
  },
};

export const viewport = {
  themeColor: '#8B263D',
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
