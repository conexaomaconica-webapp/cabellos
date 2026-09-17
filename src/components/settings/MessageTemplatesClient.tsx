'use client';

import { useState } from 'react';
import { MessageTemplate } from '@/types/database';
import { saveMessageTemplateAction, toggleMessageTemplateStatusAction } from '@/app/(dashboard)/configuracoes/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MessageSquare, Plus, Edit2, Power, Sparkles, Loader2, Info } from 'lucide-react';

interface MessageTemplatesClientProps {
  templates: MessageTemplate[];
}

export function MessageTemplatesClient({ templates }: MessageTemplatesClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<string>('return_reminder');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenCreate() {
    setEditingTemplate(null);
    setName('');
    setType('return_reminder');
    setContent('Olá, {{nome}}! Tudo bem?\n\nJá faz um tempo desde o seu último {{servico}} no {{salao}}.\nQue tal agendarmos seu próximo horário?');
    setError(null);
    setIsModalOpen(true);
  }

  function handleOpenEdit(template: MessageTemplate) {
    setEditingTemplate(template);
    setName(template.name);
    setType(template.type);
    setContent(template.content);
    setError(null);
    setIsModalOpen(true);
  }

  async function handleSave() {
    if (!name || !content) {
      setError('Preencha o nome e o conteúdo do modelo.');
      return;
    }
    setLoading(true);
    setError(null);

    const res = await saveMessageTemplateAction({
      id: editingTemplate?.id,
      name,
      type: type as any,
      content,
    });

    setLoading(false);
    if (res?.error) {
      setError(res.error);
    } else {
      setIsModalOpen(false);
      window.location.reload();
    }
  }

  async function handleToggleStatus(templateId: string, currentActive: boolean) {
    setLoading(true);
    await toggleMessageTemplateStatusAction(templateId, !currentActive);
    setLoading(false);
    window.location.reload();
  }

  const tags = [
    '{{nome}}',
    '{{salao}}',
    '{{servico}}',
    '{{profissional}}',
    '{{ultimo_atendimento}}',
    '{{dias_sem_atendimento}}',
    '{{retorno_previsto}}',
  ];

  function insertTag(tag: string) {
    setContent((prev) => prev + ' ' + tag);
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-amber-400" /> Modelos de Mensagens para WhatsApp
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Personalize os textos enviados aos clientes com suporte a interpolação inteligente de variáveis.
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold shadow-lg">
          <Plus className="h-4 w-4 mr-1.5" /> Novo Modelo
        </Button>
      </div>

      {/* Lista de Modelos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates && templates.length > 0 ? (
          templates.map((tmpl) => (
            <Card key={tmpl.id} className={`bg-slate-900 border-slate-800 text-white shadow-lg ${!tmpl.is_active ? 'opacity-60' : ''}`}>
              <CardHeader className="pb-3 border-b border-slate-800 flex flex-row items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-bold text-white">{tmpl.name}</CardTitle>
                    {tmpl.is_default && (
                      <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30 bg-amber-500/10">
                        Padrão
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs text-slate-400 mt-0.5">
                    Tipo: <span className="text-slate-300 font-medium">{tmpl.type}</span>
                  </CardDescription>
                </div>
                <Badge variant={tmpl.is_active ? 'success' : 'secondary'} className="text-[10px]">
                  {tmpl.is_active ? 'Ativo' : 'Desativado'}
                </Badge>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 whitespace-pre-wrap font-mono">
                  {tmpl.content}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(tmpl)} className="text-slate-300 hover:text-white text-xs">
                    <Edit2 className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleStatus(tmpl.id, tmpl.is_active)}
                    className={`text-xs ${tmpl.is_active ? 'text-red-400 hover:text-red-300' : 'text-emerald-400 hover:text-emerald-300'}`}
                  >
                    <Power className="h-3.5 w-3.5 mr-1" /> {tmpl.is_active ? 'Desativar' : 'Ativar'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <p className="col-span-full py-12 text-center text-slate-400 italic">Nenhum modelo de mensagem cadastrado.</p>
        )}
      </div>

      {/* Modal de Criação / Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-amber-400" />
              {editingTemplate ? 'Editar Modelo de Mensagem' : 'Novo Modelo de Mensagem'}
            </h3>

            {error && <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-xs text-red-300">{error}</div>}

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1 block">Nome do Modelo</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Lembrete de Retorno 15 dias"
                    className="bg-slate-950 border-slate-800 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1 block">Tipo de Mensagem</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="return_reminder">Lembrete de Retorno</option>
                    <option value="overdue">Retorno em Atraso</option>
                    <option value="inactive_client">Cliente Inativo</option>
                    <option value="birthday">Aniversário</option>
                    <option value="custom">Personalizado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block">Variáveis Disponíveis (clique para inserir)</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {tags.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => insertTag(t)}
                      className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-mono hover:bg-amber-500/20 transition-colors"
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={6}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  placeholder="Digite o texto da mensagem..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="text-slate-400 text-xs">
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={loading} className="bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold text-xs">
                {loading && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Salvar Modelo
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
