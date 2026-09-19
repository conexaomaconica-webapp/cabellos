'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Service, PackageType, BillingType, ValidityType, RuleType, PeriodType } from '@/types/database';
import { createPackageAction } from '../actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Sparkles, Check, AlertCircle, Gift, Star, Coffee } from 'lucide-react';

interface PackageFormProps {
  services: Service[];
}

interface RuleItem {
  id: string;
  rule_type: RuleType;
  service_id: string | null;
  limit_quantity: number | null;
  period_type: PeriodType | null;
  period_quantity: number;
  is_unlimited: boolean;
}

const SUGGESTED_PERKS = [
  '☕ Cortesia de Bebidas (Café expresso ou Cerveja artesanal)',
  '🏷️ Desconto em produtos (pomadas, shampoos, óleos)',
  '⚡ Prioridade no agendamento e horários de pico',
  '🎁 Cortesia de sobrancelha/acabamento no mês do aniversário',
  '💳 Parcelamento estendido em até 12x',
  '🔄 Renovação automática com garantia de preço congelado',
];

export function PackageForm({ services }: PackageFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number>(100);
  const [packageType, setPackageType] = useState<PackageType>('credits');
  const [billingType, setBillingType] = useState<BillingType>('one_time');
  const [validityType, setValidityType] = useState<ValidityType>('days');
  const [validityValue, setValidityValue] = useState<number>(30);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const [selectedPerks, setSelectedPerks] = useState<string[]>([]);
  const [customBenefits, setCustomBenefits] = useState('');

  const [rules, setRules] = useState<RuleItem[]>([
    {
      id: '1',
      rule_type: 'service_credit',
      service_id: services[0]?.id || null,
      limit_quantity: 4,
      period_type: null,
      period_quantity: 1,
      is_unlimited: false,
    },
  ]);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Apply Presets
  const applyQuantityPackagePreset = () => {
    setName('Pacote 4 Cortes (Avulso)');
    setDescription('Pacote de 4 cortes avulsos para consumo no ritmo do cliente.');
    setPrice(120);
    setPackageType('credits');
    setBillingType('one_time');
    setValidityType('days');
    setValidityValue(90);
    setSelectedServices(services.map((s) => s.id));
    setSelectedPerks(['🏷️ Desconto em produtos (pomadas, shampoos, óleos)']);
    setRules([
      {
        id: '1',
        rule_type: 'service_credit',
        service_id: services[0]?.id || null,
        limit_quantity: 4,
        period_type: null,
        period_quantity: 1,
        is_unlimited: false,
      },
    ]);
  };

  const applyMonthlyFixedPreset = () => {
    setName('Plano Mensal 4 Cortes por Mês');
    setDescription('Plano recorrente com direito a 4 cortes por mês.');
    setPrice(99);
    setPackageType('limited_period');
    setBillingType('monthly');
    setValidityType('months');
    setValidityValue(1);
    setSelectedServices(services.map((s) => s.id));
    setSelectedPerks([
      '⚡ Prioridade no agendamento e horários de pico',
      '🏷️ Desconto em produtos (pomadas, shampoos, óleos)',
    ]);
    setRules([
      {
        id: '1',
        rule_type: 'period_limit',
        service_id: services[0]?.id || null,
        limit_quantity: 4,
        period_type: 'month',
        period_quantity: 1,
        is_unlimited: false,
      },
    ]);
  };

  const applyMonthlyUnlimitedPreset = () => {
    setName('Plano Mensal Corte Ilimitado');
    setDescription('Mensalidade fixa de corte ilimitado no mês + cortesia de bebida.');
    setPrice(110);
    setPackageType('unlimited');
    setBillingType('monthly');
    setValidityType('months');
    setValidityValue(1);
    setSelectedServices(services.map((s) => s.id));
    setSelectedPerks([
      '☕ Cortesia de Bebidas (Café expresso ou Cerveja artesanal)',
      '⚡ Prioridade no agendamento e horários de pico',
    ]);
    setRules([
      {
        id: '1',
        rule_type: 'unlimited_service',
        service_id: services[0]?.id || null,
        limit_quantity: null,
        period_type: 'month',
        period_quantity: 1,
        is_unlimited: true,
      },
    ]);
  };

  const applyCombinedPlanPreset = () => {
    setName('Plano Combinado (4 Barbas + 2 Cortes / Mês)');
    setDescription('Plano completo com cota mensal fixa de 4 barbas e 2 cortes de cabelo.');
    setPrice(140);
    setPackageType('limited_period');
    setBillingType('monthly');
    setValidityType('months');
    setValidityValue(1);
    setSelectedServices(services.map((s) => s.id));
    setSelectedPerks([
      '☕ Cortesia de Bebidas (Café expresso ou Cerveja artesanal)',
      '🏷️ Desconto em produtos (pomadas, shampoos, óleos)',
    ]);

    const beardSvc = services.find((s) => s.name.toLowerCase().includes('barba')) || services[0];
    const hairSvc = services.find((s) => s.name.toLowerCase().includes('corte') || s.name.toLowerCase().includes('cabelo')) || services[1] || services[0];

    setRules([
      {
        id: '1',
        rule_type: 'period_limit',
        service_id: beardSvc?.id || null,
        limit_quantity: 4,
        period_type: 'month',
        period_quantity: 1,
        is_unlimited: false,
      },
      {
        id: '2',
        rule_type: 'period_limit',
        service_id: hairSvc?.id || null,
        limit_quantity: 2,
        period_type: 'month',
        period_quantity: 1,
        is_unlimited: false,
      },
    ]);
  };

  const applySharedTotalLimitPreset = () => {
    setName('Plano Flexível 6 Serviços / Mês (Corte ou Barba)');
    setDescription('Limite total de 6 atendimentos por mês à escolha do cliente entre corte e barba.');
    setPrice(150);
    setPackageType('subscription');
    setBillingType('monthly');
    setValidityType('months');
    setValidityValue(1);
    setSelectedServices(services.map((s) => s.id));
    setSelectedPerks([
      '☕ Cortesia de Bebidas (Café expresso ou Cerveja artesanal)',
      '⚡ Prioridade no agendamento e horários de pico',
    ]);
    setRules([
      {
        id: '1',
        rule_type: 'total_limit',
        service_id: null,
        limit_quantity: 6,
        period_type: 'month',
        period_quantity: 1,
        is_unlimited: false,
      },
    ]);
  };

  const togglePerk = (perk: string) => {
    setSelectedPerks((prev) =>
      prev.includes(perk) ? prev.filter((p) => p !== perk) : [...prev, perk]
    );
  };

  const handleToggleService = (serviceId: string) => {
    setSelectedServices((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]
    );
  };

  const handleAddRule = () => {
    setRules((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        rule_type: packageType === 'unlimited' ? 'unlimited_service' : 'period_limit',
        service_id: services[0]?.id || null,
        limit_quantity: packageType === 'unlimited' ? null : 2,
        period_type: 'month',
        period_quantity: 1,
        is_unlimited: packageType === 'unlimited',
      },
    ]);
  };

  const handleRemoveRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const handleRuleChange = (id: string, field: keyof RuleItem, value: any) => {
    setRules((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };

        if (field === 'rule_type') {
          if (value === 'unlimited_service') {
            updated.is_unlimited = true;
            updated.limit_quantity = null;
          } else if (value === 'service_credit') {
            updated.is_unlimited = false;
            updated.period_type = null;
            if (!updated.limit_quantity) updated.limit_quantity = 4;
          } else {
            updated.is_unlimited = false;
            if (!updated.period_type) updated.period_type = 'month';
            if (!updated.limit_quantity) updated.limit_quantity = 2;
          }
        }
        return updated;
      })
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg('Por favor informe o nome do pacote/plano.');
      return;
    }

    if (selectedServices.length === 0) {
      setErrorMsg('Selecione ao menos 1 serviço incluído no pacote.');
      return;
    }

    const benefitsText = [...selectedPerks, ...(customBenefits.trim() ? [customBenefits.trim()] : [])].join(' • ');

    startTransition(async () => {
      const result = await createPackageAction({
        name,
        description,
        extra_benefits: benefitsText || null,
        price,
        package_type: packageType,
        billing_type: billingType,
        validity_type: validityType,
        validity_value: validityValue,
        services: selectedServices,
        rules: rules.map((r) => ({
          rule_type: r.rule_type,
          service_id: r.rule_type === 'total_limit' ? null : r.service_id,
          limit_quantity: r.is_unlimited ? null : r.limit_quantity,
          period_type: r.rule_type === 'service_credit' ? null : r.period_type,
          period_quantity: r.period_quantity,
          is_unlimited: r.is_unlimited,
        })),
      });

      if (result.error) {
        setErrorMsg(result.error);
      } else {
        router.push('/pacotes');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* PAINEL DE MODELOS COMERCIAIS PRONTOS */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-100 dark:from-amber-950/40 via-amber-50 dark:via-slate-900 to-white dark:to-amber-950/20 border border-amber-500/30 space-y-4 shadow-xl">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Modelos Comerciais Prontos</h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Escolha o modelo comercial que deseja criar para preencher automaticamente as configurações recomendadas:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <button
            type="button"
            onClick={applyQuantityPackagePreset}
            className="p-3 rounded-xl bg-white dark:bg-slate-900/90 border border-amber-500/40 hover:border-amber-400 text-left space-y-1 transition-all hover:scale-[1.02] shadow-md group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 group-hover:text-amber-300">1. Por Quantidade</span>
              <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-400 border-amber-500/30">Pacote</Badge>
            </div>
            <p className="text-[11px] text-slate-700 dark:text-slate-300 line-clamp-2">Ex: 4 cortes avulsos para uso no ritmo do cliente.</p>
          </button>

          <button
            type="button"
            onClick={applyMonthlyFixedPreset}
            className="p-3 rounded-xl bg-white dark:bg-slate-900/90 border border-emerald-500/40 hover:border-emerald-400 text-left space-y-1 transition-all hover:scale-[1.02] shadow-md group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 group-hover:text-emerald-300">2. Limite Mensal</span>
              <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">Plano</Badge>
            </div>
            <p className="text-[11px] text-slate-700 dark:text-slate-300 line-clamp-2">Ex: 4 cortes por mês com renovação mensal.</p>
          </button>

          <button
            type="button"
            onClick={applyMonthlyUnlimitedPreset}
            className="p-3 rounded-xl bg-white dark:bg-slate-900/90 border border-sky-500/40 hover:border-sky-400 text-left space-y-1 transition-all hover:scale-[1.02] shadow-md group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sky-400 group-hover:text-sky-300">3. Ilimitado</span>
              <Badge variant="outline" className="text-[9px] bg-sky-500/10 text-sky-400 border-sky-500/30">Plano</Badge>
            </div>
            <p className="text-[11px] text-slate-700 dark:text-slate-300 line-clamp-2">Ex: Corte ou Barba ilimitados durante o mês.</p>
          </button>

          <button
            type="button"
            onClick={applyCombinedPlanPreset}
            className="p-3 rounded-xl bg-white dark:bg-slate-900/90 border border-purple-500/40 hover:border-purple-400 text-left space-y-1 transition-all hover:scale-[1.02] shadow-md group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-400 group-hover:text-purple-300">4. Combinado</span>
              <Badge variant="outline" className="text-[9px] bg-purple-500/10 text-purple-400 border-purple-500/30">Plano</Badge>
            </div>
            <p className="text-[11px] text-slate-700 dark:text-slate-300 line-clamp-2">Ex: 4 barbas + 2 cortes por mês.</p>
          </button>

          <button
            type="button"
            onClick={applySharedTotalLimitPreset}
            className="p-3 rounded-xl bg-white dark:bg-slate-900/90 border border-indigo-500/40 hover:border-indigo-400 text-left space-y-1 transition-all hover:scale-[1.02] shadow-md group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-400 group-hover:text-indigo-300">5. Total Flexível</span>
              <Badge variant="outline" className="text-[9px] bg-indigo-500/10 text-indigo-400 border-indigo-500/30">Plano</Badge>
            </div>
            <p className="text-[11px] text-slate-700 dark:text-slate-300 line-clamp-2">Ex: 6 serviços/mês entre Corte e Barba.</p>
          </button>
        </div>
      </div>

      {/* 1. Dados Principais */}
      <Card className="p-6 bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 space-y-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800 pb-3">Informações Básicas</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Nome do Pacote / Plano *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Plano Mensal Ilimitado ou Assinatura Anual VIP"
              className="bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-600"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Tipo do Pacote / Plano *</label>
            <select
              value={packageType}
              onChange={(e) => setPackageType(e.target.value as PackageType)}
              className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md p-2.5 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500"
            >
              <option value="credits">Pacote de Créditos (Quantidade Fixa)</option>
              <option value="subscription">Assinatura Recorrente</option>
              <option value="limited_period">Limite por Período (ex: 4x no mês)</option>
              <option value="unlimited">Ilimitado dentro da Vigência</option>
            </select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Descrição Detalhada</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o benefício e detalhes comerciais do pacote..."
              className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md p-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-600 min-h-[80px]"
            />
          </div>
        </div>
      </Card>

      {/* 2. Preço e Validade */}
      <Card className="p-6 bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 space-y-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800 pb-3">Precificação e Ciclo de Cobrança</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Valor Comercial (R$) *</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-amber-400 font-bold text-lg"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Forma de Cobrança</label>
            <select
              value={billingType}
              onChange={(e) => setBillingType(e.target.value as BillingType)}
              className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md p-2.5 text-sm text-slate-900 dark:text-slate-100"
            >
              <option value="monthly">Mensalidade (Plano Mensal)</option>
              <option value="yearly">Anuidade (Plano Anual)</option>
              <option value="one_time">Cobrança Única (Avulso)</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Validade da Vigência *</label>
            <div className="flex gap-2">
              <Input
                type="number"
                min="1"
                value={validityValue}
                onChange={(e) => setValidityValue(Number(e.target.value))}
                className="bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 w-24"
                required
              />
              <select
                value={validityType}
                onChange={(e) => setValidityType(e.target.value as ValidityType)}
                className="flex-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md p-2 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="months">Meses</option>
                <option value="years">Anos</option>
                <option value="days">Dias</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* 3. Benefícios Extras & Vantagens Exclusivas */}
      <Card className="p-6 bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 space-y-4">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
            <Gift className="w-5 h-5 text-amber-400" /> Benefícios Extras e Vantagens Exclusivas
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Adicione benefícios para tornar o plano atrativo (cortesia de bebidas, desconto em produtos, prioridade, etc.).
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {SUGGESTED_PERKS.map((perk) => {
            const isSelected = selectedPerks.includes(perk);
            return (
              <button
                type="button"
                key={perk}
                onClick={() => togglePerk(perk)}
                className={`p-3 rounded-xl border text-xs text-left flex items-center justify-between transition-all ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500/50 text-amber-300 font-semibold shadow'
                    : 'bg-slate-50 dark:bg-slate-950/60 border-slate-300 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-700'
                }`}
              >
                <span>{perk}</span>
                {isSelected && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
              </button>
            );
          })}
        </div>

        <div className="space-y-1.5 pt-2">
          <label className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Outros Benefícios ou Observações Customizadas</label>
          <Input
            value={customBenefits}
            onChange={(e) => setCustomBenefits(e.target.value)}
            placeholder="Ex: 15% OFF em tratamentos químicos e acesso a sala VIP"
            className="bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 text-xs"
          />
        </div>
      </Card>

      {/* 4. Seleção de Serviços Incluídos */}
      <Card className="p-6 bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800 pb-3">Serviços Incluídos no Pacote *</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">Marque quais serviços fazem parte do escopo deste pacote/plano.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
          {services.map((svc) => {
            const isSelected = selectedServices.includes(svc.id);
            return (
              <button
                type="button"
                key={svc.id}
                onClick={() => handleToggleService(svc.id)}
                className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                    : 'bg-slate-50 dark:bg-slate-950/60 border-slate-300 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-700'
                }`}
              >
                <div>
                  <p className="font-medium text-sm text-slate-900 dark:text-slate-200">{svc.name}</p>
                  <p className="text-xs text-slate-500">R$ {Number(svc.price).toFixed(2)}</p>
                </div>
                {isSelected && <Check className="w-5 h-5 text-amber-400" />}
              </button>
            );
          })}
        </div>
      </Card>

      {/* 5. Construtor Visual de Regras de Utilização */}
      <Card className="p-6 bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-200">Regras de Utilização (Limites e Direitos)</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Configure créditos específicos, limites semanais/mensais ou direito ilimitado.</p>
          </div>
          <Button type="button" onClick={handleAddRule} variant="outline" className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-xs gap-1">
            <Plus className="w-3.5 h-3.5" /> Adicionar Regra
          </Button>
        </div>

        <div className="space-y-4">
          {rules.map((rule, idx) => (
            <div key={rule.id} className="p-4 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Regra #{idx + 1}</span>
                {rules.length > 1 && (
                  <button type="button" onClick={() => handleRemoveRule(rule.id)} className="text-rose-400 hover:text-rose-300 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Tipo de Regra</label>
                  <select
                    value={rule.rule_type}
                    onChange={(e) => handleRuleChange(rule.id, 'rule_type', e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-2 text-xs text-slate-900 dark:text-slate-200"
                  >
                    <option value="service_credit">Pacote por Quantidade (Ex: 4 cortes avulsos)</option>
                    <option value="period_limit">Limite por Período (Ex: 4 cortes por mês)</option>
                    <option value="unlimited_service">Plano Ilimitado (Ex: Corte ou Barba ilimitados)</option>
                    <option value="total_limit">Limite Total Compartilhado (Ex: 6 serviços por mês entre Corte e Barba)</option>
                  </select>
                </div>

                {rule.rule_type !== 'total_limit' && (
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Serviço Alvo</label>
                    <select
                      value={rule.service_id || ''}
                      onChange={(e) => handleRuleChange(rule.id, 'service_id', e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-2 text-xs text-slate-900 dark:text-slate-200"
                    >
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {rule.rule_type !== 'unlimited_service' && (
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Quantidade Permitida</label>
                    <Input
                      type="number"
                      min="1"
                      value={rule.limit_quantity || 1}
                      onChange={(e) => handleRuleChange(rule.id, 'limit_quantity', Number(e.target.value))}
                      className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs"
                    />
                  </div>
                )}

                {rule.rule_type !== 'service_credit' && rule.rule_type !== 'unlimited_service' && (
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Período de Renovação do Limite</label>
                    <select
                      value={rule.period_type || 'month'}
                      onChange={(e) => handleRuleChange(rule.id, 'period_type', e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-2 text-xs text-slate-900 dark:text-slate-200"
                    >
                      <option value="week">Semanal (Semana Calendário)</option>
                      <option value="month">Mensal (Mês Calendário)</option>
                      <option value="year">Anual (Ano Calendário)</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Ações */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
        <Button type="button" variant="outline" onClick={() => router.push('/pacotes')} className="border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending} className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold px-6 shadow-lg shadow-amber-600/20">
          {isPending ? 'Salvando...' : 'Salvar Pacote / Plano'}
        </Button>
      </div>
    </form>
  );
}
