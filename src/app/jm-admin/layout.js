export const metadata = {
  title: 'JM Admin',
  description: 'Painel administrativo Jeito de Mãe',
  manifest: '/manifest-admin.webmanifest',
  robots: { index: false, follow: false },
  icons: {
    icon: [{ url: '/jeito%20de%20m%C3%A3e_app.png', type: 'image/png' }],
    apple: [{ url: '/jeito%20de%20m%C3%A3e_app.png', type: 'image/png' }],
  },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'JM Admin' },
};

export const viewport = {
  themeColor: '#6f1830',
  width: 'device-width',
  initialScale: 1,
};

export default function JMAdminLayout({ children }) {
  return children;
}
