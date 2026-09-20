import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSystemBrandingAction } from '@/lib/master/system-assets';
import BrandLogo from '@/components/shared/BrandLogo';
import MasterSidebar from '@/components/master/MasterSidebar';

export default async function MasterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: any }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignorar
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Redundância Server Layout Guard: Consulta estrita a profiles.system_role
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, email, system_role')
    .eq('id', user.id)
    .single();

  if (profile?.system_role !== 'master') {
    redirect('/unauthorized');
  }

  const systemBranding = await getSystemBrandingAction();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      <MasterSidebar 
        userName={profile?.name || user.email?.split('@')[0] || 'Master'}
        systemBranding={systemBranding}
      />

      {/* ÁREA PRINCIPAL MASTER */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto w-full">
        <div className="max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
