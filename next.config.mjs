/** Cabecalhos de seguranca aplicados a todas as rotas. */
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value:
      'camera=(), microphone=(), geolocation=()',
  },
  {
    key: 'Strict-Transport-Security',
    value:
      'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",

      "script-src 'self' 'unsafe-inline' https://sdk.mercadopago.com",

      "style-src 'self' 'unsafe-inline' https://http2.mlstatic.com",

      "img-src 'self' data: blob: https://*.supabase.co https://*.mercadopago.com https://*.mlstatic.com",

      "connect-src 'self' https://*.supabase.co https://*.mercadopago.com https://*.mercadopago.com.br https://*.mlstatic.com",

      "frame-src 'self' https://*.mercadopago.com https://*.mercadopago.com.br",

      "font-src 'self' data: https://*.mlstatic.com",

      "frame-ancestors 'none'",

      "base-uri 'self'",

      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
