'use client';

import { useState } from 'react';
import { ReturnAlert, MessageTemplate, Client } from '@/types/database';
import { updateAlertStatusAction, recordClientContactAction } from '@/app/(dashboard)/retornos/actions';
import { formatDate, formatPhoneNumber } from '@/lib/utils';
import { parseTemplate } from '@/lib/templates';
import { generateWhatsAppUrl } from '@/lib/whatsapp';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Calendar,
  Clock,
  User,
  Wrench,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  Send,
  Eye,
  XCircle,
  Loader2,
  Users,
  Sparkles,
  ChevronRight,
  UserCheck2,
} from 'lucide-react';
import Link from 'next/link';

interface ReturnsClientProps {
  initialTab: string;
  alerts: ReturnAlert[];
  templates: MessageTemplate[];
  orgName: string;
  inactiveClients?: Client[];
}

export function ReturnsClient({ initialTab, alerts, templates, orgName, inactiveClients }: ReturnsClientProps) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<ReturnAlert | null>(null);

  // Modais
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isSnoozeModalOpen, setIsSnoozeModalOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [messageContent, setMessageContent] = useState<string>('');
  const [contactResult, setContactResult] = useState<string>('sent');
  const [contactNotes, setContactNotes] = useState<string>('');

  const [snoozeDaysOption, setSnoozeDaysOption] = useState<string>('1');
  const [customSnoozeDate, setCustomSnoozeDate] = useState<string>('');
  const [snoozeReason, setSnoozeReason] = useState<string>('');

  const defaultTemplate = templates.find((t) => t.is_default) || templates[0];

  function handleSelectTemplate(templateId: string, alert: ReturnAlert) {
    setSelectedTemplateId(templateId);
    const tmpl = templates.find((t) => t.id === templateId);
    if (tmpl && alert) {
      const vars = {
        nome: alert.client?.name,
        salao: orgName,
        servico: alert.service?.name,
        profissional: alert.frequency?.last_professional?.name || 'nosso profissional',
        ultimo_atendimento: formatDate(alert.frequency?.last_service_at || alert.created_at),
        dias_sem_atendimento: alert.days_overdue || 0,
        retorno_previsto: formatDate(alert.expected_return_at),
      };
      setMessageContent(parseTemplate(tmpl.content, vars));
    }
  }

  function handleOpenWhatsApp(alert: ReturnAlert) {
    setSelectedAlert(alert);
    const tmpl = defaultTemplate;
    const vars = {
      nome: alert.client?.name,
      salao: orgName,
      servico: alert.service?.name,
      profissional: alert.frequency?.last_professional?.name || 'nosso profissional',
      ultimo_atendimento: formatDate(alert.frequency?.last_service_at || alert.created_at),
      dias_sem_atendimento: alert.days_overdue || 0,
      retorno_previsto: formatDate(alert.expected_return_at),
    };
    const msg = tmpl ? parseTemplate(tmpl.content, vars) : `Olá, ${alert.client?.name}! Tudo bem? Sentimos sua falta no ${orgName}.`;
    setMessageContent(msg);
    setSelectedTemplateId(tmpl?.id || '');

    const phone = alert.client?.whatsapp || alert.client?.phone || '';
    if (phone) {
      const url = generateWhatsAppUrl(phone, msg);
      window.open(url, '_blank');
    }

    setIsContactModalOpen(true);
  }

  async function handleSaveContact() {
    if (!selectedAlert || !messageContent) return;
    setLoading(true);

    const res = await recordClientContactAction({
      client_id: selectedAlert.client_id,
      service_id: selectedAlert.service_id,
      return_alert_id: selectedAlert.id,
      contact_type: 'whatsapp',
      message_template_id: selectedTemplateId || null,
      message_content: messageContent,
      result: contactResult as any,
      notes: contactNotes || null,
    });

    setLoading(false);
    if (!res.error) {
      setIsContactModalOpen(false);
      setSelectedAlert(null);
      window.location.reload();
    }
  }

  async function handleSaveSnooze() {
    if (!selectedAlert) return;
    setLoading(true);

    let snoozeDateStr = '';
    if (snoozeDaysOption === 'custom') {
      snoozeDateStr = customSnoozeDate;
    } else {
      const d = new Date();
      d.setDate(d.getDate() + parseInt(snoozeDaysOption));
      snoozeDateStr = d.toISOString().split('T')[0];
    }

    const res = await updateAlertStatusAction(selectedAlert.id, 'snoozed', snoozeDateStr, snoozeReason);
    setLoading(false);
    if (!res.error) {
      setIsSnoozeModalOpen(false);
      setSelectedAlert(null);
      window.location.reload();
    }
  }

  async function handleIgnoreAlert(alertId: string) {
    if (!confirm('Deseja ignorar este alerta de retorno?')) return;
    setLoading(true);
    await updateAlertStatusAction(alertId, 'ignored');
    setLoading(false);
    window.location.reload();
  }

  const tabs = [
    { id: 'hoje', label: 'Hoje' },
    { id: 'atrasados', label: 'Atrasados' },
    { id: 'proximos_7', label: 'Próximos 7 dias' },
    { id: 'proximos_15', label: 'Próximos 15 dias' },
    { id: 'contatados', label: 'Contatados' },
    { id: 'adiados', label: 'Adiados' },
    { id: 'concluidos', label: 'Concluídos' },
    { id: 'inativos', label: 'Clientes Inativos' },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Clock className="h-6 w-6 text-amber-400" /> Central de Retornos & Engajamento
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Acompanhe a inteligência de recorrência por serviço e acione clientes no momento exato do retorno.
          </p>
        </div>
        <Link href="/configuracoes/mensagens">
          <Button variant="outline" size="sm" className="border-slate-700 text-slate-300">
            <MessageSquare className="h-4 w-4 mr-1.5" /> Modelos de Mensagem
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2 border-b border-slate-800 scrollbar-none">
        {tabs.map((tab) => (
          <Link key={tab.id} href={`/retornos?tab=${tab.id}`}>
            <button
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              {tab.label}
            </button>
          </Link>
        ))}
      </div>

      {/* Seção Inativos */}
      {activeTab === 'inativos' ? (
        <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
          <CardHeader>
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-400" /> Clientes sem Atendimento Recente
            </CardTitle>
            <CardDescription className="text-slate-400">
              Clientes que ultrapassaram o prazo geral de inatividade configurado pela organização.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {inactiveClients && inactiveClients.length > 0 ? (
              inactiveClients.map((client) => (
                <div
                  key={client.id}
                  className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <h4 className="font-bold text-base text-white">{client.name}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Último Atendimento:{' '}
                      <span className="text-slate-200">{client.last_appointment_at ? formatDate(client.last_appointment_at) : 'Nunca'}</span>
                    </p>
                    {client.whatsapp && <p className="text-xs text-slate-400">WhatsApp: {formatPhoneNumber(client.whatsapp)}</p>}
                  </div>
                  <Link href={`/clientes/${client.id}`}>
                    <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 text-xs">
                      <Eye className="h-3.5 w-3.5 mr-1" /> Ver Ficha
                    </Button>
                  </Link>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400 italic py-8 text-center">Nenhum cliente inativo encontrado nesta consulta.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Lista de Alertas de Retorno */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {alerts && alerts.length > 0 ? (
            alerts.map((alert) => {
              const isOverdue = alert.status === 'overdue' || alert.days_overdue > 0;

              return (
                <Card key={alert.id} className="bg-slate-900 border-slate-800 text-white shadow-lg hover:border-slate-700 transition-all">
                  <CardContent className="p-5 space-y-4">
                    {/* Header do Card */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-base text-white hover:text-amber-400 transition-colors">
                          <Link href={`/clientes/${alert.client_id}`}>{alert.client?.name}</Link>
                        </h3>
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <Wrench className="h-3.5 w-3.5 text-purple-400" /> {alert.service?.name}
                        </p>
                      </div>
                      <Badge
                        variant={
                          alert.status === 'overdue'
                            ? 'destructive'
                            : alert.status === 'due'
                            ? 'warning'
                            : alert.status === 'snoozed'
                            ? 'secondary'
                            : 'outline'
                        }
                        className="text-[11px]"
                      >
                        {alert.status === 'overdue'
                          ? `Atrasado (${alert.days_overdue}d)`
                          : alert.status === 'due'
                          ? 'Hoje'
                          : alert.status === 'snoozed'
                          ? 'Adiado'
                          : alert.status === 'contacted'
                          ? 'Contatado'
                          : alert.status === 'returned'
                          ? 'Retornou'
                          : 'Próximo'}
                      </Badge>
                    </div>

                    {/* Detalhes de Frequência */}
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500 block">Último Serviço:</span>
                        <span className="font-semibold text-slate-200">
                          {formatDate(alert.frequency?.last_service_at || alert.created_at)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Frequência Médio:</span>
                        <span className="font-semibold text-slate-200">{alert.frequency?.effective_interval_days || 20} dias</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Profissional Habitual:</span>
                        <span className="font-semibold text-amber-400">{alert.frequency?.last_professional?.name || 'Não especificado'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Retorno Previsto:</span>
                        <span className="font-semibold text-emerald-400">{formatDate(alert.expected_return_at)}</span>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleOpenWhatsApp(alert)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md"
                      >
                        <Send className="h-3.5 w-3.5 mr-1" /> WhatsApp
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedAlert(alert);
                          setIsSnoozeModalOpen(true);
                        }}
                        className="border-slate-700 text-slate-300 text-xs hover:bg-slate-800"
                      >
                        <Clock className="h-3.5 w-3.5 mr-1" /> Adiar
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleIgnoreAlert(alert.id)}
                        className="text-slate-400 hover:text-red-400 text-xs"
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" /> Ignorar
                      </Button>

                      <Link href={`/clientes/${alert.client_id}`} className="ml-auto">
                        <Button variant="ghost" size="sm" className="text-xs text-slate-400 hover:text-white">
                          <Eye className="h-3.5 w-3.5 mr-1" /> Ficha
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="col-span-full py-12 text-center text-slate-400 italic">
              Nenhum alerta de retorno nesta categoria.
            </div>
          )}
        </div>
      )}

      {/* Modal de Registro de Contato / WhatsApp */}
      {isContactModalOpen && selectedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-amber-400" /> Registrar Contato com {selectedAlert.client?.name}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block">Modelo de Mensagem</label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleSelectTemplate(e.target.value, selectedAlert)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="">Selecione um modelo...</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block">Conteúdo Enviado</label>
                <textarea
                  rows={4}
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1 block">Resultado do Contato</label>
                  <select
                    value={contactResult}
                    onChange={(e) => setContactResult(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="sent">Enviado</option>
                    <option value="interested">Interessado (Em Negociação)</option>
                    <option value="scheduled">Agendou Horário</option>
                    <option value="no_response">Sem Resposta</option>
                    <option value="declined">Recusou</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1 block">Observação (opcional)</label>
                  <Input
                    value={contactNotes}
                    onChange={(e) => setContactNotes(e.target.value)}
                    placeholder="Ex: pediu para ligar amanhã"
                    className="bg-slate-950 border-slate-800 text-xs text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
              <Button variant="ghost" onClick={() => setIsContactModalOpen(false)} className="text-slate-400 text-xs">
                Cancelar
              </Button>
              <Button onClick={handleSaveContact} disabled={loading} className="bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold text-xs">
                {loading && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Confirmar Registro
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Adiar Alerta (Snooze) */}
      {isSnoozeModalOpen && selectedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-400" /> Adiar Alerta de {selectedAlert.client?.name}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block">Adiar por quanto tempo?</label>
                <select
                  value={snoozeDaysOption}
                  onChange={(e) => setSnoozeDaysOption(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="1">Amanhã (+1 dia)</option>
                  <option value="3">+3 dias</option>
                  <option value="7">+7 dias (1 semana)</option>
                  <option value="15">+15 dias</option>
                  <option value="custom">Data personalizada...</option>
                </select>
              </div>

              {snoozeDaysOption === 'custom' && (
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1 block">Data de Reaparecimento</label>
                  <Input
                    type="date"
                    value={customSnoozeDate}
                    onChange={(e) => setCustomSnoozeDate(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs text-white"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block">Motivo do Adiamento (opcional)</label>
                <Input
                  value={snoozeReason}
                  onChange={(e) => setSnoozeReason(e.target.value)}
                  placeholder="Ex: cliente em viagem"
                  className="bg-slate-950 border-slate-800 text-xs text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
              <Button variant="ghost" onClick={() => setIsSnoozeModalOpen(false)} className="text-slate-400 text-xs">
                Cancelar
              </Button>
              <Button onClick={handleSaveSnooze} disabled={loading} className="bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold text-xs">
                {loading && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Confirmar Adiamento
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
