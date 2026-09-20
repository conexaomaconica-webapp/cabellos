'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  Menu,
  X,
} from 'lucide-react';
import BrandLogo from '@/components/shared/BrandLogo';

export default function MasterSidebar({
  userName,
  systemBranding,
}: {
  userName: string;
  systemBranding: any;
}) {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const navItems = [
    { href: '/master', label: 'Visão Geral', icon: LayoutDashboard, exact: true },
    { href: '/master/organizacoes', label: 'Salões / Tenants', icon: Building2 },
    { href: '/master/usuarios', label: 'Usuários Globais', icon: Users },
    { href: '/master/planos', label: 'Planos SaaS', icon: CreditCard },
    { href: '/master/assinaturas', label: 'Assinaturas', icon: Calendar },
    { href: '/master/backups', label: 'Backups & Exportações', icon: HardDriveDownload },
    { href: '/master/auditoria', label: 'Trilha de Auditoria', icon: ShieldCheck },
    { href: '/master/sistema', label: 'Identidade do Sistema', icon: Sparkles },
    { href: '/master/configuracoes', label: 'Configurações', icon: Settings },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full justify-between">
      <div className="space-y-6">
        {/* HEADER BRAND */}
        <div className="flex items-center gap-3 px-2 py-3 bg-purple-950/40 border border-purple-800/40 rounded-xl">
          <BrandLogo
            type="primary"
            srcUrl={systemBranding?.logo_primary?.public_url}
            height={systemBranding?.logo_primary?.height}
            className="h-8 max-w-[150px] object-contain"
          />
        </div>

        {/* NAVEGAÇÃO MASTER */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-purple-400'}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* FOOTER MASTER */}
      <div className="pt-6 border-t border-slate-800 mt-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center border border-amber-500/30 shrink-0">
            <Crown className="h-4 w-4" />
          </div>
          <div className="truncate">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Logado como</p>
            <p className="text-sm font-bold text-slate-200 truncate">{userName}</p>
          </div>
        </div>
        <Link
          href="/dashboard"
          title="Ir para Dashboard Salão"
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors shrink-0"
        >
          <LogOut className="h-5 w-5" />
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* HEADER MOBILE */}
      <div className="md:hidden flex items-center justify-between bg-slate-900 border-b border-slate-800 p-4 shrink-0">
        <BrandLogo
          type="primary"
          srcUrl={systemBranding?.logo_primary?.public_url}
          height={systemBranding?.logo_primary?.height}
          className="h-7"
        />
        <button
          onClick={() => setIsMobileOpen(true)}
          className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* OVERLAY MOBILE */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-in fade-in"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* SIDEBAR DESKTOP */}
      <aside className="hidden md:flex w-64 bg-slate-900 border-r border-slate-800 p-4 flex-col shrink-0 min-h-screen sticky top-0">
        <SidebarContent />
      </aside>

      {/* SIDEBAR MOBILE OFFCANVAS */}
      <aside
        className={`fixed inset-y-0 right-0 w-[280px] bg-slate-900 shadow-2xl z-50 md:hidden transform transition-transform duration-300 ease-in-out p-4 flex flex-col ${
          isMobileOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setIsMobileOpen(false)}
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarContent />
        </div>
      </aside>
    </>
  );
}
