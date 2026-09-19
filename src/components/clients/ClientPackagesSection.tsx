'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ClientPackage, Package, PaymentMethod } from '@/types/database';
import { sellClientPackageAction } from '@/app/(dashboard)/pacotes/actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PackageCheck, Plus, Sparkles, Clock, CheckCircle2, RefreshCw } from 'lucide-react';
import Link from 'next/link';

interface ClientPackagesSectionProps {
  clientId: string;
  clientPackages: ClientPackage[];
  availablePackages: Package[];
  paymentMethods: PaymentMethod[];
}

export function ClientPackagesSection({
  clientId,
  clientPackages,
  availablePackages,
  paymentMethods,
}: ClientPackagesSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);

  // Form State para Venda
  const [selectedPackageId, setSelectedPackageId] = useState<string>(availablePackages[0]?.id || '');
  const [discount, setDiscount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>(paymentMethods[0]?.id || '');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedPkg = availablePackages.find((p) => p.id === selectedPackageId);
  const originalPrice = selectedPkg ? Number(selectedPkg.price) : 0;
  const finalPrice = Math.max(0, originalPrice - discount);

  const handleOpenModal = () => {
    setIsSellModalOpen(true);
    if (selectedPkg) {
      setPaymentAmount(finalPrice);
    }
  };

  const handlePackageChange = (pkgId: string) => {
    setSelectedPackageId(pkgId);
    const p = availablePackages.find((x) => x.id === pkgId);
    if (p) {
      const price = Math.max(0, Number(p.price) - discount);
      setPaymentAmount(price);
    }
  };

  const handleDiscountChange = (val: number) => {
    setDiscount(val);
    if (selectedPkg) {
      setPaymentAmount(Math.max(0, Number(selectedPkg.price) - val));
    }
  };

  const handleSellSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedPackageId) {
      setErrorMsg('Selecione o pacote/plano comercial.');
      return;
    }

    startTransition(async () => {
      const payments = paymentAmount > 0 && selectedPaymentMethodId
        ? [{ payment_method_id: selectedPaymentMethodId, amount: paymentAmount }]
        : [];

      const result = await sellClientPackageAction({
        client_id: clientId,
        package_id: selectedPackageId,
        discount,
        notes,
        payments,
      });

      if (result.error) {
        setErrorMsg(result.error);
      } else {
        setIsSellModalOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white shadow-xl">
      <CardHeader className="border-b border-slate-200 dark:border-slate-800 flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <PackageCheck className="h-5 w-5 text-amber-400" /> Pacotes e Planos Ativos
        </CardTitle>
        <Button onClick={handleOpenModal} className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold text-xs gap-1.5 shadow-md shadow-amber-600/20">
          <Plus className="h-3.5 w-3.5" /> Vender Pacote
        </Button>
      </CardHeader>

      <CardContent className="p-6">
        {clientPackages.length === 0 ? (
          <p className="text-xs text-slate-500 italic text-center py-6">
            Este cliente não possui pacotes ou planos vigentes.
          </p>
        ) : (
          <div className="space-y-4">
            {clientPackages.map((cp) => (
              <div
                key={cp.id}
                className="p-4 rounded-xl bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-300 dark:hover:border-slate-300 dark:border-slate-700 transition-all"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-slate-100">{cp.package?.name || 'Plano/Pacote'}</span>
                    <Badge
                      variant="outline"
                      className={
                        cp.status === 'active'
                          ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                          : cp.status === 'completed'
                          ? 'border-blue-500/40 text-blue-400 bg-blue-500/10'
                          : cp.status === 'expired'
                          ? 'border-rose-500/40 text-rose-400 bg-rose-500/10'
                          : 'border-slate-300 dark:border-slate-700 text-slate-500'
                      }
                    >
                      {cp.status === 'active' ? 'Ativo' : cp.status === 'completed' ? 'Concluído' : cp.status === 'expired' ? 'Vencido' : 'Cancelado'}
                    </Badge>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Vigência: {new Date(cp.starts_at).toLocaleDateString('pt-BR')} até {new Date(cp.expires_at).toLocaleDateString('pt-BR')}
                  </p>

                  <div className="flex items-center gap-3 text-xs pt-1">
                    <span className="text-amber-400 font-semibold">
                      Pago: R$ {Number(cp.amount_paid).toFixed(2)} de R$ {Number(cp.original_price - cp.discount).toFixed(2)}
                    </span>
                    <Badge variant="outline" className={cp.payment_status === 'paid' ? 'border-emerald-500/40 text-emerald-400 text-xs' : 'border-amber-500/40 text-amber-400 text-xs'}>
                      {cp.payment_status === 'paid' ? 'Pago' : cp.payment_status === 'partial' ? 'Parcial' : 'Pendente'}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Link href={`/clientes/${clientId}/pacotes/${cp.id}`}>
                    <Button variant="outline" className="border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:bg-slate-800 text-xs">
                      Ver Contrato & Detalhes →
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Modal de Venda de Pacote */}
      {isSellModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 w-full max-w-lg space-y-5 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" /> Vender Pacote ou Plano
            </h3>

            {errorMsg && <p className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded border border-rose-500/20">{errorMsg}</p>}

            <form onSubmit={handleSellSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Selecione o Pacote / Plano *</label>
                <select
                  value={selectedPackageId}
                  onChange={(e) => handlePackageChange(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md p-2.5 text-sm text-slate-100"
                >
                  {availablePackages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} - R$ {Number(p.price).toFixed(2)} ({p.validity_value} {p.validity_type === 'months' ? 'meses' : 'dias'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Desconto (R$)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={discount}
                    onChange={(e) => handleDiscountChange(Number(e.target.value))}
                    className="bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-100 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Valor Final Venda</label>
                  <div className="p-2 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-amber-400 font-bold text-sm">
                    R$ {finalPrice.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Registro do Pagamento Inicial */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-3">
                <p className="font-semibold text-slate-700 dark:text-slate-300">Pagamento Inicial (Opcional)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-500 dark:text-slate-400">Forma de Pagamento</label>
                    <select
                      value={selectedPaymentMethodId}
                      onChange={(e) => setSelectedPaymentMethodId(e.target.value)}
                      className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 text-xs text-slate-200"
                    >
                      {paymentMethods.map((pm) => (
                        <option key={pm.id} value={pm.id}>
                          {pm.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-500 dark:text-slate-400">Valor Pago Agora (R$)</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(Number(e.target.value))}
                      className="bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-emerald-400 font-semibold text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Observações</label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Pagamento 1ª parcela em dinheiro"
                  className="bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-100 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <Button type="button" variant="outline" onClick={() => setIsSellModalOpen(false)} className="border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                  Cancelar
                </Button>
                <Button type="submit" disabled={isPending} className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold px-4">
                  {isPending ? 'Concluindo...' : 'Concluir Venda'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}
