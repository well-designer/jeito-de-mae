import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Primeira barreira das areas protegidas:
 * sem cookie de sessao valido, o usuario nem chega
 * a carregar o painel administrativo ou a cozinha.
 *
 * A checagem de papel "admin" acontece novamente
 * no servidor com exigirAdmin(), porque uma barreira
 * so nunca basta.
 */
export async function middleware(request) {
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => request.cookies.get(name)?.value,

        set: (name, value, options) =>
          response.cookies.set({
            name,
            value,
            ...options,
          }),

        remove: (name, options) =>
          response.cookies.set({
            name,
            value: '',
            ...options,
          }),
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();

    url.pathname = '/login';

    url.searchParams.set(
      'proximo',
      request.nextUrl.pathname
    );

    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    '/cozinha/:path*',
  ],
};
