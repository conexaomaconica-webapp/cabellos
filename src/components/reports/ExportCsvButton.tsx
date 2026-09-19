'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { exportReportCsvAction } from '@/app/(dashboard)/relatorios/actions';
import { useSearchParams } from 'next/navigation';

interface ExportCsvButtonProps {
  reportType: 'clientes_inativos' | 'clientes_atrasados' | 'servicos' | 'profissionais' | 'pacotes' | 'auditoria';
  label?: string;
}

export function ExportCsvButton({ reportType, label = 'Exportar CSV' }: ExportCsvButtonProps) {
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();

  const handleExport = async () => {
    try {
      setLoading(true);
      const period = searchParams.get('period') || 'this_month';
      const start = searchParams.get('start') || undefined;
      const end = searchParams.get('end') || undefined;

      const res = await exportReportCsvAction(reportType, period, start, end);

      const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', res.filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Erro na exportação CSV: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white border border-slate-700 transition-all disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin text-amber-400" /> : <Download className="h-4 w-4 text-amber-400" />}
      <span>{label}</span>
    </button>
  );
}
