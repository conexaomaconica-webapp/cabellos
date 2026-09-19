'use server';

import { cookies } from 'next/headers';
import { MASTER_ROLE_PREVIEW_COOKIE, MasterRolePreview } from '@/lib/supabase/server';

export async function setMasterRolePreviewAction(role: MasterRolePreview | null) {
  const cookieStore = await cookies();
  if (!role || role === 'master') {
    cookieStore.delete(MASTER_ROLE_PREVIEW_COOKIE);
  } else {
    cookieStore.set(MASTER_ROLE_PREVIEW_COOKIE, role, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
  }
}
