'use client';

import { useState, useMemo, useEffect } from 'react';
import { Client, Professional, Service, PaymentMethod, ProfessionalService } from '@/types/database';
import { completeAppointmentAction, quickCreateClientAction } from '@/app/(dashboard)/atendimentos/actions';
import { formatCurrency, formatPhoneNumber } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Zap,
  Sparkles,
  Users,
  Wrench,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Plus,
  Trash2,
  UserPlus,
  Phone,
  HelpCircle,
} from 'lucide-react';
import Link from 'next/link';

interface QuickAppointmentFormProps {
  clients: Client[];
  professionals: Professional[];
  services: Service[];
  paymentMethods: PaymentMethod[];
  professionalServices: ProfessionalService[];
}

export function QuickAppointmentForm({
  clients: initialClients,
  professionals,
  services,
  paymentMethods,
  professionalServices,
}: QuickAppointmentFormProps) {
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [inputText, setInputText] = useState<string>('');

  // Parsed state
  const [extractedClientName, setExtractedClientName] = useState<string>('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [newClientWhatsapp, setNewClientWhatsapp] = useState<string>('');

  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedProfId, setSelectedProfId] = useState<string>(professionals[0]?.id || '');
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>(paymentMethods[0]?.id || '');

  const [isNewClient, setIsNewClient] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Executar Parsing Inteligente do Texto
  useEffect(() => {
    if (!inputText.trim()) {
      setExtractedClientName('');
      setSelectedClientId('');
      setIsNewClient(false);
      setSelectedServices([]);
      setTotalAmount(0);
      return;
    }

    const lower = inputText.toLowerCase();

    // 1. Extração de Serviços
    const matchedSvcs: Service[] = [];
    services.forEach((s) => {
      const sName = s.name.toLowerCase();
      if (lower.includes(sName)) {
        matchedSvcs.push(s);
      }
    });

    // Se nenhuma bateu diretamente pelo nome exato, testar palavras-chave comuns
    if (matchedSvcs.length === 0) {
      if (lower.includes('cabelo') || lower.includes('corte')) {
        const cab = services.find((s) => s.name.toLowerCase().includes('cabelo') || s.name.toLowerCase().includes('corte'));
        if (cab) matchedSvcs.push(cab);
      }
      if (lower.includes('barba')) {
        const bar = services.find((s) => s.name.toLowerCase().includes('barba'));
        if (bar) matchedSvcs.push(bar);
      }
      if (lower.includes('unha') || lower.includes('manicure')) {
        const unh = services.find((s) => s.name.toLowerCase().includes('unha') || s.name.toLowerCase().includes('manicure'));
        if (unh) matchedSvcs.push(unh);
      }
    }

    setSelectedServices(matchedSvcs);

    // 2. Extração de Valor Monetário
    // Busca padrões como: "cobrei 45", "45 reais", "r$ 45", "por 45", "valor 45"
    let detectedAmount: number | null = null;

    const regexPrice = /(?:cobrei|por|r\$|valor|de)\s*(\d+(?:[.,]\d{1,2})?)/i;
    const matchPrice = lower.match(regexPrice);

    if (matchPrice && matchPrice[1]) {
      detectedAmount = parseFloat(matchPrice[1].replace(',', '.'));
    } else {
      // Tentar encontrar qualquer número seguido de "reais" ou "real"
      const regexReais = /(\d+(?:[.,]\d{1,2})?)\s*(?:reais|real)/i;
      const matchReais = lower.match(regexReais);
      if (matchReais && matchReais[1]) {
        detectedAmount = parseFloat(matchReais[1].replace(',', '.'));
      }
    }

    if (detectedAmount && !isNaN(detectedAmount)) {
      setTotalAmount(detectedAmount);
    } else {
      // Fallback: Soma do preço dos serviços detectados
      const sum = matchedSvcs.reduce((acc, s) => acc + s.price, 0);
      setTotalAmount(sum);
    }

    // 3. Extração de Forma de Pagamento
    if (lower.includes('pix')) {
      const pm = paymentMethods.find((p) => p.name.toLowerCase().includes('pix'));
      if (pm) setSelectedPaymentMethodId(pm.id);
    } else if (lower.includes('dinheiro') || lower.includes('especie') || lower.includes('espécie')) {
      const pm = paymentMethods.find((p) => p.name.toLowerCase().includes('dinheiro'));
      if (pm) setSelectedPaymentMethodId(pm.id);
    } else if (lower.includes('cartao') || lower.includes('cartão') || lower.includes('credito') || lower.includes('crédito') || lower.includes('debito') || lower.includes('débito')) {
      const pm = paymentMethods.find((p) => p.name.toLowerCase().includes('cart') || p.name.toLowerCase().includes('crédito') || p.name.toLowerCase().includes('débito'));
      if (pm) setSelectedPaymentMethodId(pm.id);
    }

    // 4. Extração de Cliente
    // Testar primeiro se algum cliente existente bate no texto
    let foundClient = clients.find((c) => {
      const nameParts = c.name.toLowerCase().split(' ');
      const firstName = nameParts[0];
      return lower.includes(c.name.toLowerCase()) || (firstName.length >= 3 && lower.includes(firstName));
    });

    if (foundClient) {
      setSelectedClientId(foundClient.id);
      setExtractedClientName(foundClient.name);
      setIsNewClient(false);
    } else {
      // Tentar extrair nome do texto (padrões: "de [Nome]", "para [Nome]", "do [Nome]", "da [Nome]", "cliente [Nome]")
      const regexName = /(?:de|para|do|da|cliente)\s+([a-zA-Zà-úÀ-Ú]{2,}(?:\s+[a-zA-Zà-úÀ-Ú]{2,})*)/i;
      const matchName = inputText.match(regexName);

      if (matchName && matchName[1]) {
        let nameCandidate = matchName[1].trim();

        // Limpar palavras stopwords no final da captura (ex: "cobrei", "no", "pix", "reais")
        nameCandidate = nameCandidate
          .replace(/\b(cobrei|por|no|em|pix|dinheiro|reais|real|r\$|\d+)\b.*/gi, '')
          .trim();

        if (nameCandidate.length >= 2) {
          setExtractedClientName(nameCandidate);
          setSelectedClientId('');
          setIsNewClient(true);
        } else {
          setExtractedClientName('');
          setSelectedClientId('');
          setIsNewClient(false);
        }
      } else {
        setExtractedClientName('');
        setSelectedClientId('');
        setIsNewClient(false);
      }
    }
  }, [inputText, clients, services, paymentMethods]);

  // Exemplo rápido pré-preenchido
  function handleUseExample(phrase: string) {
    setInputText(phrase);
  }

  // Alternar ou Selecionar Cliente Manualmente
  function handleManualSelectClient(clientId: string) {
    const c = clients.find((item) => item.id === clientId);
    if (c) {
      setSelectedClientId(c.id);
      setExtractedClientName(c.name);
      setIsNewClient(false);
    }
  }

  // Alternar inclusão de Serviço
  function handleToggleService(service: Service) {
    setSelectedServices((prev) => {
      const exists = prev.some((s) => s.id === service.id);
      if (exists) {
        return prev.filter((s) => s.id !== service.id);
      } else {
        return [...prev, service];
      }
    });
  }

  // Submeter o Atendimento Rápido
  async function handleSubmit() {
    setError(null);

    if (!inputText.trim()) {
      setError('Escreva a frase descrevendo o atendimento.');
      return;
    }

    if (selectedServices.length === 0) {
      setError('Selecione pelo menos 1 serviço para o atendimento.');
      return;
    }

    if (totalAmount <= 0) {
      setError('Informe o valor cobrado pelo atendimento.');
      return;
    }

    let finalClientId = selectedClientId;

    setLoading(true);

    // Se for novo cliente, efetuar cadastro rápido prévio
    if (isNewClient || !finalClientId) {
      if (!extractedClientName || extractedClientName.trim().length < 2) {
        setError('Informe o nome do novo cliente para cadastrar.');
        setLoading(false);
        return;
      }

      if (!newClientWhatsapp || newClientWhatsapp.trim().length < 8) {
        setError('Por favor, informe o telefone/WhatsApp do novo cliente para cadastrá-lo.');
        setLoading(false);
        return;
      }

      const clientRes = await quickCreateClientAction(extractedClientName, newClientWhatsapp);

      if (clientRes.error || !clientRes.client) {
        setError(clientRes.error || 'Erro ao cadastrar novo cliente.');
        setLoading(false);
        return;
      }

      finalClientId = clientRes.client.id;
      setClients((prev) => [clientRes.client!, ...prev]);
    }

    // Enviar conclusão do atendimento
    const res = await completeAppointmentAction({
      client_id: finalClientId,
      professional_id: selectedProfId || null,
      notes: `Atendimento Rápido via Texto: "${inputText}"`,
      services: selectedServices.map((s) => ({
        service_id: s.id,
        professional_id: selectedProfId || null,
        quantity: 1,
        discount: 0,
      })),
      payments: selectedPaymentMethodId
        ? [
            {
              payment_method_id: selectedPaymentMethodId,
              amount: totalAmount,
            },
          ]
        : [],
    });

    if (res?.error) {
      setError(res.error);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl bg-red-950/60 border border-red-800 p-4 text-sm text-red-300 flex items-center gap-2 animate-in fade-in-50">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* BANNER DE INSTRUÇÃO E EXEMPLOS */}
      <Card className="bg-slate-900/90 border-slate-800 text-white shadow-xl">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Atendimento Rápido por Texto <Sparkles className="h-4 w-4 text-amber-400" />
              </h2>
              <p className="text-xs text-slate-400">
                Digite a frase em linguagem natural. O sistema identifica o cliente, os serviços e o valor automaticamente!
              </p>
            </div>
          </div>

          {/* CAIXA DE TEXTO PRINCIPAL */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">Descreva o Atendimento Realizado:</label>
              <span className="text-[11px] text-amber-400 font-medium">Reconhecimento Automático Ativo</span>
            </div>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ex: Fiz Cabelo e barba de Eduardo Saba, cobrei 45 reais no pix"
              rows={3}
              className="w-full rounded-xl bg-slate-950 border border-slate-700 p-3.5 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-medium shadow-inner"
            />
            <div className="flex items-center justify-between pt-1">
              <Button
                type="button"
                onClick={() => {
                  // Re-trigger parsing feedback
                  if (inputText.trim()) {
                    const el = document.getElementById('parsed-preview-section');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs h-9 px-4 rounded-xl flex items-center gap-1.5 shadow"
              >
                <Zap className="h-4 w-4" /> Processar Texto
              </Button>
              {inputText.trim() && (
                <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Frase Analisada
                </span>
              )}
            </div>
          </div>

          {/* FRASES DE EXEMPLO PARA TESTE */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Clique em um exemplo para testar:
            </span>
            <div className="flex flex-wrap gap-2">
              {[
                'Fiz Cabelo e barba de Eduardo Saba, cobrei 45 reais no pix',
                'Corte masculino para João da Silva R$ 35,00',
                'Barba do Carlos por 25 no dinheiro',
              ].map((phrase, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleUseExample(phrase)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-xs text-slate-300 hover:text-amber-300 transition-all text-left truncate max-w-full"
                >
                  💬 &quot;{phrase}&quot;
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* RESUMO DOS DADOS RECONHECIDOS (PREVIEW E AJUSTES) */}
      {inputText.trim() && (
        <div id="parsed-preview-section" className="space-y-4 animate-in fade-in-50">
          {/* 1. STATUS DO CLIENTE */}
          <Card className="bg-slate-900 border-slate-800 text-white shadow-lg">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Users className="h-4 w-4 text-amber-400" /> Cliente Reconhecido
                </span>
                {selectedClientId ? (
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Cliente Cadastrado
                  </Badge>
                ) : isNewClient ? (
                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 flex items-center gap-1">
                    <UserPlus className="h-3.5 w-3.5" /> Novo Cliente Detectado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-slate-700 text-slate-400">
                    Selecione um cliente
                  </Badge>
                )}
              </div>

              {/* SE CLIENTE É NOVO - EXIBIR ALERTA E CAMPO TELEFONE */}
              {isNewClient && !selectedClientId && (
                <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/60 space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold text-sm text-amber-300">
                        O cliente &quot;{extractedClientName || 'Informado'}&quot; ainda não está cadastrado!
                      </p>
                      <p className="text-xs text-amber-200/80">
                        Para registrar o atendimento, confirme o nome e informe o WhatsApp para efetuar o cadastro rápido automático.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-300">Nome do Cliente *</label>
                      <Input
                        value={extractedClientName}
                        onChange={(e) => setExtractedClientName(e.target.value)}
                        placeholder="Nome completo do cliente"
                        className="bg-slate-800 border-slate-700 text-white text-xs h-10"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-300 flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5 text-amber-400" /> WhatsApp / Telefone *
                      </label>
                      <Input
                        value={newClientWhatsapp}
                        onChange={(e) => setNewClientWhatsapp(e.target.value)}
                        placeholder="(75) 99999-9999"
                        className="bg-slate-800 border-slate-700 text-white text-xs h-10 focus-visible:ring-amber-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SE CLIENTE ENCONTRADO */}
              {selectedClientId && (
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/80 border border-slate-700">
                  <div>
                    <p className="font-bold text-sm text-white">{extractedClientName}</p>
                    <p className="text-xs text-slate-400">
                      {clients.find((c) => c.id === selectedClientId)?.whatsapp
                        ? formatPhoneNumber(clients.find((c) => c.id === selectedClientId)!.whatsapp!)
                        : 'Sem WhatsApp registrado'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedClientId('');
                      setIsNewClient(true);
                    }}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Trocar / Cadastrar Outro
                  </Button>
                </div>
              )}

              {/* OPÇÃO DE SELECIONAR MANUALMENTE DA LISTA */}
              {!selectedClientId && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-[11px] text-slate-400">Ou selecione um cliente existente na lista abaixo:</label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => handleManualSelectClient(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">Selecione um cliente cadastrado...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.whatsapp ? `(${formatPhoneNumber(c.whatsapp)})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 2. SERVIÇOS E PROFISSIONAL */}
          <Card className="bg-slate-900 border-slate-800 text-white shadow-lg">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-purple-400" /> Serviços Detectados ({selectedServices.length})
                </span>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Profissional:</span>
                  <select
                    value={selectedProfId}
                    onChange={(e) => setSelectedProfId(e.target.value)}
                    className="h-8 px-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs"
                  >
                    {professionals.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* GRID DE BOTÕES DE TODOS OS SERVIÇOS PARA SELEÇÃO FÁCIL */}
              <div className="flex flex-wrap gap-2">
                {services.map((s) => {
                  const isSelected = selectedServices.some((sel) => sel.id === s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleToggleService(s)}
                      className={`px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-all ${
                        isSelected
                          ? 'bg-purple-500/20 border-2 border-purple-500 text-purple-200 font-bold shadow'
                          : 'bg-slate-800/60 border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <span>{s.name}</span>
                      <span className="text-[10px] opacity-80">(R$ {s.price})</span>
                      {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-purple-400" />}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* 3. VALOR E FORMA DE PAGAMENTO */}
          <Card className="bg-slate-900 border-slate-800 text-white shadow-lg">
            <CardContent className="p-5 space-y-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-emerald-400" /> Valor e Forma de Pagamento
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Valor Total do Atendimento (R$)</label>
                  <CurrencyInput
                    value={totalAmount}
                    onChangeValue={(num) => setTotalAmount(num)}
                    className="bg-slate-800 border-slate-700 text-amber-400 font-bold text-base h-11"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Forma de Pagamento</label>
                  <select
                    value={selectedPaymentMethodId}
                    onChange={(e) => setSelectedPaymentMethodId(e.target.value)}
                    className="w-full h-11 px-3 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs font-semibold focus:ring-2 focus:ring-emerald-500"
                  >
                    {paymentMethods.map((pm) => (
                      <option key={pm.id} value={pm.id}>
                        {pm.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* BOTÃO FINALIZAR ATENDIMENTO RÁPIDO */}
          <Card className="bg-slate-900 border-slate-800 text-white shadow-2xl sticky bottom-2 z-30">
            <CardContent className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-xs text-slate-400">Total a Concluir:</p>
                <p className="text-2xl font-black text-amber-400">{formatCurrency(totalAmount)}</p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Link href="/atendimentos" className="w-1/2 sm:w-auto">
                  <Button type="button" variant="secondary" className="w-full bg-slate-800 text-slate-300">
                    Cancelar
                  </Button>
                </Link>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-1/2 sm:w-auto h-12 px-8 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-base shadow-xl flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" /> Processando...
                    </>
                  ) : (
                    <>
                      <Zap className="h-5 w-5" /> Concluir Atendimento Rápido
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
