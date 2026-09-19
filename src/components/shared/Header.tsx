'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import {
  Scissors,
  LogOut,
  ChevronDown,
  User,
  ShieldCheck,
  Settings,
  Sparkles,
  LayoutDashboard,
  CalendarCheck2,
  PackageCheck,
  Clock,
  Wallet,
  BarChart3,
  Users,
  UserCheck,
  FolderKanban,
  Wrench,
  MessageSquare,
} from 'lucide-react';
import { logoutAction } from '@/app/(auth)/actions';
import { Organization } from '@/types/database';
import { ThemeToggle } from './ThemeToggle';
import { RolePreviewSelector, RolePreviewBanner } from './RolePreviewSelector';
import { MasterRolePreview } from '@/lib/supabase/server';
import { SystemBranding } from '@/types/system-assets';
import BrandLogo from './BrandLogo';

interface HeaderProps {
  organization: Organization | null;
  userName: string;
  userEmail?: string;
  userRole?: string;
  userAvatar?: string | null;
  systemRole?: string;
  previewRole?: MasterRolePreview | null;
  hasOrgMembership?: boolean;
  systemBranding?: SystemBranding;
}

// Map path to route title and icon
const routeMap: Record<string, { title: string; subtitle: string; icon: any }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Visão geral do estabelecimento', icon: LayoutDashboard },
  '/atendimentos': { title: 'Atendimentos', subtitle: 'Gestão e agendamentos', icon: CalendarCheck2 },
  '/pacotes': { title: 'Pacotes e Planos', subtitle: 'Planos comerciais e pacotes', icon: PackageCheck },
  '/pacotes/novo': { title: 'Novo Pacote ou Plano', subtitle: 'Criação de novos pacotes', icon: PackageCheck },
  '/retornos': { title: 'Central de Retornos', subtitle: 'Retenção e acompanhamento de clientes', icon: Clock },
  '/financeiro': { title: 'Financeiro', subtitle: 'Caixa, transações e relatórios financeiros', icon: Wallet },
  '/relatorios': { title: 'Relatórios', subtitle: 'Indicadores e relatórios analíticos', icon: BarChart3 },
  '/clientes': { title: 'Clientes', subtitle: 'Base de clientes e dados', icon: Users },
  '/cadastros/profissionais': { title: 'Profissionais', subtitle: 'Equipe e profissionais parceiros', icon: UserCheck },
  '/cadastros/categorias': { title: 'Categorias de Serviço', subtitle: 'Organização do catálogo', icon: FolderKanban },
  '/cadastros/servicos': { title: 'Serviços', subtitle: 'Catálogo de serviços e valores', icon: Wrench },
  '/configuracoes/mensagens': { title: 'Modelos de Mensagem', subtitle: 'Templates de notificação WhatsApp', icon: MessageSquare },
  '/configuracoes/retornos': { title: 'Regras de Retorno', subtitle: 'Parâmetros de retorno automático', icon: Settings },
  '/configuracoes/pacotes': { title: 'Regras de Pacotes', subtitle: 'Políticas de uso e pendências', icon: PackageCheck },
};

export function Header({
  organization,
  userName,
  userEmail,
  userRole = 'admin',
  userAvatar,
  systemRole,
  previewRole,
  hasOrgMembership = true,
  systemBranding,
}: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const desktopMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const isOutsideDesktop = desktopMenuRef.current ? !desktopMenuRef.current.contains(event.target as Node) : true;
      const isOutsideMobile = mobileMenuRef.current ? !mobileMenuRef.current.contains(event.target as Node) : true;

      if (isOutsideDesktop && isOutsideMobile) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Format initials
  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Format user role label
  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'professional':
        return 'Profissional';
      case 'receptionist':
        return 'Recepção';
      default:
        return 'Usuário';
    }
  };

  // Find page title info
  const currentRouteInfo = routeMap[pathname] || {
    title: 'Cabellos',
    subtitle: organization?.name || 'Gestão de Salões & Retenção',
    icon: Sparkles,
  };
  const RouteIcon = currentRouteInfo.icon;

  return (
    <>
      {/* Banner Informativo de Simulação Visual (se ativo) */}
      <RolePreviewBanner systemRole={systemRole} currentPreviewRole={previewRole} />

      {/* ========================================================= */}
      {/* DESKTOP HEADER                                            */}
      {/* ========================================================= */}
      <header className="hidden lg:flex sticky top-0 z-30 h-16 w-full items-center justify-between px-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors duration-200 shadow-xs">
        {/* Left: Current Page Info */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-xs">
            <RouteIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
              {currentRouteInfo.title}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {currentRouteInfo.subtitle}
            </p>
          </div>
        </div>

        {/* Right: Role Preview Selector, Theme Toggle & User Profile Dropdown */}
        <div className="flex items-center gap-4">
          {/* Seletor de Simulação Visual exclusivo para Master */}
          <RolePreviewSelector
            systemRole={systemRole}
            hasOrgMembership={hasOrgMembership}
            currentPreviewRole={previewRole}
          />

          {/* Theme Toggle */}
          <ThemeToggle showLabel={true} />


          {/* User Profile Pill */}
          <div className="relative" ref={desktopMenuRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-3 p-1.5 pl-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-left group"
            >
              {/* User Avatar / Initials */}
              {userAvatar && !imgError ? (
                <img
                  src={userAvatar}
                  alt={userName}
                  onError={() => setImgError(true)}
                  className="h-8 w-8 rounded-lg object-cover ring-2 ring-amber-500/30 shadow-xs group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-bold text-xs shadow-xs ring-2 ring-amber-400/30 group-hover:scale-105 transition-transform">
                  {getInitials(userName)}
                </div>
              )}

              {/* User Info */}
              <div className="hidden xl:block pr-1">
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-tight truncate max-w-[130px]">
                  {userName}
                </p>
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                  {getRoleLabel(userRole)}
                </p>
              </div>

              <ChevronDown
                className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
                  dropdownOpen ? 'rotate-180 text-amber-500' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu Panel */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-2 z-50 animate-in fade-in-50 zoom-in-95">
                {/* Header Card */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 mb-2">
                  {userAvatar && !imgError ? (
                    <img
                      src={userAvatar}
                      alt={userName}
                      onError={() => setImgError(true)}
                      className="h-10 w-10 rounded-xl object-cover ring-2 ring-amber-500/40 shadow-xs"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-bold text-sm shadow-xs ring-2 ring-amber-400/40">
                      {getInitials(userName)}
                    </div>
                  )}

                  <div className="truncate">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{userName}</p>
                    {userEmail && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{userEmail}</p>
                    )}
                    <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-semibold">
                      <ShieldCheck className="h-3 w-3" />
                      <span>{getRoleLabel(userRole)}</span>
                    </div>
                  </div>
                </div>

                {/* Organization Item */}
                <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between mb-1">
                  <span>Estabelecimento:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[120px]">
                    {organization?.name || 'Cabellos'}
                  </span>
                </div>

                {/* Dropdown Options */}
                <div className="space-y-1">
                  {systemRole === 'master' && (
                    <Link
                      href="/master"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-xl text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors mb-1"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      <span>Painel Master Global</span>
                    </Link>
                  )}
                  <Link
                    href="/configuracoes/conta"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                  >
                    <User className="h-4 w-4" />
                    <span>{(userRole === 'admin' || systemRole === 'master') ? 'Minha Conta / Assinatura' : 'Meu Perfil e Senha'}</span>
                  </Link>
                  {(userRole === 'admin' || systemRole === 'master') && (
                    <Link
                      href="/configuracoes/estabelecimento"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                    >
                      <Settings className="h-4 w-4" />
                      <span>Configurações do Salão</span>
                    </Link>
                  )}
                </div>

                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                {/* Logout Button */}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors text-left"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sair da Conta</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ========================================================= */}
      {/* MOBILE HEADER                                             */}
      {/* ========================================================= */}
      <header className="lg:hidden sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between shadow-xs transition-colors duration-200">
        {/* Mobile Left Logo & Org */}
        <div className="flex items-center gap-2.5">
          <BrandLogo 
            type="compact" 
            srcUrl={organization?.logo_url || systemBranding?.logo_compact?.public_url || systemBranding?.logo_primary?.public_url} 
            height={systemBranding?.logo_compact?.height || 28} 
            className="h-7 max-w-[120px] object-contain" 
          />
          <div>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium truncate max-w-[150px]">
              {organization?.name || 'Estabelecimento'}
            </p>
          </div>
        </div>

        {/* Mobile Right Controls: Theme Toggle & Avatar Dropdown */}
        <div className="flex items-center gap-2.5">
          {/* Theme Toggle Button */}
          <ThemeToggle showLabel={false} />

          {/* User Profile Avatar Dropdown */}
          <div className="relative" ref={mobileMenuRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-1.5 p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {userAvatar && !imgError ? (
                <img
                  src={userAvatar}
                  alt={userName}
                  onError={() => setImgError(true)}
                  className="h-8 w-8 rounded-full object-cover ring-2 ring-amber-500/40 shadow-xs"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-bold text-xs shadow-xs ring-2 ring-amber-400/40">
                  {getInitials(userName)}
                </div>
              )}
            </button>

            {/* Mobile Dropdown Panel */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-2 z-50 animate-in fade-in-50 zoom-in-95">
                {/* Header Card */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 mb-2">
                  {userAvatar && !imgError ? (
                    <img
                      src={userAvatar}
                      alt={userName}
                      onError={() => setImgError(true)}
                      className="h-9 w-9 rounded-xl object-cover ring-2 ring-amber-500/40"
                    />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-bold text-xs shadow-xs ring-2 ring-amber-400/40">
                      {getInitials(userName)}
                    </div>
                  )}

                  <div className="truncate">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{userName}</p>
                    {userEmail && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{userEmail}</p>
                    )}
                    <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-semibold">
                      {getRoleLabel(userRole)}
                    </span>
                  </div>
                </div>

                <div className="space-y-1 mb-1">
                  <Link
                    href="/configuracoes/conta"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                  >
                    <User className="h-4 w-4" />
                    <span>{(userRole === 'admin' || systemRole === 'master') ? 'Minha Conta / Assinatura' : 'Meu Perfil e Senha'}</span>
                  </Link>
                  {(userRole === 'admin' || systemRole === 'master') && (
                    <Link
                      href="/configuracoes/estabelecimento"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                    >
                      <Settings className="h-4 w-4" />
                      <span>Configurações do Salão</span>
                    </Link>
                  )}
                </div>

                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors text-left"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sair da Conta</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
