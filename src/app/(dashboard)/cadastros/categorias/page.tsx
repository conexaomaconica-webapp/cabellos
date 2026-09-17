import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import { ServiceCategory } from '@/types/database';
import { CategoriesClient } from '@/components/services/CategoriesClient';

export default async function CategoriesPage() {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  const { data: categoriesData } = await supabase
    .from('service_categories')
    .select('*, services(count)')
    .eq('organization_id', activeOrgId!)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  const categories = (categoriesData || []) as (ServiceCategory & {
    services?: { count: number }[];
  })[];

  return <CategoriesClient categories={categories} />;
}
