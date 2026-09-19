'use client';

import { useTransition } from 'react';
import { togglePackageActiveAction } from './actions';
import { Badge } from '@/components/ui/badge';

interface PackageToggleSwitchProps {
  packageId: string;
  isActive: boolean;
}

export function PackageToggleSwitch({ packageId, isActive }: PackageToggleSwitchProps) {
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    startTransition(async () => {
      await togglePackageActiveAction(packageId, !isActive);
    });
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className="cursor-pointer transition-opacity hover:opacity-80 disabled:opacity-50"
      title={isActive ? 'Clique para Inativar' : 'Clique para Ativar'}
    >
      <Badge
        variant="outline"
        className={
          isActive
            ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
            : 'border-slate-700 text-slate-500 bg-slate-800/40'
        }
      >
        {isPending ? 'Salvando...' : isActive ? 'Ativo' : 'Inativo'}
      </Badge>
    </button>
  );
}
