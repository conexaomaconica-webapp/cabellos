'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { masterManageUserSystemRole } from '@/lib/master/actions';
import { SystemRole } from '@/types/master';
import { Crown, AlertTriangle } from 'lucide-react';

export default function MasterUserRoleClientModal({
  userId,
  userEmail,
  currentRole,
  masterCount,
}: {
  userId: string;
  userEmail: string;
  currentRole: SystemRole;
  masterCount: number;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleToggleRole = async () => {
    const newRole: SystemRole = currentRole === 'master' ? 'user' : 'master';

    if (currentRole === 'master' && masterCount <= 1) {
      alert('Operação bloqueada: Impossível rebaixar o único Master ativo da plataforma!');
      return;
    }

    const actionText = newRole === 'master' ? 'PROMOVER A MASTER' : 'REBAIXAR A USER';
    if (!confirm(`Confirma ${actionText} o usuário ${userEmail}?`)) {
      return;
    }

    setLoading(true);
    try {
      await masterManageUserSystemRole(userId, newRole);
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Falha ao alterar o papel do usuário.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      disabled={loading}
      onClick={handleToggleRole}
      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
        currentRole === 'master'
          ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
          : 'bg-purple-600/80 hover:bg-purple-600 text-white shadow'
      }`}
    >
      {loading
        ? 'Processando...'
        : currentRole === 'master'
        ? 'Rebaixar para User'
        : 'Promover a Master'}
    </button>
  );
}
