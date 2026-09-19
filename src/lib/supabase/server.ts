import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Chamado a partir de Server Components não mutáveis
          }
        },
      },
    }
  );
}

export const ACTIVE_ORG_COOKIE = 'cabellos_active_org_id';
export const MASTER_ROLE_PREVIEW_COOKIE = 'cb_master_role_preview';
export type MasterRolePreview = 'master' | 'admin' | 'receptionist' | 'professional';

export async function getActiveOrganizationId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_ORG_COOKIE)?.value || null;
}

export async function setActiveOrganizationId(orgId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, orgId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

export async function getMasterRolePreview(): Promise<MasterRolePreview | null> {
  const cookieStore = await cookies();
  const val = cookieStore.get(MASTER_ROLE_PREVIEW_COOKIE)?.value;
  if (val === 'master' || val === 'admin' || val === 'receptionist' || val === 'professional') {
    return val;
  }
  return null;
}


