'use client';

import { Scissors, LogOut } from 'lucide-react';
import { logoutAction } from '@/app/(auth)/actions';
import { Organization } from '@/types/database';

interface HeaderProps {
  organization: Organization | null;
  userName: string;
}

export function Header({ organization, userName }: HeaderProps) {
  return (
    <header className="lg:hidden bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-slate-950 font-bold">
          <Scissors className="h-4 w-4" />
        </div>
        <div>
          <h1 className="font-bold text-sm text-white leading-tight">Cabellos</h1>
          <p className="text-[11px] text-amber-400 font-medium truncate max-w-[160px]">
            {organization?.name || 'Estabelecimento'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-400 max-w-[100px] truncate">{userName}</span>
        <form action={logoutAction}>
          <button
            type="submit"
            title="Sair"
            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </form>
      </div>
    </header>
  );
}
