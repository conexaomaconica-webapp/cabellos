# Diretrizes do Projeto Cabellos

## 1. Arquitetura de Papéis & Módulo Master (Homologado)
- A hierarquia de papéis do projeto está **OFICIALMENTE HOMOLOGADA** e **imutável**. Não alterar a hierarquia de papéis sem uma necessidade real, crítica e explicitamente aprovada pelo usuário.
- **Papéis globais de sistema (`profiles.system_role`):** `'master' | 'user'`.
- **Papéis por salão/tenant (`organization_users.role`):** `'admin' | 'receptionist' | 'professional'`.
- O papel `'owner'` foi **completamente extinto da lógica operacional** de RLS, RPCs e relatórios. O wrapper `create_organization_with_owner` é mantido apenas como `DEPRECATED` para compatibilidade com chamadores antigos do onboarding.
- Acesso ao Módulo Master global (`/master`) exige estritamente `system_role = 'master'`.
- O usuário Master NÃO possui bypass silencioso de RLS nos dados dos tenants; acessos operacionais dependem de vínculo formal na tabela `organization_users`.

## 2. Gestão de Migrations SQL (Sequencial e Imutável)
- **NÃO utilizar nem recriar arquivos de schema unificados (`full_schema_combined.sql`).**
- **NÃO utilizar nem recriar scripts de fusão de schema (`scripts/combine-migrations.mjs`).**
- Todas as alterações no banco de dados devem ser mantidas em **migrations separadas, cronológicas e imutáveis** no diretório `supabase/migrations/` seguindo o padrão oficial: `YYYYMMDD00000X_descricao.sql`.
- Migrations históricas já aplicadas são **imutáveis**. Qualquer nova correção ou melhoria deve ser adicionada como uma nova migration incremental ao final da sequência (ex: `20260919000001_fix_x.sql`).
- Todos os testes e scripts de validação de schema devem obrigatoriamente ler e executar as migrations separadas em sequência cronológica, reproduzindo o comportamento nativo do Supabase.
