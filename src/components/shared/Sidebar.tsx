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
} from 'lucide-react';
import { logoutAction } from '@/app/(auth)/actions';

interface SidebarProps {
  organizations: OrganizationUser[];
  activeOrgId: string;
  userName: string;
}

export function Sidebar({ organizations, activeOrgId, userName }: SidebarProps) {
  const pathname = usePathname();

  const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Atendimentos', href: '/atendimentos', icon: CalendarCheck2 },
    { label: 'Central de Retornos', href: '/retornos', icon: Clock },
    { label: 'Clientes', href: '/clientes', icon: Users },
  ];

  const cadastrosItems = [
    { label: 'Profissionais', href: '/cadastros/profissionais', icon: UserCheck },
    { label: 'Categorias de Serviço', href: '/cadastros/categorias', icon: FolderKanban },
    { label: 'Serviços', href: '/cadastros/servicos', icon: Wrench },
  ];

  const configItems = [
    { label: 'Modelos de Mensagem', href: '/configuracoes/mensagens', icon: MessageSquare },
    { label: 'Regras de Retorno', href: '/configuracoes/retornos', icon: Settings },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-slate-800 bg-slate-900 min-h-screen p-4 text-slate-200 justify-between shrink-0">
        <div className="space-y-6">
          {/* Logo Brand */}
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-slate-950 font-bold shadow-lg">
              <Scissors className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-white leading-none tracking-tight">Cabellos</h1>
              <p className="text-[11px] text-slate-400 mt-0.5">Gestão de Salões & Retenção</p>
            </div>
          </div>

          {/* Org Switcher */}
          <OrgSwitcher organizations={organizations} activeOrgId={activeOrgId} />

          {/* Navigation Links */}
          <nav className="space-y-6">
            <div className="space-y-1">
              <p className="px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
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
                        ? 'bg-amber-500/10 text-amber-400 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`h-4 w-4 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {isActive && <ChevronRight className="h-4 w-4 text-amber-400" />}
                  </Link>
                );
              })}
            </div>

            <div className="space-y-1">
              <p className="px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
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
                        ? 'bg-amber-500/10 text-amber-400 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`h-4 w-4 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {isActive && <ChevronRight className="h-4 w-4 text-amber-400" />}
                  </Link>
                );
              })}
            </div>

            <div className="space-y-1">
              <p className="px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
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
                        ? 'bg-amber-500/10 text-amber-400 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`h-4 w-4 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {isActive && <ChevronRight className="h-4 w-4 text-amber-400" />}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>

        {/* User Footer & Logout */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <div className="truncate px-2">
            <p className="text-xs text-slate-400">Conectado como</p>
            <p className="text-sm font-medium text-white truncate">{userName}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              title="Sair"
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-800 px-2 py-1.5 flex items-center justify-around shadow-2xl">
        <Link
          href="/dashboard"
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[11px] font-medium transition-all ${
            pathname === '/dashboard' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="h-5 w-5 mb-0.5" />
          <span>Dashboard</span>
        </Link>
        <Link
          href="/retornos"
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[11px] font-medium transition-all ${
            pathname.startsWith('/retornos') ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="h-5 w-5 mb-0.5" />
          <span>Retornos</span>
        </Link>
        <Link
          href="/atendimentos"
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[11px] font-medium transition-all ${
            pathname.startsWith('/atendimentos') ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CalendarCheck2 className="h-5 w-5 mb-0.5" />
          <span>Atendimentos</span>
        </Link>
        <Link
          href="/clientes"
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[11px] font-medium transition-all ${
            pathname.startsWith('/clientes') ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="h-5 w-5 mb-0.5" />
          <span>Clientes</span>
        </Link>
      </div>
    </>
  );
}
