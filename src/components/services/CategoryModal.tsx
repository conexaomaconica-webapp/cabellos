'use client';

import { useState } from 'react';
import { ServiceCategory } from '@/types/database';
import { createCategoryAction, updateCategoryAction } from '@/app/(dashboard)/cadastros/categorias/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { FolderKanban, Palette, Loader2, X } from 'lucide-react';

interface CategoryModalProps {
  category?: ServiceCategory | null;
  onClose: () => void;
}

export function CategoryModal({ category, onClose }: CategoryModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [color, setColor] = useState(category?.color || '#3b82f6');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    let res;

    if (category) {
      res = await updateCategoryAction(category.id, formData);
    } else {
      res = await createCategoryAction(formData);
    }

    if (res?.error) {
      setError(res.error);
      setLoading(false);
    } else {
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in-50">
      <Card className="w-full max-w-md bg-slate-900 border-slate-800 text-slate-100 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
        >
          <X className="h-4 w-4" />
        </button>

        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold shadow"
              style={{ backgroundColor: color }}
            >
              <FolderKanban className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">
                {category ? 'Editar Categoria' : 'Nova Categoria'}
              </h3>
              <p className="text-xs text-slate-400">Organize os serviços por tipo ou setor</p>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-950/60 border border-red-800/80 p-3 text-xs text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                Nome da Categoria <span className="text-blue-400">*</span>
              </label>
              <Input
                name="name"
                defaultValue={category?.name || ''}
                placeholder="Ex: Cabelo, Barba, Unhas, Estética"
                required
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Descrição Opcional</label>
              <Input
                name="description"
                defaultValue={category?.description || ''}
                placeholder="Breve descrição dos procedimentos..."
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Cor de Identificação</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  name="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded-lg border border-slate-700 bg-slate-800 p-1"
                />
                <div className="flex gap-1.5 flex-wrap">
                  {['#3b82f6', '#10b981', '#ec4899', '#8b5cf6', '#f59e0b', '#ef4444'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      style={{ backgroundColor: c }}
                      className={`h-7 w-7 rounded-full border ${
                        color === c ? 'border-white scale-110' : 'border-slate-700'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <Button type="button" variant="secondary" onClick={onClose} className="bg-slate-800 text-slate-300">
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : category ? 'Salvar Alterações' : 'Criar Categoria'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
