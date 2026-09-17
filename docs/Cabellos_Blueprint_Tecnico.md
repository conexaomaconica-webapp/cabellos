# Cabellos — Blueprint Técnico do Sistema SaaS para Salões de Beleza e Barbearias


## 0. Identidade do Produto

### Nome oficial

**Cabellos**

### Categoria

SaaS de gestão para salões de beleza, barbearias e profissionais de serviços recorrentes.

### Proposta central

O Cabellos organiza a operação diária do estabelecimento e transforma o histórico de atendimento em uma ferramenta ativa de retenção de clientes.

### Posicionamento sugerido

> **Cabellos — gestão que acompanha o cliente e ajuda o salão a trazê-lo de volta.**

### Promessa do produto

Permitir que o estabelecimento controle clientes, atendimentos, financeiro, pacotes e retornos em um único sistema simples, com alertas inteligentes para lembrar quando cada cliente costuma retornar.

### Pilares do produto

- **Atendimento:** registrar rapidamente tudo o que acontece no dia.
- **Relacionamento:** acompanhar histórico e frequência de cada cliente.
- **Retenção:** alertar o estabelecimento no momento ideal para entrar em contato.
- **Financeiro:** acompanhar receitas, despesas e resultado.
- **Recorrência:** controlar pacotes e hábitos de retorno.
- **Gestão:** transformar dados do dia a dia em relatórios úteis.

### Diretriz de marca no sistema

Usar **Cabellos** como marca principal da plataforma.

Exemplos:

- Cabellos
- Painel Cabellos
- Cabellos Gestão
- Cabellos Retornos
- Cabellos Financeiro
- Cabellos Relatórios

O nome de cada salão ou barbearia deve aparecer como identidade do tenant, sem substituir a marca da plataforma.

Exemplo:

**Cabellos**  
Salão Bella

ou

**Cabellos**  
Barbearia Central

### Identificadores técnicos sugeridos

```text
cabellos
cabellos-app
cabellos-web
cabellos-saas
```

---

## 1. Visão do Produto

Criar o **Cabellos**, uma plataforma SaaS simples, rápida e orientada à operação diária de salões de beleza, barbearias e negócios similares.

O sistema deverá permitir:

- Login e senha por usuário.
- Identidade visual personalizada por estabelecimento.
- Cadastro de clientes.
- Cadastro de profissionais.
- Cadastro de serviços.
- Registro de atendimentos diários.
- Controle financeiro.
- Controle de pacotes de atendimento.
- Histórico completo de cada cliente.
- Cálculo da frequência média de retorno por cliente.
- Alertas automáticos de retorno.
- Modelos de mensagens personalizáveis.
- Abertura do WhatsApp com mensagem pronta para o cliente.
- Relatórios gerenciais.
- Estrutura SaaS multi-tenant desde a primeira versão.

O principal diferencial do produto será transformar o histórico de atendimento em uma ferramenta ativa de retenção de clientes.

Fluxo principal:

CLIENTE → ATENDIMENTO → HISTÓRICO → FREQUÊNCIA → ALERTA → WHATSAPP → NOVO ATENDIMENTO

---

# 2. Objetivo Principal

Permitir que o estabelecimento saiba:

- Quem foi atendido.
- Quando foi atendido.
- Qual serviço realizou.
- Quanto pagou.
- Quem realizou o atendimento.
- Qual a frequência média daquele cliente.
- Quando o cliente provavelmente deverá retornar.
- Quais clientes precisam receber contato.
- Quanto o estabelecimento faturou.
- Quais serviços performam melhor.
- Quais pacotes estão ativos.
- Quais clientes estão inativos.
- Quais profissionais geram mais atendimentos e faturamento.

O sistema deve priorizar velocidade e simplicidade operacional.

---

# 3. Público-Alvo

O Cabellos deverá atender:

- Barbearias.
- Salões de beleza.
- Cabeleireiros.
- Manicures e pedicures.
- Estúdios de estética.
- Profissionais de beleza independentes.
- Clínicas pequenas com atendimento recorrente.
- Negócios baseados em serviços recorrentes.

---

# 4. Estratégia de Produto

O Cabellos deve nascer como SaaS multiempresa.

Cada estabelecimento será um tenant independente.

Exemplo:

Plataforma
- Barbearia Alfa
- Salão Bella
- Studio Maria
- Espaço Beauty

Os dados nunca deverão ser compartilhados entre tenants.

Todas as entidades de negócio devem possuir `organization_id` ou equivalente.

---

# 5. Arquitetura Recomendada

## Frontend

- Next.js
- App Router
- TypeScript
- Tailwind CSS
- shadcn/ui

## Backend

- Next.js Server Actions
- Route Handlers quando necessário

## Banco de Dados

- PostgreSQL
- Supabase

## Autenticação

- Supabase Auth

## Storage

- Supabase Storage

## Segurança

- Row Level Security
- Isolamento obrigatório por `organization_id`

## Deploy

Compatível com:

- Vercel
- Supabase

---

# 6. Princípios de Arquitetura

1. Multi-tenant desde o início.
2. Nenhuma consulta deve ignorar `organization_id`.
3. Controle de acesso por perfil.
4. RLS obrigatório nas tabelas sensíveis.
5. Operações financeiras devem possuir histórico.
6. Registros importantes não devem ser apagados fisicamente sem necessidade.
7. Utilizar preferencialmente `deleted_at`, `is_active` ou cancelamento lógico.
8. Datas devem ser armazenadas em UTC e apresentadas no timezone do estabelecimento.
9. Valores financeiros devem utilizar `numeric`, nunca float.
10. O sistema deve permitir evolução futura para múltiplas unidades por organização.

---

# 7. Perfis de Usuário

## 7.1 Admin do Estabelecimento

Pode:

- Configurar empresa.
- Alterar identidade visual.
- Gerenciar usuários.
- Gerenciar profissionais.
- Gerenciar clientes.
- Gerenciar serviços.
- Registrar atendimentos.
- Visualizar financeiro.
- Registrar despesas.
- Visualizar relatórios.
- Gerenciar pacotes.
- Gerenciar mensagens.
- Configurar frequência e alertas.

## 7.2 Profissional

Pode, conforme permissões:

- Ver seus atendimentos.
- Registrar atendimento.
- Consultar clientes.
- Consultar histórico.
- Ver agenda futura, quando existir.
- Visualizar sua produção.
- Visualizar sua comissão, se permitido.

Não deve visualizar configurações globais nem financeiro total, salvo autorização.

## 7.3 Master da Plataforma

Perfil opcional para administração SaaS.

Pode:

- Gerenciar tenants.
- Ativar/inativar organizações.
- Visualizar planos.
- Administrar cobrança futura.
- Acompanhar uso do sistema.
- Suporte técnico.

O Master não deve depender de rotas do tenant.

---

# 8. Onboarding do Estabelecimento

Após cadastro inicial:

1. Criar organização.
2. Criar usuário administrador.
3. Definir nome do estabelecimento.
4. Enviar logomarca.
5. Escolher cor principal.
6. Informar WhatsApp.
7. Informar telefone.
8. Informar endereço.
9. Informar Instagram.
10. Definir horário de funcionamento.
11. Cadastrar primeiros profissionais.
12. Cadastrar primeiros serviços.
13. Configurar mensagens de retorno.

---

# 9. Identidade do Estabelecimento

Campos:

- Nome fantasia.
- Razão social opcional.
- Documento opcional.
- Logomarca.
- Cor primária.
- Cor secundária.
- WhatsApp.
- Telefone.
- Instagram.
- E-mail.
- Endereço.
- Cidade.
- Estado.
- CEP.
- Timezone.
- Moeda.
- Horário de funcionamento.

A interface deve aplicar a cor principal do tenant em:

- Botões principais.
- Destaques.
- Cabeçalho.
- Elementos de marca.

---

# 10. Dashboard

O dashboard deve responder rapidamente:

- Quantos atendimentos existem hoje?
- Quanto foi faturado hoje?
- Quantos clientes precisam de contato?
- Existem retornos atrasados?
- Existem pacotes próximos de acabar?
- Qual o ticket médio?
- Quanto entrou no mês?

## Cards principais

### Hoje

- Atendimentos hoje.
- Faturamento hoje.
- Ticket médio.
- Clientes novos.
- Retornos do dia.
- Retornos atrasados.

## Financeiro

- Receitas.
- Despesas.
- Resultado.
- PIX.
- Dinheiro.
- Débito.
- Crédito.

## Alertas

- Clientes para contatar hoje.
- Clientes atrasados.
- Pacotes com saldo baixo.
- Pacotes expirados.
- Pacotes próximos de expirar.

## Atalho principal

`+ Novo Atendimento`

Esse deve ser um dos botões mais visíveis do sistema.

---

# 11. Cadastro de Clientes

## Dados Básicos

- id
- organization_id
- name
- phone
- whatsapp
- email
- birth_date
- gender opcional
- notes
- preferred_professional_id
- is_active
- created_at
- updated_at

## Dados Calculados

- first_appointment_at
- last_appointment_at
- total_appointments
- total_spent
- average_ticket
- average_return_days
- next_expected_return_at
- last_contact_at

## Preferências

- preferred_service_id
- custom_return_interval_days
- return_rule_mode
- allow_whatsapp
- notes

---

# 12. Frequência de Atendimento do Cliente

O sistema deverá permitir três formas de determinar a frequência.

## 12.1 Frequência Manual

O estabelecimento define:

Exemplo:

`15 dias`

Esse valor terá prioridade quando configurado.

Campo sugerido:

`custom_return_interval_days`

---

# 12.2 Frequência pelo Serviço

Cada serviço poderá ter:

`default_return_interval_days`

Exemplo:

- Barba: 7 dias.
- Corte masculino: 15 dias.
- Coloração: 30 dias.
- Manicure: 15 dias.

Quando o cliente ainda não possuir histórico, utilizar essa referência.

---

# 12.3 Frequência Calculada

O sistema deverá calcular a média dos intervalos entre atendimentos.

Exemplo:

01/08
16/08
31/08
15/09

Intervalos:

15
15
15

Média:

15 dias

Campo:

`average_return_days`

---

# 13. Regra de Prioridade da Frequência

Sugestão:

1. Frequência manual do cliente.
2. Média histórica confiável.
3. Frequência do serviço principal.
4. Frequência padrão global.

Configuração global exemplo:

`default_return_interval_days = 20`

---

# 14. Cálculo da Média

Considerar apenas atendimentos:

- concluídos;
- não cancelados;
- pertencentes ao tenant;
- relevantes para retorno.

Pode ser interessante permitir que determinados serviços não participem do cálculo.

Exemplo:

- Venda de produto.
- Cortesia.
- Ajuste simples.

Campo no serviço:

`counts_for_return_frequency BOOLEAN`

---

# 15. Quantidade Mínima de Histórico

Para considerar uma frequência automática confiável:

- mínimo recomendado: 3 atendimentos.

Antes disso:

usar intervalo manual ou intervalo do serviço.

---

# 16. Próximo Retorno Esperado

Fórmula:

`last_appointment_at + return_interval_days`

Resultado:

`next_expected_return_at`

Exemplo:

Último atendimento:
01/09/2026

Frequência:
15 dias

Retorno previsto:
16/09/2026

---

# 17. Central de Retornos

Criar módulo:

`Retornos`

Subdivisões:

- Hoje
- Atrasados
- Próximos 7 dias
- Próximos 15 dias
- Contatados
- Retornaram
- Ignorados

## Card do Cliente

Exibir:

- Nome.
- WhatsApp.
- Foto opcional.
- Último atendimento.
- Serviço habitual.
- Profissional preferido.
- Frequência.
- Retorno previsto.
- Dias desde último atendimento.
- Status.
- Botão WhatsApp.
- Botão Marcar como contatado.
- Botão Adiar alerta.
- Botão Ignorar.

---

# 18. Regras de Alerta

O sistema deve criar alertas de forma automática.

Exemplos:

## Retorno no dia

Se:

`today >= next_expected_return_at`

Status:

`due`

## Atrasado

Se:

`today > next_expected_return_at`

Status:

`overdue`

## Próximo

Se:

`next_expected_return_at <= today + 7 dias`

Status:

`upcoming`

---

# 19. Adiamento de Alerta

Permitir:

- Amanhã.
- 3 dias.
- 7 dias.
- Data personalizada.

Campos:

- snoozed_until
- snooze_reason opcional

---

# 20. Status de Retorno

Sugestão:

- upcoming
- due
- overdue
- contacted
- scheduled
- returned
- ignored
- snoozed

---

# 21. WhatsApp

Versão inicial:

não integrar diretamente com API oficial.

Utilizar:

`wa.me`

ou deep link equivalente.

Fluxo:

1. Usuário clica em "Enviar WhatsApp".
2. Sistema seleciona template.
3. Substitui variáveis.
4. Abre conversa com mensagem pré-preenchida.
5. Usuário envia manualmente.

---

# 22. Modelos de Mensagem

Tabela:

`message_templates`

Campos:

- id
- organization_id
- name
- type
- content
- is_default
- is_active
- created_at
- updated_at

Tipos:

- return_reminder
- package_renewal
- birthday
- inactive_client
- custom

---

# 23. Variáveis de Mensagem

Suportar:

- `{{nome}}`
- `{{salao}}`
- `{{ultimo_atendimento}}`
- `{{servico}}`
- `{{profissional}}`
- `{{dias_sem_atendimento}}`
- `{{pacote}}`
- `{{saldo_pacote}}`

Exemplo:

Olá, {{nome}}! Tudo bem? 😊

Já faz um tempinho desde seu último atendimento aqui no {{salao}}.

Que tal reservar um horário para cuidar do visual novamente?

Se quiser agendar, é só falar com a gente por aqui.

---

# 24. Histórico de Contatos

Criar tabela:

`client_contacts`

Campos:

- id
- organization_id
- client_id
- user_id
- contact_type
- message_template_id
- message_content
- contacted_at
- result
- notes

Tipos:

- whatsapp
- phone
- instagram
- in_person
- other

Resultados:

- sent
- no_response
- interested
- scheduled
- declined

---

# 25. Serviços

Tabela:

`services`

Campos:

- id
- organization_id
- name
- description
- price
- duration_minutes
- default_return_interval_days
- counts_for_return_frequency
- category_id
- is_active
- created_at
- updated_at

---

# 26. Categorias de Serviço

Exemplos:

- Cabelo
- Barba
- Unhas
- Estética
- Química
- Tratamentos
- Pacotes
- Outros

Tabela:

`service_categories`

---

# 27. Profissionais

Tabela:

`professionals`

Campos:

- id
- organization_id
- user_id opcional
- name
- phone
- email
- photo_url
- commission_type
- commission_value
- is_active
- created_at
- updated_at

Tipos de comissão:

- none
- percentage
- fixed
- custom

---

# 28. Serviços por Profissional

Tabela pivô:

`professional_services`

Campos:

- professional_id
- service_id
- custom_price opcional
- custom_commission opcional
- is_active

---

# 29. Atendimento

Usar conceito de atendimento, não obrigatoriamente agenda.

Tabela:

`appointments`

Campos:

- id
- organization_id
- client_id
- professional_id
- appointment_date
- started_at opcional
- finished_at opcional
- status
- notes
- subtotal
- discount
- total
- payment_status
- created_by
- created_at
- updated_at

Status:

- draft
- scheduled
- in_progress
- completed
- cancelled
- no_show

---

# 30. Serviços do Atendimento

Um atendimento pode possuir vários serviços.

Tabela:

`appointment_services`

Campos:

- id
- organization_id
- appointment_id
- service_id
- professional_id
- quantity
- unit_price
- discount
- total
- commission_amount
- counts_for_return_frequency
- created_at

---

# 31. Fluxo de Novo Atendimento

Tela otimizada para celular.

Passos:

1. Selecionar cliente.
2. Caso não exista, cadastro rápido.
3. Selecionar serviço.
4. Selecionar profissional.
5. Informar valor.
6. Aplicar desconto opcional.
7. Selecionar forma de pagamento.
8. Informar pacote, se aplicável.
9. Inserir observação opcional.
10. Concluir atendimento.

Ao concluir:

- atualizar histórico do cliente;
- gerar receita financeira;
- consumir pacote, se aplicável;
- calcular comissão;
- atualizar estatísticas;
- recalcular frequência;
- recalcular retorno esperado;
- encerrar alerta anterior;
- criar próximo ciclo de retorno.

---

# 32. Cadastro Rápido de Cliente

Dentro do atendimento:

Campos mínimos:

- Nome
- WhatsApp

Botão:

`Salvar e continuar`

Dados adicionais podem ser completados posteriormente.

---

# 33. Formas de Pagamento

Tabela:

`payment_methods`

Campos:

- id
- organization_id
- name
- type
- is_active
- sort_order

Tipos:

- cash
- pix
- debit_card
- credit_card
- transfer
- package
- other

---

# 34. Pagamentos do Atendimento

Permitir pagamento dividido.

Exemplo:

R$ 100

- R$ 50 PIX
- R$ 50 cartão

Tabela:

`appointment_payments`

Campos:

- id
- organization_id
- appointment_id
- payment_method_id
- amount
- installments
- notes
- paid_at

---

# 35. Financeiro

O módulo financeiro deverá ser simples no MVP.

Principais operações:

- Receitas automáticas de atendimentos.
- Receitas de pacotes.
- Receitas manuais.
- Despesas.
- Categorias.
- Formas de pagamento.
- Resultado por período.

---

# 36. Transações Financeiras

Tabela:

`financial_transactions`

Campos:

- id
- organization_id
- type
- category_id
- source_type
- source_id
- description
- amount
- due_date
- paid_at
- status
- payment_method_id
- professional_id opcional
- client_id opcional
- notes
- created_by
- created_at
- updated_at

Tipos:

- income
- expense

Status:

- pending
- paid
- cancelled

---

# 37. Categorias Financeiras

Tabela:

`financial_categories`

Exemplos de receita:

- Atendimento
- Pacote
- Produto
- Outros

Exemplos de despesa:

- Aluguel
- Energia
- Água
- Internet
- Produtos
- Materiais
- Marketing
- Comissão
- Impostos
- Manutenção
- Outros

---

# 38. Pacotes de Atendimento

Exemplo:

Pacote Barba Mensal

- 4 atendimentos
- validade 30 dias
- R$ 100

Tabela:

`packages`

Campos:

- id
- organization_id
- name
- description
- price
- validity_days
- is_active
- created_at
- updated_at

---

# 39. Itens do Pacote

Tabela:

`package_items`

Campos:

- id
- organization_id
- package_id
- service_id
- quantity

---

# 40. Pacote Comprado pelo Cliente

Tabela:

`client_packages`

Campos:

- id
- organization_id
- client_id
- package_id
- purchased_at
- starts_at
- expires_at
- amount_paid
- status
- notes

Status:

- active
- completed
- expired
- cancelled

---

# 41. Uso do Pacote

Tabela:

`package_usages`

Campos:

- id
- organization_id
- client_package_id
- appointment_id
- service_id
- quantity
- used_at
- professional_id

---

# 42. Saldo do Pacote

Calcular:

Quantidade contratada
-
Quantidade utilizada
=
Saldo disponível

Exemplo:

4 atendimentos

3 utilizados

1 disponível

---

# 43. Alertas de Pacote

Criar alertas quando:

- saldo = 1;
- saldo = 0;
- faltam 7 dias para expirar;
- pacote expirou;
- cliente costuma renovar.

Permitir mensagem de renovação via WhatsApp.

---

# 44. Comissão

Suportar futuramente:

- comissão por profissional;
- comissão por serviço;
- comissão percentual;
- comissão fixa.

Prioridade:

1. Comissão específica profissional + serviço.
2. Comissão do serviço.
3. Comissão padrão do profissional.
4. Sem comissão.

---

# 45. Relatório de Atendimentos

Filtros:

- Hoje
- Ontem
- Semana
- Mês
- Período personalizado
- Cliente
- Profissional
- Serviço
- Status

Indicadores:

- quantidade de atendimentos;
- faturamento;
- ticket médio;
- descontos;
- clientes novos;
- clientes recorrentes.

---

# 46. Relatório Financeiro

Indicadores:

- receitas;
- despesas;
- resultado;
- ticket médio;
- formas de pagamento;
- receita por categoria;
- despesa por categoria.

Filtros:

- período;
- profissional;
- categoria;
- pagamento.

---

# 47. Relatório de Clientes

Indicadores:

- total de clientes;
- clientes ativos;
- clientes novos;
- clientes recorrentes;
- clientes inativos;
- clientes sem retorno;
- clientes com maior faturamento;
- clientes com mais atendimentos.

---

# 48. Relatório de Retenção

Muito importante.

Mostrar:

- clientes previstos para retornar;
- clientes que retornaram no prazo;
- clientes atrasados;
- clientes recuperados após contato;
- clientes sem retorno;
- média de dias entre visitas.

Métrica futura:

`taxa_de_retorno`

---

# 49. Relatório de Serviços

Mostrar:

- serviços mais vendidos;
- quantidade;
- faturamento;
- ticket médio;
- frequência média;
- profissionais que mais executaram.

---

# 50. Relatório de Profissionais

Mostrar:

- atendimentos;
- faturamento;
- ticket médio;
- clientes atendidos;
- serviços;
- comissão;
- recorrência de clientes.

---

# 51. Relatório de Pacotes

Mostrar:

- pacotes vendidos;
- faturamento;
- ativos;
- concluídos;
- expirados;
- renovações;
- saldo médio.

---

# 52. Exportações

Planejar suporte a:

- PDF
- Excel / XLSX
- CSV

No MVP pode começar por:

- CSV
- impressão amigável

---

# 53. Clientes Inativos

Configuração global:

Exemplo:

Cliente inativo após 60 dias sem atendimento.

Campo:

`inactive_client_days`

Lista:

- Nome
- Último atendimento
- Dias sem atendimento
- Serviço habitual
- Total gasto
- WhatsApp

Botão:

`Enviar mensagem`

---

# 54. Aniversariantes

Funcionalidade simples e útil.

Dashboard:

`3 aniversariantes esta semana`

Permitir WhatsApp com template.

---

# 55. Pesquisa Global

Campo de busca:

Pesquisar:

- clientes;
- telefone;
- profissionais;
- serviços.

Atalho especialmente importante no mobile.

---

# 56. Menu Principal

Sugestão:

## Dashboard

## Atendimentos

## Clientes

## Retornos

## Pacotes

## Financeiro

## Relatórios

## Cadastros

- Serviços
- Categorias
- Profissionais
- Formas de pagamento

## Configurações

- Estabelecimento
- Identidade visual
- Usuários
- Mensagens
- Alertas e retornos

---

# 57. Experiência Mobile

Prioridade máxima.

A maioria dos usuários utilizará celular.

Requisitos:

- Interface responsiva.
- Botões grandes.
- Poucos campos.
- Busca rápida.
- Modais ou drawers quando conveniente.
- Atendimento concluído em poucos toques.
- WhatsApp acessível diretamente.

---

# 58. Banco de Dados — Tabelas Principais

Estrutura sugerida:

```text
organizations
organization_settings

profiles
organization_users

clients
client_contacts

professionals
services
service_categories
professional_services

appointments
appointment_services
appointment_payments

payment_methods

packages
package_items
client_packages
package_usages

financial_categories
financial_transactions

message_templates
return_alerts
```

---

# 59. organizations

Campos sugeridos:

```sql
id uuid primary key
name text not null
slug text unique
logo_url text
primary_color text
secondary_color text
phone text
whatsapp text
email text
instagram text
address text
city text
state text
postal_code text
timezone text default 'America/Sao_Paulo'
currency text default 'BRL'
is_active boolean default true
created_at timestamptz
updated_at timestamptz
```

---

# 60. organization_users

Relacionamento usuários x organização.

```sql
id uuid primary key
organization_id uuid not null
user_id uuid not null
role text not null
is_active boolean default true
created_at timestamptz
```

Roles:

```text
owner
admin
professional
receptionist
```

---

# 61. clients

```sql
id uuid primary key
organization_id uuid not null
name text not null
phone text
whatsapp text
email text
birth_date date
gender text
notes text
preferred_professional_id uuid
preferred_service_id uuid
custom_return_interval_days integer
return_rule_mode text
average_return_days numeric
next_expected_return_at timestamptz
first_appointment_at timestamptz
last_appointment_at timestamptz
total_appointments integer default 0
total_spent numeric(12,2) default 0
average_ticket numeric(12,2) default 0
last_contact_at timestamptz
allow_whatsapp boolean default true
is_active boolean default true
created_at timestamptz
updated_at timestamptz
```

---

# 62. return_alerts

```sql
id uuid primary key
organization_id uuid not null
client_id uuid not null
appointment_id uuid
expected_return_at timestamptz
status text not null
snoozed_until timestamptz
contacted_at timestamptz
resolved_at timestamptz
resolution text
created_at timestamptz
updated_at timestamptz
```

---

# 63. RLS

Todas as tabelas de negócio devem validar associação ao tenant.

Exemplo conceitual:

```sql
organization_id IN (
  SELECT organization_id
  FROM organization_users
  WHERE user_id = auth.uid()
  AND is_active = true
)
```

Não confiar apenas em filtros da aplicação.

---

# 64. Índices Recomendados

Criar índices para:

```text
organization_id
client_id
professional_id
appointment_date
created_at
status
next_expected_return_at
expected_return_at
phone
whatsapp
```

Índices compostos importantes:

```text
(organization_id, appointment_date)
(organization_id, status)
(organization_id, next_expected_return_at)
(organization_id, client_id)
```

---

# 65. Auditoria

Tabelas importantes devem conter:

- created_at
- updated_at
- created_by quando aplicável

Financeiro e cancelamentos devem preservar rastreabilidade.

---

# 66. Regras de Cancelamento

Atendimento cancelado:

- não entra no faturamento;
- não entra na frequência;
- não gera comissão;
- não consome pacote.

Caso tenha sido concluído anteriormente, operação de estorno deve ser explícita.

---

# 67. Regras de Exclusão

Evitar deletar:

- atendimentos concluídos;
- transações financeiras;
- uso de pacotes.

Utilizar:

- cancelamento;
- inativação;
- soft delete.

---

# 68. Configurações de Retorno

Tela:

`Configurações > Retornos`

Campos:

- Frequência padrão.
- Quantidade mínima de atendimentos para média.
- Antecedência de alerta.
- Dias para cliente inativo.
- Criar alerta automático?
- Usar frequência manual como prioridade?
- Usar frequência do serviço?
- Considerar apenas serviços marcados?

Exemplo:

```text
Frequência padrão: 20 dias
Histórico mínimo: 3 atendimentos
Avisar: no dia do retorno
Cliente inativo: 60 dias
```

---

# 69. Job de Atualização de Alertas

Executar rotina recorrente.

Objetivos:

- identificar retornos previstos;
- atualizar próximos;
- atualizar atrasados;
- criar alertas ausentes;
- verificar pacotes;
- verificar clientes inativos.

Pode utilizar:

- Supabase Cron
- Edge Function
- Vercel Cron

---

# 70. Não Duplicar Alertas

Criar restrição lógica para impedir múltiplos alertas ativos do mesmo ciclo.

Exemplo:

um cliente não deve possuir cinco alertas idênticos para o mesmo retorno esperado.

---

# 71. Atualização Após Novo Atendimento

Quando cliente retorna:

1. localizar alerta ativo;
2. marcar como `returned`;
3. registrar resolução;
4. recalcular histórico;
5. calcular nova frequência;
6. definir próximo retorno;
7. criar novo ciclo.

---

# 72. Indicadores do Dashboard

## Hoje

```text
appointments_today
revenue_today
new_clients_today
average_ticket_today
```

## Retenção

```text
returns_due_today
returns_overdue
returns_next_7_days
contacts_today
```

## Mês

```text
revenue_month
expenses_month
profit_month
appointments_month
new_clients_month
```

---

# 73. UX do Dashboard

Não utilizar excesso de gráficos.

Priorizar:

- cards;
- listas;
- alertas acionáveis;
- atalhos.

O dashboard deve estimular ação.

Exemplo:

`7 clientes precisam de contato hoje`

Clicar abre diretamente a Central de Retornos filtrada.

---

# 74. Timeline do Cliente

Na ficha do cliente criar uma timeline:

```text
16/09
Corte
R$ 50
Profissional: João

01/09
Corte
R$ 50

17/08
Corte
R$ 45

02/08
Corte
R$ 45
```

Também incluir:

- contatos;
- compra de pacote;
- uso do pacote;
- observações.

---

# 75. Perfil do Cliente

Cabeçalho:

```text
João Silva
(75) 99999-9999

Último atendimento: 01/09
Frequência média: 15 dias
Próximo retorno: 16/09
Total gasto: R$ 850
Atendimentos: 18
Ticket médio: R$ 47,22
```

Ações:

- Novo atendimento
- WhatsApp
- Editar
- Ver pacote
- Registrar observação

---

# 76. Busca de Duplicidade

Ao cadastrar cliente:

verificar telefone e WhatsApp.

Se já existir:

mostrar aviso.

Evitar clientes duplicados.

---

# 77. Normalização de Telefone

Armazenar telefone normalizado.

Exemplo:

`5575999999999`

Exibir:

`(75) 99999-9999`

---

# 78. Configuração de Moeda

Inicial:

BRL

Mas arquitetura preparada para:

`currency`

---

# 79. MVP — Escopo da Versão 1

Prioridade absoluta:

## Autenticação

- Login
- Logout
- Recuperação de senha

## Organização

- Cadastro
- Identidade
- Configurações

## Clientes

- CRUD
- Busca
- Histórico

## Profissionais

- CRUD

## Serviços

- CRUD

## Atendimentos

- Novo atendimento
- Histórico
- Pagamentos

## Retornos

- Frequência
- Alertas
- WhatsApp

## Financeiro

- Receitas
- Despesas
- Resumo

## Pacotes

- Cadastro
- Venda
- Uso
- Saldo

## Relatórios básicos

- Atendimento
- Financeiro
- Clientes
- Retornos
- Pacotes

---

# 80. Itens Fora do MVP

Não implementar inicialmente, salvo necessidade:

- Agenda avançada.
- Reserva online.
- Pagamento online.
- WhatsApp API oficial.
- Emissão fiscal.
- Estoque complexo.
- Marketplace.
- Programa de pontos.
- Aplicativo nativo.
- Inteligência artificial.
- Assinatura SaaS automatizada.
- Multiunidades avançado.

A arquitetura pode ser preparada para evolução, mas o MVP deve permanecer simples.

---

# 81. Ordem de Implementação

## Fase 0 — Fundação

1. Next.js
2. Supabase
3. Auth
4. Banco
5. RLS
6. Multi-tenant
7. Layout
8. Design system

## Fase 1 — Cadastros

1. Organização
2. Usuários
3. Clientes
4. Profissionais
5. Serviços
6. Formas de pagamento

## Fase 2 — Atendimento

1. Novo atendimento
2. Serviços múltiplos
3. Pagamentos
4. Histórico
5. Timeline

## Fase 3 — Retenção

1. Frequência
2. Cálculo de média
3. Próximo retorno
4. Alertas
5. Central de retornos
6. Templates
7. WhatsApp
8. Histórico de contato

## Fase 4 — Financeiro

1. Receitas automáticas
2. Despesas
3. Categorias
4. Dashboard financeiro
5. Relatório financeiro

## Fase 5 — Pacotes

1. Cadastro
2. Venda
3. Uso
4. Saldo
5. Vencimento
6. Renovação

## Fase 6 — Relatórios

1. Atendimento
2. Clientes
3. Retenção
4. Serviços
5. Profissionais
6. Financeiro
7. Pacotes

---

# 82. Critérios de Aceite do MVP

O MVP estará funcional quando for possível:

1. Criar estabelecimento.
2. Fazer login.
3. Cadastrar cliente.
4. Cadastrar profissional.
5. Cadastrar serviço.
6. Registrar atendimento.
7. Registrar forma de pagamento.
8. Visualizar faturamento.
9. Consultar histórico do cliente.
10. Calcular frequência do cliente.
11. Exibir cliente para retorno.
12. Abrir WhatsApp com mensagem pronta.
13. Marcar cliente como contatado.
14. Registrar pacote.
15. Consumir pacote.
16. Ver saldo de pacote.
17. Registrar despesa.
18. Visualizar relatório básico.

---

# 83. Regras de Performance

- Paginação em listagens grandes.
- Busca server-side.
- Índices adequados.
- Evitar consultas N+1.
- Evitar recalcular histórico completo a cada render.
- Persistir estatísticas importantes quando necessário.
- Recalcular indicadores críticos após atendimento concluído.

---

# 84. Segurança

Obrigatório:

- RLS.
- Validação server-side.
- Verificação de tenant.
- Autenticação em todas as rotas privadas.
- Não confiar em `organization_id` enviado pelo frontend.
- Derivar organização autorizada a partir da sessão.
- Validar permissões no servidor.

---

# 85. Rotas Sugeridas

```text
/login
/forgot-password

/dashboard

/atendimentos
/atendimentos/novo
/atendimentos/[id]

/clientes
/clientes/novo
/clientes/[id]

/retornos

/pacotes
/pacotes/clientes

/financeiro
/financeiro/receitas
/financeiro/despesas

/relatorios
/relatorios/atendimentos
/relatorios/clientes
/relatorios/retencao
/relatorios/financeiro
/relatorios/pacotes

/cadastros/servicos
/cadastros/profissionais
/cadastros/formas-pagamento

/configuracoes
/configuracoes/estabelecimento
/configuracoes/identidade
/configuracoes/usuarios
/configuracoes/mensagens
/configuracoes/retornos
```

---

# 86. Componentes Importantes

```text
ClientSearch
ClientQuickCreate
NewAppointmentDrawer
ServiceSelector
ProfessionalSelector
PaymentSelector
ClientSummaryCard
ReturnAlertCard
WhatsAppButton
FinancialSummaryCards
PackageBalanceCard
ClientTimeline
DateRangeFilter
ReportFilters
OrganizationBranding
```

---

# 87. Estados Vazios

O sistema deve orientar usuário novo.

Exemplos:

## Sem clientes

`Você ainda não possui clientes cadastrados.`

Botão:

`Cadastrar primeiro cliente`

## Sem atendimentos

`Nenhum atendimento registrado hoje.`

Botão:

`Novo atendimento`

## Sem retornos

`Nenhum cliente precisa de contato hoje.`

---

# 88. Feedback Visual

Após operações:

- Cliente cadastrado.
- Atendimento concluído.
- Pagamento registrado.
- Mensagem preparada.
- Pacote consumido.
- Despesa cadastrada.

Utilizar toast discreto.

---

# 89. Confirmações Obrigatórias

Antes de:

- cancelar atendimento;
- excluir cadastro relevante;
- cancelar pacote;
- excluir transação manual;
- alterar pagamento concluído.

---

# 90. Futuras Evoluções

Arquitetura preparada para:

- Agenda.
- Booking online.
- Lembretes automáticos.
- WhatsApp Business API.
- Campanhas.
- CRM.
- Estoque.
- Produtos.
- Venda de produtos.
- Fidelidade.
- Cashback.
- Cupom.
- Comissão avançada.
- Múltiplas unidades.
- Metas.
- Assinatura SaaS.
- White-label.
- App mobile.
- Integração fiscal.

---

# 91. Diferencial Comercial

O Cabellos não deve ser vendido somente como controle de salão.

Posicionamento sugerido:

> Um sistema que organiza os atendimentos, controla o financeiro e ajuda o salão a trazer o cliente de volta no momento certo.

Principal valor:

`retenção`

O estabelecimento deixa de depender da memória para lembrar quando determinado cliente costuma retornar.

---

# 92. Métrica Estratégica

Criar futuramente:

## Clientes em ciclo de retorno

Quantidade de clientes com frequência identificada.

## Retornos previstos

Clientes previstos para determinado período.

## Recuperados

Clientes que receberam contato e voltaram.

## Receita recuperada

Valor gerado por clientes que retornaram depois de ação de reativação.

Esse pode se tornar um dos principais indicadores comerciais do sistema.

---

# 93. Diretriz para o Antigravity

Antes de iniciar a implementação:

1. Ler integralmente este blueprint.
2. Mapear entidades.
3. Criar arquitetura de banco.
4. Criar migrations.
5. Criar políticas RLS.
6. Criar tipos TypeScript.
7. Criar camada de acesso a dados.
8. Criar autenticação.
9. Criar tenant context.
10. Implementar módulos na ordem proposta.

Não implementar tudo de uma vez.

A cada fase:

- implementar;
- rodar TypeScript;
- rodar lint;
- rodar testes;
- validar RLS;
- validar isolamento de tenant;
- validar mobile;
- documentar alterações.

---

# 94. Regra Arquitetural Imutável

Toda entidade operacional pertence a uma organização.

Nenhum usuário deve acessar registros de outra organização.

A regra deve ser garantida no banco e no servidor.

Não depender exclusivamente da interface.

---

# 95. Primeira Entrega Recomendada ao Antigravity

Solicitar inicialmente:

## Sprint 1

Implementar somente:

- estrutura base Next.js;
- Supabase;
- migrations;
- autenticação;
- organizations;
- organization_users;
- RLS;
- layout;
- onboarding básico;
- clientes;
- profissionais;
- serviços.

Não iniciar financeiro, pacotes e relatórios antes de homologar a fundação multi-tenant.

---

# 96. Segunda Entrega

## Sprint 2

Implementar:

- atendimentos;
- appointment_services;
- pagamentos;
- conclusão de atendimento;
- histórico;
- timeline;
- atualização de métricas do cliente.

---

# 97. Terceira Entrega

## Sprint 3

Implementar:

- frequência;
- regra de prioridade;
- cálculo da média;
- next_expected_return_at;
- return_alerts;
- central de retornos;
- mensagens;
- deep link WhatsApp;
- histórico de contatos.

---

# 98. Quarta Entrega

## Sprint 4

Implementar:

- financeiro;
- pacotes;
- relatórios;
- dashboard consolidado.

---

# 99. Definition of Done por Feature

Uma feature somente é considerada concluída quando:

- UI implementada;
- validação server-side;
- isolamento tenant validado;
- RLS validada;
- loading;
- empty state;
- error state;
- mobile;
- TypeScript sem erros;
- lint sem erros;
- teste de fluxo principal;
- tratamento de permissões.

---

# 100. Resultado Esperado

Ao finalizar o MVP, um salão deverá conseguir operar o dia utilizando o sistema como sua ferramenta principal para:

- cadastrar clientes;
- registrar atendimentos;
- acompanhar faturamento;
- controlar pacotes;
- consultar histórico;
- identificar retornos;
- entrar em contato pelo WhatsApp;
- acompanhar o negócio por relatórios.

O Cabellos deve ser leve, simples e comercialmente replicável para múltiplos estabelecimentos.

---

# 101. Convenções de Nomenclatura do Projeto

## Produto

```text
Cabellos
```

## Nome interno do repositório

Sugestão:

```text
cabellos
```

ou:

```text
cabellos-app
```

## Banco / projeto Supabase

Sugestão:

```text
cabellos
```

## Domínios futuros possíveis

A disponibilidade deve ser verificada antes do registro.

Sugestões conceituais:

```text
cabellos.app
cabellos.com.br
usecabellos.com.br
cabellosgestao.com.br
```

## Título do sistema

Exemplo:

```text
Cabellos | Gestão para Salões e Barbearias
```

## Descrição curta

> Gestão de atendimentos, clientes, financeiro, pacotes e retornos em um só lugar.

## Regra de arquitetura

**Cabellos é o produto/plataforma.**

Cada salão, barbearia ou profissional cadastrado é um **tenant/organização** dentro do Cabellos.

Nunca utilizar o nome do primeiro cliente como nome estrutural do produto, banco, tabelas, rotas ou regras de negócio.
