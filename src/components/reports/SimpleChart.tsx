'use client';

import { formatCurrency } from '@/lib/reports';

interface LineChartSeries {
  date: string;
  producao?: number;
  recebimentos?: number;
  despesas?: number;
  resultado_caixa?: number;
}

interface SimpleLineChartProps {
  title: string;
  data: LineChartSeries[];
}

export function SimpleLineChart({ title, data }: SimpleLineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="p-6 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl text-center text-slate-500 dark:text-slate-400 text-sm shadow-xs">
        Ainda não há dados suficientes para este período.
      </div>
    );
  }

  // Obter valores máximos para escala
  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.producao || 0, d.recebimentos || 0, d.despesas || 0)),
    100
  );

  const height = 180;
  const width = 600;
  const padding = 20;

  const getPoints = (key: keyof LineChartSeries) => {
    if (data.length === 1) {
      const y = height - padding - ((Number(data[0][key] || 0) / maxVal) * (height - 2 * padding));
      return `${width / 2},${y}`;
    }

    return data
      .map((d, i) => {
        const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
        const val = Number(d[key] || 0);
        const y = height - padding - ((val / maxVal) * (height - 2 * padding));
        return `${x},${y}`;
      })
      .join(' ');
  };

  return (
    <div className="p-5 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4 shadow-xs">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Produção
          </span>
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" /> Recebimentos
          </span>
          <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block" /> Despesas
          </span>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44 overflow-visible">
          {/* Linhas Guia */}
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeDasharray="3 3" />
          <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeDasharray="3 3" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="currentColor" className="text-slate-300 dark:text-slate-700" />

          {/* Linha Produção */}
          <polyline fill="none" stroke="#f59e0b" strokeWidth="2.5" points={getPoints('producao')} />

          {/* Linha Recebimentos */}
          <polyline fill="none" stroke="#10b981" strokeWidth="2.5" points={getPoints('recebimentos')} />

          {/* Linha Despesas */}
          <polyline fill="none" stroke="#f43f5e" strokeWidth="2" strokeDasharray="4 2" points={getPoints('despesas')} />
        </svg>
      </div>

      {/* Tabela Numérica */}
      <div className="overflow-x-auto pt-2 border-t border-slate-100 dark:border-slate-800">
        <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase">
              <th className="py-2 px-3">Data</th>
              <th className="py-2 px-3 text-right">Produção</th>
              <th className="py-2 px-3 text-right">Recebimentos</th>
              <th className="py-2 px-3 text-right">Despesas</th>
              <th className="py-2 px-3 text-right">Resultado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {data.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <td className="py-2 px-3 font-medium text-slate-900 dark:text-slate-200">{item.date}</td>
                <td className="py-2 px-3 text-right text-amber-600 dark:text-amber-400 font-semibold">{formatCurrency(item.producao)}</td>
                <td className="py-2 px-3 text-right text-emerald-600 dark:text-emerald-400 font-semibold">{formatCurrency(item.recebimentos)}</td>
                <td className="py-2 px-3 text-right text-rose-600 dark:text-rose-400 font-semibold">{formatCurrency(item.despesas)}</td>
                <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-white">{formatCurrency(item.resultado_caixa)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface BarChartItem {
  label: string;
  value: number;
  secondaryValue?: number;
}

interface SimpleBarChartProps {
  title: string;
  data: BarChartItem[];
  valueFormatter?: (val: number) => string;
}

export function SimpleBarChart({ title, data, valueFormatter = formatCurrency }: SimpleBarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="p-6 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl text-center text-slate-500 dark:text-slate-400 text-sm shadow-xs">
        Ainda não há dados suficientes para este período.
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="p-5 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4 shadow-xs">
      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>

      <div className="space-y-3">
        {data.slice(0, 10).map((item, idx) => {
          const widthPct = Math.min(100, Math.max(5, (item.value / maxVal) * 100));
          return (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-slate-800 dark:text-slate-200">{item.label}</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">{valueFormatter(item.value)}</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
