'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, ShieldCheck, UserCheck, Scissors, Crown, X, Info } from 'lucide-react';
import { setMasterRolePreviewAction } from '@/lib/master/preview-actions';
import { MasterRolePreview } from '@/lib/supabase/server';

interface RolePreviewSelectorProps {
  systemRole?: string;
  hasOrgMembership?: boolean;
  currentPreviewRole?: MasterRolePreview | null;
}

export function RolePreviewSelector({
  systemRole,
  hasOrgMembership = true,
  currentPreviewRole = 'master',
}: RolePreviewSelectorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);

  // Apenas usuários com system_role === 'master' visualizam o simulador
  if (systemRole !== 'master') {
    return null;
  }

  const activeRole: MasterRolePreview = currentPreviewRole || 'master';

  const roleOptions: { id: MasterRolePreview; label: string; sub: string; icon: any; color: string }[] = [
    {
      id: 'master',
      label: 'Visão Master Global',
      sub: 'Acesso completo ao Painel Master e gestão do salão',
      icon: Crown,
      color: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
    },
    {
      id: 'admin',
      label: 'Visão Administrador',
      sub: 'Dono/Gerente do salão (Dashboard, Financeiro, Relatórios)',
      icon: ShieldCheck,
      color: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
    },
    {
      id: 'receptionist',
      label: 'Visão Recepção',
      sub: 'Atendimentos, Clientes, Agenda (sem Financeiro sensível)',
      icon: UserCheck,
      color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
    },
    {
      id: 'professional',
      label: 'Visão Profissional',
      sub: 'Sua própria agenda e atendimentos vinculados',
      icon: Scissors,
      color: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
    },
  ];

  const handleSelectRole = (role: MasterRolePreview) => {
    startTransition(async () => {
      await setMasterRolePreviewAction(role);
      setIsOpen(false);
      router.refresh();
    });
  };

  const handleReset = () => {
    startTransition(async () => {
      await setMasterRolePreviewAction('master');
      setIsOpen(false);
      router.refresh();
    });
  };

  const activeOption = roleOptions.find((r) => r.id === activeRole) || roleOptions[0];
  const ActiveIcon = activeOption.icon;

  return (
    <>
      {/* Selector Control Pill in Header */}
      <div className="relative">
        {!hasOrgMembership ? (
          <div
            title="Selecione uma organização na qual você possua acesso operacional para pré-visualizar os papéis do salão."
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 text-xs cursor-not-allowed opacity-75"
          >
            <Eye className="h-3.5 w-3.5" />
            <span className="font-medium hidden sm:inline">Simulador de Papéis</span>
            <Info className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
          </div>
        ) : (
          <button
            onClick={() => setIsOpen(!isOpen)}
            disabled={isPending}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all shadow-xs ${
              activeRole !== 'master'
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold ring-2 ring-amber-400/40'
                : 'bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
            }`}
          >
            <Eye className={`h-3.5 w-3.5 ${activeRole !== 'master' ? 'text-slate-950 animate-pulse' : 'text-amber-500'}`} />
            <span>{activeRole !== 'master' ? `Simulação: ${activeOption.label.replace('Visão ', '')}` : 'Simular Papel'}</span>
          </button>
        )}

        {/* Dropdown Menu */}
        {isOpen && hasOrgMembership && (
          <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-2 z-50 animate-in fade-in-50 zoom-in-95">
            <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Eye className="h-4 w-4 text-amber-500" /> Simulador Visual (QA)
                </span>
                {activeRole !== 'master' && (
                  <button
                    onClick={handleReset}
                    className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline font-semibold"
                  >
                    Resetar
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                Altera exclusivamente os elementos visuais do menu. Suas permissões reais no banco permanecem inalteradas.
              </p>
            </div>

            <div className="space-y-1">
              {roleOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = activeRole === option.id;

                return (
                  <button
                    key={option.id}
                    onClick={() => handleSelectRole(option.id)}
                    disabled={isPending}
                    className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start gap-2.5 ${
                      isSelected
                        ? 'bg-amber-500/10 border border-amber-500/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-transparent'
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${option.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-bold ${isSelected ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'}`}>
                        {option.label}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                        {option.sub}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export function RolePreviewBanner({
  systemRole,
  currentPreviewRole,
}: {
  systemRole?: string;
  currentPreviewRole?: MasterRolePreview | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (systemRole !== 'master' || !currentPreviewRole || currentPreviewRole === 'master') {
    return null;
  }

  const roleLabels: Record<MasterRolePreview, string> = {
    master: 'Master Global',
    admin: 'Administrador',
    receptionist: 'Recepção',
    professional: 'Profissional',
  };

  const handleReset = () => {
    startTransition(async () => {
      await setMasterRolePreviewAction('master');
      router.refresh();
    });
  };

  return (
    <div className="bg-amber-500 text-slate-950 px-4 py-1.5 flex items-center justify-between text-xs font-medium shadow-sm transition-all animate-in slide-in-from-top-2">
      <div className="flex items-center gap-2 truncate">
        <Eye className="h-4 w-4 shrink-0 animate-bounce" />
        <span className="font-bold truncate">
          Modo de visualização ativado: {roleLabels[currentPreviewRole] || currentPreviewRole}
        </span>
        <span className="hidden md:inline text-[11px] opacity-90 border-l border-slate-950/20 pl-2">
          Esta simulação altera apenas a interface. Suas permissões reais de banco e acesso não foram alteradas.
        </span>
      </div>

      <button
        onClick={handleReset}
        disabled={isPending}
        className="flex items-center gap-1 bg-slate-950/10 hover:bg-slate-950/20 text-slate-950 px-2 py-0.5 rounded-lg text-[11px] font-bold transition-colors shrink-0 ml-2"
      >
        <span>Encerrar simulação</span>
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
