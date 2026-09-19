'use client';

import React, { useState } from 'react';
import { downloadBackupUrlAction } from '@/lib/master/actions';
import { Download } from 'lucide-react';

export default function MasterBackupClientButton({ backupId }: { backupId: string }) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const url = await downloadBackupUrlAction(backupId);
      window.open(url, '_blank');
    } catch (err: any) {
      alert(err.message || 'Falha ao gerar URL de download.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      disabled={loading}
      onClick={handleDownload}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/80 hover:bg-purple-600 text-white text-xs font-bold transition-all shadow"
    >
      <Download className="h-3.5 w-3.5" />
      {loading ? 'Obtendo URL...' : 'Baixar Exportação'}
    </button>
  );
}
