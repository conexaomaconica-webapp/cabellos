# Arquitetura de Segurança, Auditoria e Backups — Módulo Master

Este documento detalha as salvaguardas de segurança, autorização e gerenciamento de dados implementadas no **Módulo Master do Cabellos**.

---

## 1. Princípio de Separação de Autorização (Defense in Depth)

### Master Global vs. Tenant Membership
- O papel `master` é atribuído exclusivamente na tabela `profiles` (`profiles.system_role = 'master'`).
- O papel `master` **não pertence** a `organization_users.role` (que aceita exclusivamente `'admin'`, `'receptionist'`, `'professional'`).
- O `master` **não ganha acesso automático nem bypass de RLS** para os dados operacionais dos salões. Para suporte em tenant específico, é exigida membership explícita como `admin`.

### Tripla Proteção de Rotas (`/master/*`)
1. **Middleware Guard:** Verifica se o usuário autenticado possui `system_role = 'master'`.
2. **Server Layout Guard (`layout.tsx`):** Redundância server-side consultando diretamente o banco de dados.
3. **RPC Authorization:** Toda RPC administrativa executa `user_is_master(auth.uid())` antes de qualquer instrução SQL.

---

## 2. Restrição da Chave de Serviço (`SUPABASE_SERVICE_ROLE_KEY`)

- A chave `SUPABASE_SERVICE_ROLE_KEY` é utilizada **exclusivamente em Server Actions e rotas de API server-side**.
- **JAMAIS** é exposta a Client Components, arquivos `.env.public` ou enviada ao navegador/browser.

---

## 3. Trava Concorrente do Último Master

A RPC `master_manage_user_system_role` aplica bloqueio transacional de concorrência (`FOR UPDATE` na tabela `profiles`).
Mesmo em caso de solicitações simultâneas de rebaixamento, a função valida a contagem e impede que a quantidade de Masters ativos caia para zero (`COUNT(master) <= 1`).

---

## 4. Proteção contra UPDATE Direto em `profiles.system_role`

Um trigger de banco de dados (`trg_prevent_direct_system_role_update`) impede que usuários comuns executem `UPDATE profiles SET system_role = 'master'`.
A alteração de papel do sistema só é autorizada mediante a execução da RPC `master_manage_user_system_role`.

---

## 5. Exportações Lógicas e Storage Privado

- As exportações de segurança são processadas no servidor e sanitizadas (sem hashes de senha, tokens, keys privadas ou PII desnecessária).
- Os arquivos são armazenados no bucket privado Supabase Storage `tenant-backups`.
- O download ocorre exclusivamente via Signed URL com validade de 60 segundos após verificação de autorização `user_is_master(auth.uid())`.
- Toda geração e download de backup registra evento na trilha imutável de auditoria (`backup_generated`, `backup_downloaded`).

---

## 6. Trilha Imutável de Auditoria (`master_audit_logs`)

- A tabela `master_audit_logs` aceita exclusivamente operações de `INSERT` e `SELECT` pelo Master. Operações de `UPDATE` ou `DELETE` são permanentemente bloqueadas.
- Todas as RPCs administrativas gravam seus próprios eventos de auditoria internamente.
