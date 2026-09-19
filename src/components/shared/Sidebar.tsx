'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { OrgSwitcher } from './OrgSwitcher';
import { OrganizationUser } from '@/types/database';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  FolderKanban,
  Wrench,
  Scissors,
  LogOut,
  ChevronRight,
  CalendarCheck2,
  Clock,
  Settings,
  MessageSquare,
  PackageCheck,
  Wallet,
  BarChart3,
  Crown,
} from 'lucide-react';
import { logoutAction } from '@/app/(auth)/actions';
import { MasterRolePreview } from '@/lib/supabase/server';
import { SystemBranding } from '@/types/system-assets';
import BrandLogo from './BrandLogo';

interface SidebarProps {
  organizations: OrganizationUser[];
  activeOrgId: string;
  userName: string;
  systemRole?: string;
  userRole?: string;
  previewRole?: MasterRolePreview | null;
  hasOrgMembership?: boolean;
  systemBranding?: SystemBranding;
}

export function Sidebar({
  organizations,
  activeOrgId,
  userName,
  systemRole,
  userRole = 'admin',
  previewRole,
  hasOrgMembership = true,
  systemBranding,
}: SidebarProps) {
  const pathname = usePathname();

  // Regra de simulação visual (UI Preview) estrita ao Master
  const displayRole = (systemRole === 'master' && previewRole) ? previewRole : userRole;

  // Filtragem exclusivamente visual para o Menu Principal
  const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['master', 'admin', 'receptionist'] },
    { label: 'Atendimentos', href: '/atendimentos', icon: CalendarCheck2, roles: ['master', 'admin', 'receptionist', 'professional'] },
    { label: 'Pacotes e Planos', href: '/pacotes', icon: PackageCheck, roles: ['master', 'admin', 'receptionist'] },
    { label: 'Central de Retornos', href: '/retornos', icon: Clock, roles: ['master', 'admin', 'receptionist'] },
    { label: 'Financeiro', href: '/financeiro', icon: Wallet, roles: ['master', 'admin'] },
    { label: 'Relatórios', href: '/relatorios', icon: BarChart3, roles: ['master', 'admin'] },
    { label: 'Clientes', href: '/clientes', icon: Users, roles: ['master', 'admin', 'receptionist', 'professional'] },
  ].filter((item) => item.roles.includes(displayRole));

  // Cadastros da Empresa
  const cadastrosItems = [
    { label: 'Profissionais', href: '/cadastros/profissionais', icon: UserCheck, roles: ['master', 'admin', 'receptionist'] },
    { label: 'Categorias de Serviço', href: '/cadastros/categorias', icon: FolderKanban, roles: ['master', 'admin', 'receptionist'] },
    { label: 'Serviços', href: '/cadastros/servicos', icon: Wrench, roles: ['master', 'admin', 'receptionist'] },
  ].filter((item) => item.roles.includes(displayRole));

  // Configurações
  const configItems = [
    { label: 'Modelos de Mensagem', href: '/configuracoes/mensagens', icon: MessageSquare, roles: ['master', 'admin', 'receptionist'] },
    { label: 'Regras de Retorno', href: '/configuracoes/retornos', icon: Settings, roles: ['master', 'admin'] },
    { label: 'Regras de Pacotes', href: '/configuracoes/pacotes', icon: PackageCheck, roles: ['master', 'admin'] },
  ].filter((item) => item.roles.includes(displayRole));


  const activeOrgUser = organizations.find((o) => o.organization_id === activeOrgId);
  const activeOrg = activeOrgUser?.organization as any;

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 min-h-screen p-4 text-slate-700 dark:text-slate-200 justify-between shrink-0 transition-colors duration-200 shadow-xs">
        <div className="space-y-6">
          {/* Logo Brand */}
          <div className="flex items-center gap-3 px-2">
            <BrandLogo 
              type="primary" 
              srcUrl={activeOrg?.logo_url || systemBranding?.logo_primary?.public_url} 
              height={systemBranding?.logo_primary?.height} 
              className="h-8 max-w-[180px] object-contain" 
            />
          </div>

          {/* Org Switcher */}
          <OrgSwitcher organizations={organizations} activeOrgId={activeOrgId} />

          {/* Navigation Links */}
          <nav className="space-y-6">
            <div className="space-y-1">
              <p className="px-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                Menu Principal
              </p>
              {navItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-xl transition-all ${
                      isActive
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`h-4 w-4 ${isActive ? 'text-amber-500 dark:text-amber-400' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {isActive && <ChevronRight className="h-4 w-4 text-amber-500 dark:text-amber-400" />}
                  </Link>
                );
              })}
            </div>

            {cadastrosItems.length > 0 && (
              <div className="space-y-1">
                <p className="px-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                  Cadastros da Empresa
                </p>
                {cadastrosItems.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-xl transition-all ${
                        isActive
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`h-4 w-4 ${isActive ? 'text-amber-500 dark:text-amber-400' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      {isActive && <ChevronRight className="h-4 w-4 text-amber-500 dark:text-amber-400" />}
                    </Link>
                  );
                })}
              </div>
            )}

            {configItems.length > 0 && (
              <div className="space-y-1">
                <p className="px-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                  Configurações
                </p>
                {configItems.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-xl transition-all ${
                        isActive
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`h-4 w-4 ${isActive ? 'text-amber-500 dark:text-amber-400' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      {isActive && <ChevronRight className="h-4 w-4 text-amber-500 dark:text-amber-400" />}
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Seção Administrador Master da Plataforma */}
            {systemRole === 'master' && (
              <div className="space-y-1 pt-2 border-t border-slate-200 dark:border-slate-800">
                <p className="px-3 text-[11px] font-semibold text-amber-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Crown className="h-3.5 w-3.5" /> Administração Cabellos
                </p>
                <Link
                  href="/master"
                  className={`flex items-center justify-between px-3 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                    pathname.startsWith('/master')
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                      : 'text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Crown className="h-4 w-4" />
                    <span>Painel Master Global</span>
                  </div>
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </nav>
        </div>

        {/* User Footer & Logout */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="truncate px-2">
            <p className="text-xs text-slate-400 dark:text-slate-500">Conectado como</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{userName}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              title="Sair"
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 flex items-center justify-around shadow-2xl transition-colors duration-200">
        <Link
          href="/dashboard"
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[11px] font-medium transition-all ${
            pathname === '/dashboard' ? 'text-amber-500 dark:text-amber-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="h-5 w-5 mb-0.5" />
          <span>Dashboard</span>
        </Link>
        <Link
          href="/retornos"
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[11px] font-medium transition-all ${
            pathname.startsWith('/retornos') ? 'text-amber-500 dark:text-amber-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Clock className="h-5 w-5 mb-0.5" />
          <span>Retornos</span>
        </Link>
        <Link
          href="/atendimentos"
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[11px] font-medium transition-all ${
            pathname.startsWith('/atendimentos') ? 'text-amber-500 dark:text-amber-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <CalendarCheck2 className="h-5 w-5 mb-0.5" />
          <span>Atendimentos</span>
        </Link>
        <Link
          href="/clientes"
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[11px] font-medium transition-all ${
            pathname.startsWith('/clientes') ? 'text-amber-500 dark:text-amber-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Users className="h-5 w-5 mb-0.5" />
          <span>Clientes</span>
        </Link>
      </div>
    </>
  );
}
