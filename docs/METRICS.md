# Cabellos — Dicionário Oficial de Métricas e Inteligência Gerencial

Este documento especifica a metodologia determinística de cálculo, fontes de dados, regras de negócio, filtros, exclusões, permissões e tratamentos para amostras insuficientes de cada indicador gerencial do **Cabellos**.

---

## 1. Regras Globais de Inteligência e Leitura

1. **Camada de Leitura Não-Duplicada**: Nenhuma métrica duplica registros das tabelas transacionais existentes (`appointments`, `appointment_services`, `financial_transactions`, `clients`, `packages`, `client_packages`, `package_usages`, `accounts_receivable`, `accounts_payable`, `commissions`, etc.).
2. **Isolamento Multi-Tenant**: O `organization_id` é resolvido exclusivamente pela sessão autenticada (`auth.uid()`) e validado nas RPCs `SECURITY DEFINER`.
3. **Data e Timezone Local**: Todas as comparações diárias, semanais e mensais respeitam `organizations.timezone` (default: `America/Sao_Paulo`).
4. **Resoluções de Período**:
   - `start_date`: Início do período (inclusivo, 00:00:00 no timezone local).
   - `end_date`: Fim do período (inclusivo, 23:59:59 no timezone local).
   - Intervalo máximo por requisição detalhada: 24 meses.
5. **Período Anterior Equivalente**:
   - Intervalo de $N$ dias no período atual tem como comparação o intervalo imediatamente anterior de $N$ dias consecutivos (ex: `01/09` a `30/09` [30 dias] $\rightarrow$ comparação: `02/08` a `31/08` [30 dias]).
6. **Variação Percentual Segura**:
   - Se `anterior > 0`: `(atual - anterior) / anterior * 100` (exibe Ex: `+11.11%` ou `-5.00%`).
   - Se `anterior = 0` e `atual = 0`: exibe `— / Sem variação calculável`.
   - Se `anterior = 0` e `atual > 0`: exibe `Novo no período` (nunca `+100%` nem `Infinity`).

---

## 2. Visão Executiva

### Produção Operacional
- **Descrição**: Mede o valor comercial líquido total dos serviços concluídos no período.
- **Fórmula**: $\sum (\text{appointment\_services.total})$
- **Data Utilizada**: `appointments.finished_at`
- **Filtros e Condições**: `appointments.status = 'completed'`
- **Inclusões/Exclusões**: Inclui serviços pagos diretamente e serviços cobertos por plano/pacote. Exclui agendamentos `cancelled`, `no_show`, `draft`, `scheduled`, `in_progress`.
- **Permissão**: Admin, Owner, Receptionist, Professional (somente própria).

### Recebimentos
- **Descrição**: Soma de todas as entradas financeiras válidas efetivamente recebidas pelo estabelecimento no período.
- **Fórmula**: $\sum (\text{financial\_transactions.amount})$ onde `type = 'income'`
- **Data Utilizada**: `financial_transactions.transaction_date`
- **Inclusões/Exclusões**: Exclui transações anuladas (`voided_at IS NOT NULL`). Uso de pacote NÃO gera recebimento.
- **Permissão**: Admin, Owner.

### Despesas Pagas
- **Descrição**: Soma de todas as saídas financeiras operacionais válidas pagas no período.
- **Fórmula**: $\sum (\text{financial\_transactions.amount})$ onde `type = 'expense'`
- **Data Utilizada**: `financial_transactions.transaction_date`
- **Inclusões/Exclusões**: Exclui transações anuladas (`voided_at IS NOT NULL`). Sangrias de caixa não alteram a DRE de despesas.
- **Permissão**: Admin, Owner.

### Resultado de Caixa
- **Descrição**: Saldo financeiro obtido no período através da diferença entre entradas e saídas operacionais pagas.
- **Fórmula**: $\text{Recebimentos} - \text{Despesas Pagas}$
- **Nomenclatura Obrigatória**: "Resultado de Caixa". Proibido utilizar termos contábeis como "Lucro" ou "Lucro Líquido".
- **Permissão**: Admin, Owner.

### Ticket Médio Operacional
- **Descrição**: Valor comercial médio produzido por cada atendimento concluído.
- **Fórmula**: $\frac{\text{Produção Operacional}}{\text{Quantidade de Atendimentos Concluídos}}$
- **Data Utilizada**: `appointments.finished_at`
- **Comportamento Sem Base**: Se atendimentos $= 0$, exibe `R$ 0,00`.
- **Permissão**: Admin, Owner, Receptionist, Professional (somente próprio).

---

## 3. Clientes & Retenção

### Clientes Atendidos
- **Descrição**: Quantidade de clientes únicos que tiveram pelo menos um atendimento concluído no período.
- **Fórmula**: $\text{COUNT(DISTINCT client\_id)}$ em agendamentos com `status = 'completed'`.
- **Data Utilizada**: `appointments.finished_at`
- **Permissão**: Admin, Owner, Receptionist.

### Novos Clientes
- **Descrição**: Clientes atendidos no período cujo primeiro atendimento histórico na organização ocorreu no período selecionado.
- **Fórmula**: $\text{COUNT(DISTINCT client\_id)}$ onde `clients.first_appointment_at` $\in [\text{start\_date}, \text{end\_date}]$.
- **Observação Metodológica**: Não utiliza `clients.created_at`, pois cadastros sem atendimentos concluídos não representam novos clientes efetivamente atendidos.
- **Permissão**: Admin, Owner, Receptionist.

### Clientes Recorrentes
- **Descrição**: Clientes atendidos no período que possuíam pelo menos um atendimento concluído prévio em data anterior ao início do período.
- **Fórmula**: $\text{COUNT(DISTINCT client\_id)}$ atendidos em $T_{atual}$ com histórico em $T < \text{start\_date}$.
- **Permissão**: Admin, Owner, Receptionist.

### Taxa de Recorrência
- **Descrição**: Percentual de clientes atendidos no período que já eram clientes do estabelecimento.
- **Fórmula**: $\frac{\text{Clientes Recorrentes no Período}}{\text{Clientes Atendidos no Período}} \times 100$
- **Nomenclatura Obrigatória**: "Taxa de Recorrência". Não chamar de Taxa de Retenção.
- **Comportamento Sem Base**: Se clientes atendidos $= 0$, exibe `— / Sem base suficiente`.
- **Permissão**: Admin, Owner, Receptionist.

### Conversão da Central de Retornos
- **Descrição**: Percentual de alertas da Central de Retornos cujo ciclo foi encerrado com o retorno do cliente no período.
- **Fórmula**: $\frac{\text{Alertas com status = 'returned'}}{\text{Alertas com ciclo encerrado no período (returned, expired, cancelled)}} \times 100$
- **Data Utilizada**: `return_alerts.updated_at`
- **Exclusões**: Alertas com ciclo em andamento (`upcoming`, `due`, `overdue`, `snoozed`).
- **Comportamento Sem Base**: Se alertas encerrados $= 0$, exibe `— / Sem base suficiente`.
- **Permissão**: Admin, Owner, Receptionist.

### Clientes Inativos
- **Descrição**: Clientes da base com histórico de atendimento cujo último atendimento foi realizado há mais de $N$ dias (`organizations.inactive_client_days`, padrão 30 dias).
- **Fórmula**: `NOW() - clients.last_appointment_at > inactive_client_days`
- **Exclusões**: Cadastros de clientes que nunca realizaram nenhum atendimento.
- **Permissão**: Admin, Owner, Receptionist.

### Clientes Atrasados
- **Descrição**: Lista de clientes com alertas de retorno pendentes com prazo vencido.
- **Condição**: `return_alerts.status = 'overdue'`
- **Permissão**: Admin, Owner, Receptionist.

---

## 4. Serviços e Profissionais

### Produção por Serviço
- **Descrição**: Agregação de valor comercial produzido por cada tipo de serviço em atendimentos concluídos.
- **Fórmula**: $\sum (\text{appointment\_services.total})$ agrupado por `service_id`.
- **Separador de Origem**: Exibe o detalhamento de valor coberto por pacote/plano vs cobrado diretamente.
- **Permissão**: Admin, Owner, Receptionist.

### Produção por Profissional
- **Descrição**: Valor comercial total dos serviços executados por cada profissional.
- **Fórmula**: $\sum (\text{appointment\_services.total})$ agrupado por `appointment_services.professional_id`.
- **Observação Crítica**: Utiliza `appointment_services.professional_id` do item do serviço (e não apenas `appointments.professional_id` do cabeçalho do atendimento).
- **Permissão**: Admin, Owner, Receptionist, Professional (somente dados próprios).

### Comissões por Profissional
- **Descrição**: Valor de comissão gerado a partir de atendimentos executados.
- **Fontes**: Snapshots históricos em `commission_items`, `commissions` e `appointment_services.commission_amount`.
- **Detalhamento**: Apresenta separadamente os status `calculada`, `aprovada` e `paga`.
- **Permissão**: Admin, Owner, Professional (somente própria).

---

## 5. Pacotes e Planos

### Taxa de Renovação de Planos
- **Descrição**: Percentual de contratos elegíveis para renovação que foram renovados pelo cliente.
- **Denominador**: Contratos com `status IN ('expired', 'completed')` cujo encerramento ocorreu no período.
- **Numerador**: Contratos do denominador que geraram novo contrato com `renewed_from_client_package_id = contrato_original.id` em até 30 dias.
- **Fórmula**: $\frac{\text{Numerador}}{\text{Denominador}} \times 100$
- **Comportamento Sem Base**: Se denominador $= 0$, exibe `— / Sem base suficiente`.
- **Permissão**: Admin, Owner, Receptionist.

### Relação Receita x Consumo (Planos Ilimitados)
- **Descrição**: Comparativo entre a receita obtida na venda do plano ilimitado e o valor comercial dos serviços consumidos.
- **Fórmula**: $\text{Valor Recebido na Venda do Plano} - \text{Soma do Valor Comercial dos Serviços Consumidos}$
- **Nomenclatura Obrigatória**: "Relação Receita x Consumo" (Não chamar de Lucro ou Margem).
- **Permissão**: Admin, Owner.

---

## 6. Financeiro Avançado, Aging e Auditoria

### Aging de Contas a Receber
- **Descrição**: Classificação dos títulos em aberto por faixa de vencimento/atraso em relação a `CURRENT_DATE`.
- **Faixas**: `A vencer`, `1–7 dias`, `8–15 dias`, `16–30 dias`, `31–60 dias`, `60+ dias`.
- **Filtro**: `accounts_receivable.remaining_amount > 0` e `status IN ('pending', 'partial')`.
- **Permissão**: Admin, Owner.

### Percentual da Carteira Vencida
- **Descrição**: Proporção do saldo total a receber em aberto que já ultrapassou a data de vencimento.
- **Fórmula**: $\frac{\text{Saldo Vencido em Aberto}}{\text{Saldo Total em Aberto}} \times 100$
- **Comportamento Sem Base**: Se Saldo Total em Aberto $= 0$, exibe `— / Sem carteira em aberto`.
- **Permissão**: Admin, Owner.

### Auditoria de Transações
- **Descrição**: Registro e rastreabilidade de todas as movimentações financeiras criadas e anuladas.
- **Exibições**: Permite filtrar transações `válidas` e `anuladas` (com exibição de `voided_by`, `void_reason` e timestamp).
- **Permissão**: Exclusivo Admin e Owner.
