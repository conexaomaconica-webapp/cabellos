import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPage =
    request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/register') ||
    request.nextUrl.pathname.startsWith('/forgot-password') ||
    request.nextUrl.pathname.startsWith('/reset-password');

  const isOnboardingPage = request.nextUrl.pathname.startsWith('/onboarding');

  if (!user && !isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user) {
    if (isAuthPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }

    // Verificar se usuário possui organização
    const { data: orgUsers } = await supabase
      .from('organization_users')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true);

    const hasOrg = orgUsers && orgUsers.length > 0;

    if (!hasOrg && !isOnboardingPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/onboarding';
      return NextResponse.redirect(url);
    }

    if (hasOrg && isOnboardingPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }

    // Garantir cookie da organização ativa se não definido
    const activeOrgCookie = request.cookies.get('cabellos_active_org_id')?.value;
    if (hasOrg && (!activeOrgCookie || !orgUsers.some((ou: { organization_id: string }) => ou.organization_id === activeOrgCookie))) {
      const defaultOrgId = orgUsers[0].organization_id;
      supabaseResponse.cookies.set('cabellos_active_org_id', defaultOrgId, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
      });
    }
  }

  return supabaseResponse;
}
