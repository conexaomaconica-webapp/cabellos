import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  Calendar,
  HardDriveDownload,
  ShieldCheck,
  Settings,
  Crown,
  LogOut,
  Sparkles,
} from 'lucide-react';

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
    .select('full_name, email, system_role')
    .eq('id', user.id)
    .single();

  if (profile?.system_role !== 'master') {
    redirect('/unauthorized');
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* SIDEBAR MASTER */}
      <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 p-4 flex flex-col justify-between shrink-0">
        <div className="space-y-6">
          {/* HEADER BRAND */}
          <div className="flex items-center gap-3 px-2 py-3 bg-purple-950/40 border border-purple-800/40 rounded-xl">
            <div className="p-2 bg-purple-600 text-white rounded-lg shadow-lg">
              <Crown className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-bold text-base text-white leading-tight">Cabellos</h1>
              <span className="text-xs text-purple-300 font-medium">Administração Master</span>
            </div>
          </div>

          {/* NAVEGAÇÃO MASTER */}
          <nav className="space-y-1">
            <Link
              href="/master"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
            >
              <LayoutDashboard className="h-4 w-4 text-purple-400" />
              Visão Geral
            </Link>
            <Link
              href="/master/organizacoes"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
            >
              <Building2 className="h-4 w-4 text-purple-400" />
              Salões / Tenants
            </Link>
            <Link
              href="/master/usuarios"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
            >
              <Users className="h-4 w-4 text-purple-400" />
              Usuários Globais
            </Link>
            <Link
              href="/master/planos"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
            >
              <CreditCard className="h-4 w-4 text-purple-400" />
              Planos SaaS
            </Link>
            <Link
              href="/master/assinaturas"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
            >
              <Calendar className="h-4 w-4 text-purple-400" />
              Assinaturas
            </Link>
            <Link
              href="/master/backups"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
            >
              <HardDriveDownload className="h-4 w-4 text-purple-400" />
              Backups & Exportações
            </Link>
            <Link
              href="/master/auditoria"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
            >
              <ShieldCheck className="h-4 w-4 text-purple-400" />
              Trilha de Auditoria
            </Link>
            <Link
              href="/master/sistema"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
            >
              <Sparkles className="h-4 w-4 text-purple-400" />
              Identidade do Sistema
            </Link>
            <Link
              href="/master/configuracoes"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
            >
              <Settings className="h-4 w-4 text-purple-400" />
              Configurações
            </Link>
          </nav>
        </div>

        {/* FOOTER USER PERFIL MASTER */}
        <div className="pt-4 border-t border-slate-800 mt-6">
          <div className="flex items-center justify-between px-2 py-2">
            <div className="truncate">
              <p className="text-xs font-bold text-slate-200 truncate">
                {profile?.full_name || 'Master Admin'}
              </p>
              <p className="text-[11px] text-purple-300 truncate">{profile?.email || user.email}</p>
            </div>
            <Link
              href="/dashboard"
              title="Ir para Dashboard Salão"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            >
              <LogOut className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </aside>

      {/* ÁREA PRINCIPAL MASTER */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
