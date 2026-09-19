'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addManualTransactionAction } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, DollarSign, X } from 'lucide-react';

interface ManualTransactionModalProps {
  paymentMethods: any[];
  categories: any[];
}

export function ManualTransactionModal({ paymentMethods, categories }: ManualTransactionModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [type, setType] = useState<'income' | 'expense'>('income');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethodId, setPaymentMethodId] = useState(paymentMethods[0]?.id || '');
  const [description, setDescription] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (amount <= 0) {
      setErrorMsg('Informe um valor maior que 0.');
      return;
    }
    if (!description.trim()) {
      setErrorMsg('Informe uma descrição.');
      return;
    }

    startTransition(async () => {
      const res = await addManualTransactionAction({
        type,
        category_id: categoryId || undefined,
        amount,
        payment_method_id: paymentMethodId,
        description,
      });

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setIsOpen(false);
        setAmount(0);
        setDescription('');
        router.refresh();
      }
    });
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)} variant="outline" className="border-slate-800 text-slate-300 hover:bg-slate-800 text-xs gap-1.5">
        <Plus className="w-3.5 h-3.5" /> Lançamento Manual
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md space-y-4 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-400" /> Registrar Transação Manual
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && <p className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded border border-rose-500/20">{errorMsg}</p>}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setType('income')}
                  className={`flex-1 py-2 rounded-lg font-semibold border transition-all ${
                    type === 'income' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  + Receita (Entrada)
                </button>
                <button
                  type="button"
                  onClick={() => setType('expense')}
                  className={`flex-1 py-2 rounded-lg font-semibold border transition-all ${
                    type === 'expense' ? 'bg-rose-500/10 border-rose-500 text-rose-400' : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  - Despesa (Saída)
                </button>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Valor (R$) *</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount || ''}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="bg-slate-950 border-slate-800 text-amber-400 font-bold text-base"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Descrição *</label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Venda de produto avulso ou Conta de Luz"
                  className="bg-slate-950 border-slate-800 text-slate-100 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">Categoria</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200"
                  >
                    <option value="">Selecione...</option>
                    {categories
                      .filter((c) => c.type === type)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">Forma de Pagto *</label>
                  <select
                    value={paymentMethodId}
                    onChange={(e) => setPaymentMethodId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200"
                  >
                    {paymentMethods.map((pm) => (
                      <option key={pm.id} value={pm.id}>
                        {pm.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="border-slate-800 text-slate-300">
                  Cancelar
                </Button>
                <Button type="submit" disabled={isPending} className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold px-4">
                  {isPending ? 'Gravando...' : 'Salvar Transação'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
