'use client';

import { useState } from 'react';
import { OrganizationUser } from '@/types/database';
import { Building2, ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OrgSwitcherProps {
  organizations: OrganizationUser[];
  activeOrgId: string;
}

export function OrgSwitcher({ organizations, activeOrgId }: OrgSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activeOrg = organizations.find((ou) => ou.organization_id === activeOrgId)?.organization;

  if (!activeOrg) return null;

  async function handleSwitchOrg(orgId: string) {
    if (orgId === activeOrgId) {
      setIsOpen(false);
      return;
    }
    // Set active org cookie and reload page
    document.cookie = `cabellos_active_org_id=${orgId}; path=/; max-age=31536000; SameSite=Lax`;
    window.location.reload();
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 h-auto text-left hover:bg-slate-800/60 rounded-xl transition-all border border-slate-800"
      >
        <div className="flex items-center gap-2.5 truncate">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white font-bold text-xs shadow"
            style={{ backgroundColor: activeOrg.primary_color || '#0f172a' }}
          >
            {activeOrg.name.substring(0, 2).toUpperCase()}
          </div>
          <div className="truncate text-left">
            <p className="text-xs text-slate-400 font-medium leading-none">Estabelecimento</p>
            <p className="text-sm font-semibold text-slate-100 truncate mt-0.5">{activeOrg.name}</p>
          </div>
        </div>
        <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
      </Button>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-2 z-50 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-1.5 animate-in fade-in-50 zoom-in-95">
          <p className="px-2.5 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Seus Estabelecimentos
          </p>
          <div className="space-y-0.5 max-h-48 overflow-y-auto">
            {organizations.map((ou) => {
              const org = ou.organization;
              if (!org) return null;
              const isCurrent = org.id === activeOrgId;

              return (
                <button
                  key={org.id}
                  onClick={() => handleSwitchOrg(org.id)}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 text-xs rounded-lg transition-colors text-left ${
                    isCurrent
                      ? 'bg-amber-500/10 text-amber-400 font-medium'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <div
                      className="h-5 w-5 rounded shrink-0 flex items-center justify-center text-[10px] text-white font-bold"
                      style={{ backgroundColor: org.primary_color || '#0f172a' }}
                    >
                      {org.name.substring(0, 1).toUpperCase()}
                    </div>
                    <span className="truncate">{org.name}</span>
                  </div>
                  {isCurrent && <Check className="h-4 w-4 text-amber-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
