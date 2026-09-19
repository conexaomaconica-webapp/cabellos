import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import { Service, ServiceCategory } from '@/types/database';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Wrench, Plus, Edit3, Clock, RotateCcw, FolderKanban } from 'lucide-react';
import Link from 'next/link';

export default async function ServicesPage() {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  const [{ data: servicesData }, { data: categoriesData }] = await Promise.all([
    supabase
      .from('services')
      .select('*, category:service_categories(*)')
      .eq('organization_id', activeOrgId!)
      .order('created_at', { ascending: false }),
    supabase
      .from('service_categories')
      .select('*')
      .eq('organization_id', activeOrgId!)
      .order('sort_order', { ascending: true }),
  ]);

  const services = (servicesData || []) as (Service & { category?: ServiceCategory })[];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Wrench className="h-6 w-6 text-purple-400" /> Catálogo de Serviços
          </h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Cadastre os preços, duração e frequência recomendada de retorno para cada serviço
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/cadastros/categorias">
            <Button variant="secondary" className="bg-slate-50 dark:bg-slate-800 text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700">
              <FolderKanban className="h-4 w-4 mr-1.5" /> Categorias
            </Button>
          </Link>
          <Link href="/cadastros/servicos/novo">
            <Button variant="default" className="bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold shadow-lg">
              <Plus className="h-4 w-4 mr-1.5" /> Novo Serviço
            </Button>
          </Link>
        </div>
      </div>

      {/* List */}
      {services.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="Nenhum serviço cadastrado"
          description="Cadastre os cortes, barbas, escovas e procedimentos oferecidos no seu estabelecimento."
          actionLabel="Cadastrar Primeiro Serviço"
          actionHref="/cadastros/servicos/novo"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service) => (
            <Card
              key={service.id}
              className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-300 dark:border-slate-700 transition-all flex flex-col justify-between shadow-lg"
            >
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <h3 className="font-bold text-base text-slate-900 dark:text-white truncate max-w-[180px]">
                      {service.name}
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      {service.category ? (
                        <Badge
                          style={{ backgroundColor: service.category.color || '#3b82f6' }}
                          className="text-slate-900 dark:text-white font-medium"
                        >
                          {service.category.name}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700">
                          Sem Categoria
                        </Badge>
                      )}
                      <Badge variant={service.is_active ? 'success' : 'destructive'}>
                        {service.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                  </div>

                  <Link href={`/cadastros/servicos/${service.id}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-slate-50 dark:bg-slate-800">
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>

                <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Preço</span>
                    <span className="text-purple-600 dark:text-purple-400 font-bold text-sm">
                      {formatCurrency(service.price)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-800/60">
                    <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                      <Clock className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" /> Duração Estimada
                    </span>
                    <span className="text-slate-900 dark:text-slate-200 font-medium">{service.duration_minutes} min</span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-800/60">
                    <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                      <RotateCcw className="h-3.5 w-3.5 text-amber-400" /> Retorno Padrão
                    </span>
                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                      {service.default_return_interval_days} dias
                    </span>
                  </div>
                </div>

                {service.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic line-clamp-2">
                    &quot;{service.description}&quot;
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
