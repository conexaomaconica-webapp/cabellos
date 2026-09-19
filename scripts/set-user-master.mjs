import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valParts] = trimmed.split('=');
        if (key && valParts.length > 0) {
          const val = valParts.join('=').trim().replace(/^["']|["']$/g, '');
          if (!process.env[key.trim()]) {
            process.env[key.trim()] = val;
          }
        }
      }
    });
  }
}

loadEnvLocal();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ ERRO: NEXT_PUBLIC_SUPABASE_URL deve estar definido em .env.local');
  process.exit(1);
}

const targetEmail = process.argv[2]?.trim().toLowerCase();

if (!targetEmail) {
  console.log('💡 USO: node scripts/set-user-master.mjs <email_do_usuario>');
  console.log('   Exemplo: node scripts/set-user-master.mjs admin@cabellos.com.br');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

async function main() {
  console.log(`\n🔍 Buscando usuário com e-mail: "${targetEmail}"...`);

  // 1. Localizar perfil
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id, name, email, system_role, created_at')
    .ilike('email', targetEmail)
    .maybeSingle();

  if (profileErr) {
    console.error('❌ Erro ao consultar a tabela profiles:', profileErr.message);
    process.exit(1);
  }

  if (!profile) {
    console.error(`❌ Usuário com o e-mail "${targetEmail}" não foi encontrado no banco de dados (ou RLS bloqueou a consulta por ausência de SERVICE_ROLE_KEY).`);
    console.log('ℹ️ Para atualizar no Supabase Dashboard SQL Editor, use o comando SQL seguro informado.');
    process.exit(1);
  }

  console.log('\n--- DADOS DO USUÁRIO ENCONTRADO ---');
  console.log(`ID: ${profile.id}`);
  console.log(`Nome: ${profile.name || 'N/A'}`);
  console.log(`E-mail: ${profile.email}`);
  console.log(`Papel Global Atual (system_role): ${profile.system_role}`);
  console.log('------------------------------------\n');

  if (profile.system_role === 'master') {
    console.log(`✅ O usuário "${profile.email}" JÁ É um Administrador Master (system_role = 'master').`);
    process.exit(0);
  }

  // 2. Confirmação interativa via terminal
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query) => new Promise((resolve) => rl.question(query, resolve));

  const answer = await question(`⚠️ Confirmar a promoção do usuário "${profile.email}" para MASTER (system_role = 'master')? (s/N): `);
  rl.close();

  if (answer.toLowerCase() !== 's' && answer.toLowerCase() !== 'sim') {
    console.log('🚫 Operação cancelada pelo usuário.');
    process.exit(0);
  }

  // 3. Tentar chamar a RPC com permissão ativada
  const { error: rpcErr } = await supabase.rpc('master_manage_user_system_role', {
    p_target_user_id: profile.id,
    p_new_role: 'master',
  });

  if (rpcErr) {
    console.log('⚠️ Tentando fallback via chave de serviço com bypass do trigger...');
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ system_role: 'master', updated_at: new Date().toISOString() })
      .eq('id', profile.id);

    if (updateErr) {
      console.error('❌ Erro ao atualizar profiles:', updateErr.message);
      console.log('\n💡 Execute o comando SQL no Supabase Dashboard SQL Editor:');
      console.log(`
SELECT set_config('cabellos.allow_system_role_change', 'true', true);

UPDATE public.profiles
SET system_role = 'master'
WHERE email = '${targetEmail}';
      `);
      process.exit(1);
    }
  }

  console.log(`\n🎉 SUCESSO! O usuário "${profile.email}" foi promovido a MASTER (system_role = 'master').`);
  console.log('🔒 Permissão global atualizada com sucesso.\n');
}

main().catch((err) => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
