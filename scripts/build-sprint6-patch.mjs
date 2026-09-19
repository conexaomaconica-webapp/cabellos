import fs from 'fs';
import path from 'path';

const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
const patchFilePath = path.join(process.cwd(), 'supabase', 'sprint6_rpc_patch.sql');

// Read migration 14 (Sprint 6)
const sprint6Content = fs.readFileSync(path.join(migrationsDir, '20260917000014_sprint6_reports_schema_and_rpcs.sql'), 'utf8');

// Read migration 13 (Sprint 5 RPCs)
const sprint5Content = fs.readFileSync(path.join(migrationsDir, '20260917000013_sprint5_financial_triggers_rls_rpcs.sql'), 'utf8');

// Read migration 11 (Sprint 4 RPCs)
const sprint4Content = fs.readFileSync(path.join(migrationsDir, '20260917000011_sprint4_triggers_rls_rpcs.sql'), 'utf8');

// Read migration 5 (Sprint 2 RPCs)
const sprint2Content = fs.readFileSync(path.join(migrationsDir, '20260917000005_sprint2_triggers_rls.sql'), 'utf8');

const header = `-- ==============================================================================
-- CABELLOS SAAS — PATCH DE CORREÇÃO DE AMBIGUIDADE E SPRINT 6 (RELATÓRIOS)
-- Arquivo leve e idempotente para execução direta no Supabase SQL Editor.
-- Atualiza todas as RPCs com qualificações explícitas de coluna e registra os relatórios.
-- ==============================================================================

`;

// Combine into patch file
const patchContent = header + 
  "--- SPRINT 6: RELATÓRIOS E INTELIGÊNCIA GERENCIAL ---\n" + sprint6Content + "\n\n" +
  "--- SPRINT 5: CORREÇÃO DE RPCS FINANCEIRAS ---\n" + sprint5Content + "\n\n" +
  "--- SPRINT 4: CORREÇÃO DE RPCS DE PACOTES ---\n" + sprint4Content + "\n\n" +
  "--- SPRINT 2: CORREÇÃO DE RPCS DE ATENDIMENTOS ---\n" + sprint2Content;

fs.writeFileSync(patchFilePath, patchContent, 'utf8');
console.log(`Successfully generated patch file at: ${patchFilePath} (${patchContent.split('\n').length} lines)`);
