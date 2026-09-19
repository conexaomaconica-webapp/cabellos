'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { importClientsBatchAction, BatchClientItem } from '@/app/(dashboard)/clientes/actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Smartphone, Upload, Check, Loader2, Users, AlertCircle, FileText, CheckSquare, Square, X, Download, FileSpreadsheet } from 'lucide-react';

async function loadXLSXLibrary() {
  if (typeof window === 'undefined') return null;
  if ((window as any).XLSX) return (window as any).XLSX;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    script.onload = () => resolve((window as any).XLSX);
    script.onerror = () => reject(new Error('Falha ao carregar biblioteca de leitura de Excel.'));
    document.head.appendChild(script);
  });
}

export function ImportContactsModal() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [contacts, setContacts] = useState<(BatchClientItem & { selected: boolean })[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isNativeContactSupported = typeof window !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window;

  // Download Modelo Excel / CSV
  function handleDownloadTemplate() {
    const csvData = "Nome,WhatsApp,Telefone,Email\nJoão da Silva,(75) 99999-8888,(75) 3333-2222,joao@email.com\nMaria Oliveira,(75) 98888-7777,,maria@email.com\nCarlos Santos,(75) 97777-6666,,carlos@email.com";
    const blob = new Blob(["\ufeff" + csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'modelo_importacao_clientes.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // 1. Native W3C Mobile Contact Picker API (Chrome Android / Mobile Edge / Samsung Internet)
  async function handlePickNativeContacts() {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      setLoading(true);
      const props = ['name', 'tel', 'email'];
      const rawContacts = await (navigator as any).contacts.select(props, { multiple: true });

      if (rawContacts && rawContacts.length > 0) {
        const parsed: (BatchClientItem & { selected: boolean })[] = rawContacts.map((c: any) => {
          const name = Array.isArray(c.name) ? c.name[0] : c.name || 'Sem nome';
          const tel = Array.isArray(c.tel) ? c.tel[0] : c.tel || '';
          const email = Array.isArray(c.email) ? c.email[0] : c.email || '';
          return {
            name,
            phone: tel,
            whatsapp: tel,
            email,
            selected: true,
          };
        });

        setContacts(parsed);
      }
    } catch (err: any) {
      if (err.name !== 'TypeError' && !err.message?.includes('canceled')) {
        setErrorMsg('Não foi possível acessar os contatos do telefone.');
      }
    } finally {
      setLoading(false);
    }
  }

  // 2. Parse VCF / VCard Files (iOS / Safari / Desktop / Backup)
  function parseVCF(vcfText: string): BatchClientItem[] {
    const cards = vcfText.split('END:VCARD');
    const items: BatchClientItem[] = [];

    for (const card of cards) {
      if (!card.includes('BEGIN:VCARD')) continue;

      let name = '';
      let tel = '';
      let email = '';

      const lines = card.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('FN:') || trimmed.startsWith('FN;')) {
          name = trimmed.substring(trimmed.indexOf(':') + 1).trim();
        } else if (!name && (trimmed.startsWith('N:') || trimmed.startsWith('N;'))) {
          const rawN = trimmed.substring(trimmed.indexOf(':') + 1).split(';');
          name = `${rawN[1] || ''} ${rawN[0] || ''}`.trim();
        } else if (trimmed.startsWith('TEL:') || trimmed.startsWith('TEL;')) {
          if (!tel) tel = trimmed.substring(trimmed.indexOf(':') + 1).trim();
        } else if (trimmed.startsWith('EMAIL:') || trimmed.startsWith('EMAIL;')) {
          if (!email) email = trimmed.substring(trimmed.indexOf(':') + 1).trim();
        }
      }

      if (name) {
        items.push({ name, phone: tel, whatsapp: tel, email });
      }
    }

    return items;
  }

  // 3. Parse CSV Files
  function parseCSV(csvText: string): BatchClientItem[] {
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];

    const items: BatchClientItem[] = [];
    const header = lines[0].toLowerCase();
    const isHeader = header.includes('nome') || header.includes('name') || header.includes('tel');
    const startIdx = isHeader ? 1 : 0;

    for (let i = startIdx; i < lines.length; i++) {
      const parts = lines[i].split(/[,;]/).map((p) => p.trim().replace(/^["']|["']$/g, ''));
      if (parts[0]) {
        items.push({
          name: parts[0],
          whatsapp: parts[1] || parts[2] || '',
          phone: parts[2] || parts[1] || '',
          email: parts[3] || '',
        });
      }
    }

    return items;
  }

  // 4. Parse XLSX / XLS Files (SheetJS)
  async function parseExcel(file: File): Promise<BatchClientItem[]> {
    const XLSX = await loadXLSXLibrary();
    if (!XLSX) return [];

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const items: BatchClientItem[] = [];

    for (const r of rows) {
      const keys = Object.keys(r);

      // Encontrar colunas de modo inteligente
      const nameKey = keys.find((k) => /nome|name|cliente|razao/i.test(k)) || keys[0];
      const whatsappKey = keys.find((k) => /whatsapp|whats|wsp|celular|cel/i.test(k));
      const phoneKey = keys.find((k) => /telefone|phone|fone|tel|contato/i.test(k));
      const emailKey = keys.find((k) => /email|e-mail|mail/i.test(k));

      const nameVal = r[nameKey] ? String(r[nameKey]).trim() : '';
      const whatsappVal = whatsappKey && r[whatsappKey] ? String(r[whatsappKey]).trim() : '';
      const phoneVal = phoneKey && r[phoneKey] ? String(r[phoneKey]).trim() : '';
      const emailVal = emailKey && r[emailKey] ? String(r[emailKey]).trim() : '';

      if (nameVal) {
        items.push({
          name: nameVal,
          whatsapp: whatsappVal || phoneVal,
          phone: phoneVal || whatsappVal,
          email: emailVal,
        });
      }
    }

    return items;
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const filename = file.name.toLowerCase();
      let parsed: BatchClientItem[] = [];

      if (filename.endsWith('.xlsx') || filename.endsWith('.xls') || filename.endsWith('.ods')) {
        parsed = await parseExcel(file);
      } else {
        const text = await file.text();
        if (filename.endsWith('.vcf')) {
          parsed = parseVCF(text);
        } else {
          parsed = parseCSV(text);
        }
      }

      setLoading(false);
      if (parsed.length === 0) {
        setErrorMsg('Nenhum contato válido encontrado no arquivo.');
      } else {
        setContacts(parsed.map((c) => ({ ...c, selected: true })));
      }
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err.message || 'Erro ao processar o arquivo de planilha.');
    }
  }

  const toggleSelectAll = () => {
    const allSelected = contacts.every((c) => c.selected);
    setContacts(contacts.map((c) => ({ ...c, selected: !allSelected })));
  };

  const toggleSelectContact = (index: number) => {
    setContacts(contacts.map((c, idx) => (idx === index ? { ...c, selected: !c.selected } : c)));
  };

  async function handleSaveBatch() {
    const selected = contacts.filter((c) => c.selected);
    if (selected.length === 0) {
      setErrorMsg('Selecione ao menos 1 contato para importar.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    const res = await importClientsBatchAction(selected);

    setSaving(false);
    if (res?.error) {
      setErrorMsg(res.error);
    } else {
      setSuccessMsg(`${res.count} contato(s) importado(s) com sucesso!`);
      setTimeout(() => {
        setIsOpen(false);
        setContacts([]);
        setSuccessMsg(null);
        router.refresh();
      }, 1500);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium gap-1.5 shadow"
      >
        <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
        Importar Contatos / Excel
      </Button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx, .xls, .csv, .vcf, .txt, .ods"
        onChange={handleFileUpload}
        className="hidden"
      />

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="bg-slate-900 border-slate-800 text-slate-100 max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base text-white">Importar Clientes (Agenda / Excel)</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-950/60 border border-red-800/80 text-red-300 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{successMsg}</span>
                </div>
              )}

              {contacts.length === 0 ? (
                <div className="space-y-4 py-2 text-center">
                  <p className="text-xs text-slate-400">
                    Selecione como deseja carregar os dados dos seus clientes:
                  </p>

                  <div className="grid grid-cols-1 gap-3">
                    {/* Opção 1: Planilha Excel / CSV */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={loading}
                      className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/40 hover:border-amber-400 text-left space-y-1 transition-all hover:bg-amber-500/20 group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-amber-400 flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4" /> Importar Planilha Excel (.xlsx / .csv)
                        </span>
                        <span className="text-[10px] uppercase font-bold text-amber-400/80 bg-amber-500/20 px-2 py-0.5 rounded">
                          Desktop / PC
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">
                        Carregue planilhas do Excel ou CSV com colunas de Nome, WhatsApp, Telefone e E-mail.
                      </p>
                    </button>

                    {/* Opção 2: Agenda Nativa Mobile */}
                    <button
                      type="button"
                      onClick={handlePickNativeContacts}
                      disabled={loading}
                      className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/40 hover:border-emerald-400 text-left space-y-1 transition-all hover:bg-emerald-500/20 group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-emerald-400 flex items-center gap-2">
                          <Smartphone className="w-4 h-4" /> Abrir Agenda do Celular
                        </span>
                        <span className="text-[10px] uppercase font-bold text-emerald-400/80 bg-emerald-500/20 px-2 py-0.5 rounded">
                          Mobile
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">
                        Abre a agenda nativa do smartphone para escolher múltiplos contatos de uma só vez.
                      </p>
                    </button>

                    {/* Botão Baixar Modelo */}
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">Não tem a planilha no formato?</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleDownloadTemplate}
                        className="text-amber-400 hover:text-amber-300 text-xs font-medium gap-1 p-0 h-auto"
                      >
                        <Download className="w-3.5 h-3.5" /> Baixar Planilha Modelo (.csv)
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="flex items-center gap-1.5 text-amber-400 font-semibold hover:underline"
                    >
                      {contacts.every((c) => c.selected) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      Selecionar Todos ({contacts.length})
                    </button>
                    <span className="text-slate-400">
                      {contacts.filter((c) => c.selected).length} selecionado(s)
                    </span>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-2 p-1">
                    {contacts.map((c, idx) => (
                      <div
                        key={idx}
                        onClick={() => toggleSelectContact(idx)}
                        className={`p-2.5 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all ${
                          c.selected
                            ? 'bg-amber-500/10 border-amber-500/40 text-slate-100'
                            : 'bg-slate-950/60 border-slate-800 text-slate-500 opacity-60'
                        }`}
                      >
                        <div className="truncate">
                          <p className="font-semibold text-slate-200">{c.name}</p>
                          {(c.phone || c.whatsapp) && <p className="text-[11px] text-slate-400">{c.whatsapp || c.phone}</p>}
                        </div>
                        {c.selected ? <CheckSquare className="w-4 h-4 text-amber-400 shrink-0 ml-2" /> : <Square className="w-4 h-4 shrink-0 ml-2" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 flex items-center justify-between gap-3">
              {contacts.length > 0 ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setContacts([])}
                    className="text-slate-400 hover:text-white"
                  >
                    Voltar
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSaveBatch}
                    disabled={saving}
                    className="bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold text-xs shadow"
                  >
                    {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Check className="w-4 h-4 mr-1.5" />}
                    Cadastrar {contacts.filter((c) => c.selected).length} Cliente(s)
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="w-full bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Fechar
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
