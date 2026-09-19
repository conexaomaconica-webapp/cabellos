# Metodologia de Métricas Globais SaaS (Módulo Master)

Este documento descreve as fórmulas e definições oficiais dos indicadores gerenciais apresentados no dashboard do **Módulo Master — Administração Global do Cabellos**.

---

## 1. MRR (Monthly Recurring Revenue / Receita Mensal Recorrente)

### Definição
Soma do valor contratado (`price_snapshot`) de todas as assinaturas SaaS com status **`active`**.

### Fórmula
$$MRR = \sum_{\text{status} = \text{'active'}} \text{price\_snapshot}$$

### Regras
- Inclui apenas assinaturas recorrentes ativas pagas pelos salões ao Cabellos.
- **NÃO inclui** faturamento operacional dos salões (atendimentos, venda de pacotes ou serviços para os clientes finais).
- Assinaturas em `trial`, `suspended` ou `cancelled` são excluídas do cálculo do MRR.

---

## 2. ARR (Annual Recurring Revenue / Receita Anual Recorrente)

### Definição
Projeção anual da receita recorrente da plataforma com base no MRR atual.

### Fórmula
$$ARR = MRR \times 12$$

---

## 3. Salões Ativos vs. Trials vs. Suspensos

- **Salões Ativos:** Contagem de organizações com `organizations.status = 'active'`.
- **Salões em Trial:** Contagem de assinaturas com `organization_subscriptions.status = 'trial'`.
- **Salões Suspensos:** Contagem de organizações com `organizations.status = 'suspended'`.

---

## 4. Taxa de Churn de Tenants (MVP)

### Definição
Percentual de salões que cancelaram a assinatura durante o período analisado.

### Fórmula
$$\text{Churn Rate} = \left( \frac{\text{Salões Cancelados no Período}}{\text{Salões Ativos no Início do Período}} \right) \times 100$$
