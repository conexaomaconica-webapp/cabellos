'use client';

import { useState } from 'react';
import { ServiceCategory } from '@/types/database';
import { CategoryModal } from './CategoryModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FolderKanban, Plus, Edit3, Wrench } from 'lucide-react';

interface CategoriesClientProps {
  categories: (ServiceCategory & { services?: { count: number }[] })[];
}

export function CategoriesClient({ categories }: CategoriesClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | null>(null);

  function handleOpenCreate() {
    setSelectedCategory(null);
    setIsModalOpen(true);
  }

  function handleOpenEdit(cat: ServiceCategory) {
    setSelectedCategory(cat);
    setIsModalOpen(true);
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <FolderKanban className="h-6 w-6 text-blue-400" /> Categorias de Serviços
          </h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Agrupe seus serviços para facilitar o agendamento e os relatórios
          </p>
        </div>
        <Button
          onClick={handleOpenCreate}
          variant="default"
          className="bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold w-full sm:w-auto"
        >
          <Plus className="h-4 w-4 mr-1.5" /> Nova Categoria
        </Button>
      </div>

      {/* List */}
      {categories.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Nenhuma categoria cadastrada"
          description="Crie categorias como Cabelo, Barba, Unhas e Estética para organizar seus serviços."
          actionLabel="Criar Primeira Categoria"
          onAction={handleOpenCreate}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => {
            const serviceCount = cat.services?.[0]?.count || 0;

            return (
              <Card
                key={cat.id}
                className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-300 dark:border-slate-700 transition-all flex flex-col justify-between shadow-lg"
              >
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-10 w-10 rounded-xl flex items-center justify-center text-slate-900 dark:text-white font-bold shadow shrink-0"
                        style={{ backgroundColor: cat.color || '#3b82f6' }}
                      >
                        <FolderKanban className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-slate-900 dark:text-white truncate max-w-[180px]">
                          {cat.name}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                          <Wrench className="h-3.5 w-3.5" /> {serviceCount} serviço(s)
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenEdit(cat)}
                      className="h-8 w-8 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-slate-50 dark:bg-slate-800"
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  </div>

                  {cat.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/40 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800/60">
                      {cat.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <CategoryModal category={selectedCategory} onClose={() => setIsModalOpen(false)} />
      )}
    </div>
  );
}
