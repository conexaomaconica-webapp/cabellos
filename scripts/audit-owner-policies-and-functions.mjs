import fs from 'fs';
import path from 'path';

const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

console.log(`=== AUDITORIA DE ESTADO FINAL DE SANEAMENTO "OWNER" (SEQUÊNCIA DE ${files.length} MIGRATIONS) ===\n`);

const content = files.map(f => fs.readFileSync(path.join(migrationsDir, f), 'utf8')).join('\n;\n');

// Map to track active policies in PostgreSQL: key = `${tableName}:${policyName}` -> policyText
const activePolicies = new Map();

// Map to track active functions in PostgreSQL: key = `functionName` -> functionText
const activeFunctions = new Map();

// Parse DROP POLICY statements
const dropPolicyRegex = /DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?["']?([^"'\s]+)["']?\s+ON\s+public\.([a-zA-Z0-9_]+)/gi;
let match;
while ((match = dropPolicyRegex.exec(content)) !== null) {
  const policyName = match[1].toLowerCase();
  const tableName = match[2].toLowerCase();
  activePolicies.delete(`${tableName}:${policyName}`);
}

// Parse CREATE POLICY statements
const createPolicyRegex = /CREATE\s+POLICY\s+["']?([^"'\s]+)["']?\s+ON\s+public\.([a-zA-Z0-9_]+)([\s\S]*?);/gi;
while ((match = createPolicyRegex.exec(content)) !== null) {
  const policyName = match[1].toLowerCase();
  const tableName = match[2].toLowerCase();
  const fullPolicy = match[0];
  activePolicies.set(`${tableName}:${policyName}`, fullPolicy);
}

// Parse CREATE OR REPLACE FUNCTION statements using block regex
const funcRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\)[\s\S]*?\$\$\s*([\s\S]*?)\$\$;?/gi;
while ((match = funcRegex.exec(content)) !== null) {
  const funcName = match[1].toLowerCase();
  const fullFuncText = match[0];
  activeFunctions.set(funcName, fullFuncText);
}

// 1. AUDITORIA DE POLÍTICAS RLS EFETIVAS FINAIS
console.log('--- 1. POLÍTICAS RLS EFETIVAS FINAIS (pg_policies) ---');
const activePoliciesWithOwner = [];

for (let [key, policyText] of activePolicies.entries()) {
  if (/'owner'|role\s*=\s*'owner'|organization_users\.role\s*=\s*'owner'/i.test(policyText)) {
    activePoliciesWithOwner.push({ key, policyText });
  }
}

console.log(`Total de Políticas RLS ATIVAS no estado final: ${activePolicies.size}`);
console.log(`Políticas RLS ATIVAS contendo 'owner': ${activePoliciesWithOwner.length}`);

if (activePoliciesWithOwner.length > 0) {
  activePoliciesWithOwner.forEach(p => console.error(`  [ERRO] Policy Ativa: ${p.key}`));
} else {
  console.log(`[PASS] ZERO POLICIES ATIVAS COM OWNER (0/0)`);
}

// 2. AUDITORIA DE FUNÇÕES EFETIVAS FINAIS
console.log('\n--- 2. FUNÇÕES EFETIVAS FINAIS (pg_proc) ---');
const activeFuncsWithOwner = [];

for (let [funcName, funcText] of activeFunctions.entries()) {
  if (/'owner'|organization_users\.role\s*=\s*'owner'|role\s*=\s*'owner'/i.test(funcText)) {
    activeFuncsWithOwner.push({ name: funcName, funcText });
  }
}

console.log(`Total de Funções ATIVAS no estado final: ${activeFunctions.size}`);
console.log(`Funções ATIVAS contendo 'owner': ${activeFuncsWithOwner.length}`);

activeFuncsWithOwner.forEach(f => {
  const isWrapper = f.name === 'create_organization_with_owner';
  console.log(`  - public.${f.name}: ${isWrapper ? '[PERMITIDO] Wrapper Deprecated de Onboarding' : '[ERRO] Função contendo owner não autorizada'}`);
});

const unallowedFuncs = activeFuncsWithOwner.filter(f => f.name !== 'create_organization_with_owner');

console.log(`\n======================================================`);
console.log(`STATUS FINAL DE AUDITORIA DE POLICIES E FUNÇÕES: ${activePoliciesWithOwner.length === 0 && unallowedFuncs.length === 0 ? 'PASS (100% SANEADO)' : 'FAIL'}`);
console.log(`- Policies RLS Ativas com Owner: ${activePoliciesWithOwner.length}`);
console.log(`- Funções Operacionais Ativas com Owner: ${unallowedFuncs.length}`);
console.log(`- Wrapper Deprecated Mantido: ${activeFunctions.has('create_organization_with_owner') ? 'SIM (create_organization_with_owner)' : 'NÃO'}`);
console.log(`======================================================\n`);

if (activePoliciesWithOwner.length > 0 || unallowedFuncs.length > 0) {
  process.exit(1);
}
