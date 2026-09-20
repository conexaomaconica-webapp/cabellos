'use client';

import { useState, useEffect, useRef } from 'react';
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
  Menu,
  X,
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
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const mobileSidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (isMobileSidebarOpen && mobileSidebarRef.current && !mobileSidebarRef.current.contains(event.target as Node)) {
        setIsMobileSidebarOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobileSidebarOpen]);

  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [pathname]);

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

      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 h-16 flex items-center justify-around shadow-2xl transition-colors duration-200">
        <Link
          href="/dashboard"
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-medium transition-all w-16 ${
            pathname === '/dashboard' ? 'text-amber-500 dark:text-amber-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="h-5 w-5 mb-0.5" />
          <span>Dashboard</span>
        </Link>

        <Link
          href="/retornos"
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-medium transition-all w-16 ${
            pathname.startsWith('/retornos') ? 'text-amber-500 dark:text-amber-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Clock className="h-5 w-5 mb-0.5" />
          <span>Retornos</span>
        </Link>

        {/* BOTÃO CENTRAL ELEVADO - ATENDIMENTO */}
        <Link
          href="/atendimentos"
          className="relative -top-5 flex flex-col items-center justify-center w-16 h-16 rounded-full bg-amber-500 shadow-xl shadow-amber-500/30 border-4 border-white dark:border-slate-900 text-blue-950 hover:bg-amber-400 transition-transform active:scale-95"
        >
          <Scissors className="h-6 w-6" />
          <span className="text-[8px] font-extrabold mt-0.5 tracking-tight uppercase">Atendimento</span>
        </Link>

        <Link
          href="/clientes"
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-medium transition-all w-16 ${
            pathname.startsWith('/clientes') ? 'text-amber-500 dark:text-amber-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Users className="h-5 w-5 mb-0.5" />
          <span>Clientes</span>
        </Link>

        <button
          onClick={() => setIsMobileSidebarOpen(true)}
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-medium transition-all w-16 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200`}
        >
          <Menu className="h-5 w-5 mb-0.5" />
          <span>Menu</span>
        </button>
      </div>

      {/* Overlay Background for Mobile Sidebar */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] lg:hidden animate-in fade-in" />
      )}

      {/* Mobile Slide-over Sidebar */}
      <div 
        ref={mobileSidebarRef}
        className={`fixed inset-y-0 right-0 w-[280px] bg-white dark:bg-slate-900 shadow-2xl z-[70] lg:hidden transform transition-transform duration-300 ease-in-out flex flex-col ${
          isMobileSidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <BrandLogo 
            type="primary" 
            srcUrl={activeOrg?.logo_url || systemBranding?.logo_primary?.public_url} 
            height={systemBranding?.logo_primary?.height || 28} 
            className="h-8 max-w-[150px] object-contain" 
          />
          <button 
            onClick={() => setIsMobileSidebarOpen(false)} 
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <OrgSwitcher 
            organizations={organizations} 
            activeOrgId={activeOrgId} 
          />

          <nav className="space-y-6">
            <div>
              <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Menu Principal
              </p>
              <div className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-xl transition-all ${
                        isActive
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                          : 'text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {cadastrosItems.length > 0 && (
              <div>
                <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Cadastros da Empresa
                </p>
                <div className="space-y-1">
                  {cadastrosItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsMobileSidebarOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-xl transition-all ${
                          isActive
                            ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                            : 'text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {configItems.length > 0 && (
              <div>
                <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Configurações
                </p>
                <div className="space-y-1">
                  {configItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsMobileSidebarOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-xl transition-all ${
                          isActive
                            ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                            : 'text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {displayRole === 'master' && (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <Link
                  href="/master"
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className={`flex items-center justify-between px-3 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                    pathname.startsWith('/master')
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                      : 'text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Crown className="h-4 w-4" />
                    <span>Painel Master</span>
                  </div>
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </nav>
        </div>

        <div className="pt-4 pb-6 px-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="truncate px-2">
            <p className="text-[10px] text-slate-400 dark:text-slate-500">Conectado como</p>
            <p className="text-xs font-semibold text-slate-900 dark:text-white truncate max-w-[180px]">{userName}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
