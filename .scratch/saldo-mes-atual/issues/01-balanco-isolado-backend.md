# 01: Balanço isolado do ciclo no backend (sem sobra)

**What to build:** o saldo final de cada ciclo passa a ser salário + horas extras líquidas − despesas, sem herdar nada de meses anteriores. A sobra deixa de existir na API de resumo mensal e na mensagem de resumo do WhatsApp. Meses futuros e anteriores ao início do sistema continuam com saldo zerado.

**Blocked by:** None (can start immediately).

**Status:** completed

- [x] Teste do serviço financeiro (Mockito) falha antes e passa depois: resumo anterior com saldo positivo não altera o saldo atual.
- [x] Teste: saldo negativo é retornado sem truncar.
- [x] Teste: mês futuro/pré-abril-2026 continua zerado.
- [x] Busca do saldo do mês anterior removida do cálculo.
- [x] Campo de sobra removido da entidade de resumo mensal (coluna do banco permanece, sem migração).
- [x] Mensagem de resumo do WhatsApp sem linha "Sobra do mês ant." e com argumentos de formatação corretos.
- [x] Backend compila (`mvn -q compile`) e testes passam.
