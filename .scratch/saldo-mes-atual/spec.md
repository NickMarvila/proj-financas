# Spec: Saldo financeiro isolado do mês atual (sem sobra do mês anterior)

**Status:** ready-for-agent

## Problem Statement

Hoje o saldo financeiro do ciclo soma a "sobra do mês anterior" (saldo final positivo do mês passado). Com isso o Dashboard, o Histórico e o resumo do WhatsApp mostram um valor que mistura dois meses. O usuário quer ver **apenas o balanço do ciclo atual**: salário + horas extras líquidas − despesas, sem herdar nada de meses anteriores.

## Solution

O saldo de cada ciclo passa a ser calculado de forma isolada. Nenhum valor de mês anterior entra no cálculo, e a "sobra" deixa de existir no produto: não aparece no Dashboard, no Histórico, na API nem na mensagem de resumo do WhatsApp. Todas as demais regras (ciclo 21–20, regra de sábados, despesas, horas extras) permanecem intactas.

## User Stories

1. Como usuário, quero que o Saldo Projetado do Dashboard seja salário + extras líquidas − despesas do ciclo, para saber exatamente como está o mês corrente.
2. Como usuário, quero que o saldo de um mês não dependa do que sobrou no anterior, para que cada ciclo seja comparável.
3. Como usuário, quero que o banner "Sobra do mês anterior" desapareça do Dashboard, para não ver informação que não faz mais parte do saldo.
4. Como usuário, quero que a linha "Sobra Anterior" suma do detalhamento financeiro, para que a conta mostrada feche com o Saldo Final Projetado.
5. Como usuário, quero que o card "Saldo Projetado" descreva a fórmula correta (salário + extras − despesas), refletindo o que de fato é calculado.
6. Como usuário, quero que o Histórico mostre cada mês com seu próprio saldo, sem a etiqueta "sobra do mês anterior".
7. Como usuário, quero navegar entre meses no Dashboard e ver sempre o balanço isolado daquele ciclo.
8. Como usuário, quero que meses passados já gravados sejam exibidos recalculados sem sobra, para que o histórico seja consistente com a nova regra.
9. Como usuário, quero que o resumo diário/semanal do WhatsApp não traga a linha "Sobra do mês ant.", e que o "Saldo projetado" enviado seja o do ciclo atual.
10. Como usuário, quero ver o saldo negativo normalmente quando despesas superarem salário + extras, sem que isso afete o mês seguinte.
11. Como usuário, quero que um saldo positivo num mês não infle o saldo do mês seguinte, para não criar uma falsa sensação de folga.
12. Como usuário, quero que meses futuros e anteriores ao início do sistema (abril/2026) continuem exibindo saldo zerado, como hoje.
13. Como usuário, quero que as regras de sábados (compensação, faltas) e de horas extras continuem funcionando idênticas, para que a mudança não altere o cálculo de extras.
14. Como usuário multi-tenant, quero que a mudança valha para todos os usuários, sem afetar o isolamento de dados entre eles.
15. Como mantenedor, quero que a API de resumo mensal deixe de expor o campo de sobra, para que clientes não dependam de um conceito removido.
16. Como mantenedor, quero um teste automatizado que garanta que o saldo ignora meses anteriores, para evitar regressão.
17. Como mantenedor, quero não executar migração destrutiva no banco, para reduzir risco em produção.

## Implementation Decisions

- Escopo cirúrgico: remover **apenas** a sobra; o restante do serviço financeiro, do ciclo e das regras de sábado não muda.
- O saldo final do ciclo = salário base + pagamento de horas extras líquidas − total de despesas ativas do ciclo.
- A consulta/lógica que busca o saldo do mês anterior é removida do serviço financeiro.
- O resumo mensal continua sendo recalculado e persistido a cada consulta (comportamento atual); portanto os meses passados são naturalmente regravados sem sobra. Não há preservação de valores históricos antigos, nem para meses marcados como fechados.
- O campo de sobra é removido do modelo exposto pela API (entidade de resumo mensal e tipo do frontend). A coluna `carried_over` **permanece** no banco (sem migração destrutiva, schema gerenciado por `ddl-auto=update`); como é anulável, remover o campo da entidade não quebra inserts.
- O branch de resumo para meses futuros/pré-sistema deixa de preencher sobra; segue retornando saldo zerado.
- Dashboard: remover o banner de sobra e a linha "Sobra Anterior" do detalhamento; o subtítulo do card de Saldo Projetado permanece "salário + extras − despesas" (agora fiel à conta).
- Histórico: remover a etiqueta "sobra do mês anterior".
- Mensagem de resumo do WhatsApp: remover a linha de sobra e o argumento de formatação correspondente.
- Saldo negativo é exibido normalmente, sem tratamento especial e sem efeito no mês seguinte.
- Estilos CSS do banner de sobra podem ser removidos se ficarem sem uso.

## Testing Decisions

- Um bom teste exercita comportamento externo: dado o estado dos repositórios, o resumo retornado tem o saldo esperado. Não testa detalhes internos nem chamadas específicas.
- Seam único (novo, no ponto mais alto possível): o resumo do mês do serviço financeiro, com repositórios mockados (Mockito), conforme confirmado com o usuário.
- Casos: (a) existe resumo anterior com saldo positivo → saldo atual não o inclui; (b) saldo negativo é retornado sem truncar; (c) mês futuro/pré-início continua zerado.
- Prior art: testes unitários existentes em `backend/src/test/java/.../utils` (JUnit sem Spring context). Não há testes de serviço hoje; este será o primeiro.
- Frontend: verificação de tipos/build (`tsc`/build) e conferência visual manual; sem testes automatizados de UI.

## Out of Scope

- Remover a coluna `carried_over` do banco / migração destrutiva.
- Reescrever a regra de ciclo, de sábados, de horas extras ou de despesas.
- Redesenho visual do Dashboard financeiro.
- Fechamento de mês (`closed`) ou qualquer novo conceito de poupança/acumulado.

## Further Notes

- Há trabalho anterior em `.scratch/sabados-horario-normal` que mexeu no mesmo serviço financeiro; manter o comportamento de sábados intacto.
- O histórico de saldos gravados será sobrescrito na primeira consulta de cada mês; isso é esperado.
