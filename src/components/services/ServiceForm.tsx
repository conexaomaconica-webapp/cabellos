'use client';

import { useState } from 'react';
import { Service, ServiceCategory } from '@/types/database';
import { createServiceAction, updateServiceAction } from '@/app/(dashboard)/cadastros/servicos/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Wrench, DollarSign, Clock, RotateCcw, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface ServiceFormProps {
  service?: Service;
  categories: ServiceCategory[];
}

export function ServiceForm({ service, categories }: ServiceFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    let res;

    if (service) {
      res = await updateServiceAction(service.id, formData);
    } else {
      res = await createServiceAction(formData);
    }

    if (res?.error) {
      setError(res.error);
      setLoading(false);
    }
  }

  return (
    <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-100 shadow-xl">
      <CardContent className="p-6">
        {error && (
          <div className="mb-6 rounded-lg bg-red-950/60 border border-red-800/80 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Nome do Serviço <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Wrench className="absolute left-3 top-3 h-4 w-4 text-slate-500 dark:text-slate-400" />
              <Input
                name="name"
                defaultValue={service?.name || ''}
                placeholder="Ex: Corte Masculino, Barba com Toalha Quente..."
                required
                className="pl-9 bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-500 focus-visible:ring-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Categoria</label>
              <select
                name="category_id"
                defaultValue={service?.category_id || ''}
                className="w-full h-11 px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <option value="">Sem Categoria</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Preço (R$) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-slate-500 dark:text-slate-400" />
                <Input
                  name="price"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={service?.price || ''}
                  placeholder="50.00"
                  required
                  className="pl-9 bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-500 focus-visible:ring-amber-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Duração Estimada (Minutos) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-3 h-4 w-4 text-slate-500 dark:text-slate-400" />
                <Input
                  name="duration_minutes"
                  type="number"
                  min="1"
                  defaultValue={service?.duration_minutes || 30}
                  placeholder="30"
                  required
                  className="pl-9 bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-500 focus-visible:ring-amber-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Intervalo Padrão de Retorno (Dias)</span>
                <span className="text-amber-400 font-mono text-xs">Padrão da regra</span>
              </label>
              <div className="relative">
                <RotateCcw className="absolute left-3 top-3 h-4 w-4 text-slate-500 dark:text-slate-400" />
                <Input
                  name="default_return_interval_days"
                  type="number"
                  min="1"
                  defaultValue={service?.default_return_interval_days || 15}
                  placeholder="15"
                  className="pl-9 bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-500 focus-visible:ring-amber-500"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Descrição do Serviço</label>
            <textarea
              name="description"
              rows={3}
              defaultValue={service?.description || ''}
              placeholder="Descreva os produtos utilizados e os passos do serviço..."
              className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 p-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="counts_for_return_frequency"
              name="counts_for_return_frequency"
              defaultChecked={service ? service.counts_for_return_frequency : true}
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-purple-500 focus:ring-amber-500"
            />
            <label htmlFor="counts_for_return_frequency" className="text-xs text-slate-700 dark:text-slate-300">
              Contabilizar este serviço no cálculo de frequência média do cliente
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <Link href="/cadastros/servicos">
              <Button type="button" variant="secondary" className="bg-slate-50 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300">
                Cancelar
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={loading}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-6 shadow-lg"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Salvando...
                </span>
              ) : service ? (
                'Atualizar Serviço'
              ) : (
                'Salvar Serviço'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
