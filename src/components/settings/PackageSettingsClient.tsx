'use client';

import { useState } from 'react';
import { updateTenantPackageConfigAction } from '@/app/(dashboard)/pacotes/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PackageCheck, Save, Loader2, DollarSign, BellRing, Users } from 'lucide-react';

interface PackageSettingsProps {
  initialAllowPending?: boolean;
  initialRequireFullPayment?: boolean;
  initialAutoNotifyExpiration?: boolean;
  initialExpirationWarningDays?: number;
  initialAllowShareFamily?: boolean;
}

export function PackageSettingsClient({
  initialAllowPending = true,
  initialRequireFullPayment = false,
  initialAutoNotifyExpiration = true,
  initialExpirationWarningDays = 7,
  initialAllowShareFamily = false,
}: PackageSettingsProps) {
  const [allowPending, setAllowPending] = useState(initialAllowPending);
  const [requireFullPayment, setRequireFullPayment] = useState(initialRequireFullPayment);
  const [autoNotifyExpiration, setAutoNotifyExpiration] = useState(initialAutoNotifyExpiration);
  const [expirationWarningDays, setExpirationWarningDays] = useState(initialExpirationWarningDays);
  const [allowShareFamily, setAllowShareFamily] = useState(initialAllowShareFamily);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const res = await updateTenantPackageConfigAction({
      allowPendingBalance: allowPending,
      requireFullPayment,
      autoNotifyExpiration,
      expirationWarningDays: Number(expirationWarningDays),
      allowShareFamily,
    });

    setLoading(false);
    if (res?.error) {
      setMessage({ type: 'error', text: res.error });
    } else {
      setMessage({ type: 'success', text: 'Configurações de pacotes salvas com sucesso!' });
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <PackageCheck className="h-6 w-6 text-amber-400" /> Configurações de Pacotes e Planos
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Defina as regras financeiras, alertas de expiração e permissões de utilização para pacotes no seu estabelecimento.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {message && (
          <div
            className={`p-4 rounded-xl border text-sm font-medium ${
              message.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                : 'bg-red-950/60 border-red-800 text-red-300'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Card 1: Regras Financeiras */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white shadow-xl">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-amber-400" /> Regras Financeiras e Liberação
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400 text-xs">
              Controle a liberação de saldos e créditos para clientes com pagamentos parciais ou pendentes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-sm text-slate-900 dark:text-white">Permitir uso de pacote com saldo financeiro pendente</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Se ativado, clientes com pacotes pagos parcialmente continuam autorizados a abater saldos nos atendimentos. Se desativado, somente contratos totalmente pagos poderão ser consumidos.
                </p>
              </div>
              <input
                type="checkbox"
                checked={allowPending}
                onChange={(e) => setAllowPending(e.target.checked)}
                className="h-5 w-5 rounded border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-amber-500 focus:ring-amber-500 cursor-pointer shrink-0"
              />
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-sm text-slate-900 dark:text-white">Exigir quitação integral na venda do pacote</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Exige pagamento de 100% do valor total do pacote antes de liberar o primeiro agendamento.
                </p>
              </div>
              <input
                type="checkbox"
                checked={requireFullPayment}
                onChange={(e) => setRequireFullPayment(e.target.checked)}
                className="h-5 w-5 rounded border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-amber-500 focus:ring-amber-500 cursor-pointer shrink-0"
              />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Alertas e Validade */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white shadow-xl">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BellRing className="h-5 w-5 text-emerald-400" /> Alertas de Expiração e Vencimento
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400 text-xs">
              Mantenha os clientes informados para renovação antes do término do prazo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-sm text-slate-900 dark:text-white">Notificar cliente sobre vencimento próximo</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Dispara aviso automático via WhatsApp / E-mail lembrando da expiração dos créditos ou renovação do plano.
                </p>
              </div>
              <input
                type="checkbox"
                checked={autoNotifyExpiration}
                onChange={(e) => setAutoNotifyExpiration(e.target.checked)}
                className="h-5 w-5 rounded border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-emerald-500 focus:ring-emerald-500 cursor-pointer shrink-0"
              />
            </div>

            {autoNotifyExpiration && (
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm text-slate-900 dark:text-white">Aviso prévio de expiração (dias)</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Com quantos dias de antecedência o cliente deve ser alertado antes do pacote expirar.
                  </p>
                </div>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={expirationWarningDays}
                  onChange={(e) => setExpirationWarningDays(Number(e.target.value))}
                  className="w-24 h-10 px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm text-center font-bold focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 3: Utilização e Dependente */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white shadow-xl">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-400" /> Compartilhamento e Uso Familiar
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400 text-xs">
              Defina se os créditos de um pacote podem ser compartilhados entre diferentes pessoas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-sm text-slate-900 dark:text-white">Permitir uso do pacote por dependentes/familiares</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Permite abater sessões do pacote do titular em atendimentos vinculados a familiares ou dependentes autorizados.
                </p>
              </div>
              <input
                type="checkbox"
                checked={allowShareFamily}
                onChange={(e) => setAllowShareFamily(e.target.checked)}
                className="h-5 w-5 rounded border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-indigo-500 focus:ring-indigo-500 cursor-pointer shrink-0"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={loading} className="bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold px-6 shadow-lg">
            {loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />} Salvar Configurações
          </Button>
        </div>
      </form>
    </div>
  );
}
