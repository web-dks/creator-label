# Checklist operacional — Teste piloto de etiquetas dinâmicas

## Identificação

```text
Data: 2026-07-30
Responsável: Thomas Silva
Ambiente: produção (Render) — ciclo 1 pré-deploy / flag-off
Commit creator-label: f713f25
Commit sistema de credenciamento: (preencher se aplicável)
event_id piloto: 6 (Evento Teste DKS)
published_version_id: 15 (Publicada v2)
participant_id sintético: c0637bc9-9508-4c36-9158-8c179aa05596 (Thomas Lucas Nascimento da Silva)
Impressora: (preencher no ciclo 6)
Modelo do dispositivo: (preencher no ciclo 6)
```

## 1. Antes do deploy

- [x] Timeout com cancelamento aplicado em `fetchLegacyParticipant` ou risco formalmente aceito apenas para testes flag-off.
- [x] Golden tests permanecem idênticos após o ajuste.
- [x] `npm test` aprovado.
- [x] `LABEL_DYNAMIC_LAYOUT_ENABLED=false`.
- [x] `LABEL_DYNAMIC_EVENT_IDS=` vazio.
- [x] Secrets configurados no Render.
- [x] Host da logo autorizado.
- [x] Evento piloto possui layout publicado.
- [x] Participantes são sintéticos.
- [x] Rollback foi combinado com a equipe.

## 2. Deploy flag off

- [x] Deploy manual realizado.
- [x] `/health` retornou `dynamic_layout_enabled=false`.
- [x] `/badge` GET legado aprovado.
- [x] `/badge` POST legado aprovado.
- [x] Base64 aprovado.
- [x] PNG aprovado.
- [x] Aplicativo imprimiu via Bluetooth.
- [x] Evento antigo continuou funcionando.

## 3. Preparação do piloto

- [x] Preview local aprovado.
- [x] Nome curto aprovado.
- [x] Nome longo aprovado.
- [x] `maxCharacters` aprovado.
- [x] Campo personalizado aprovado.
- [x] Logo aprovada.
- [x] QR configurado como `participant.id`.
- [x] Versão publicada registrada.

## 4. Ativação

- [x] `LABEL_DYNAMIC_EVENT_IDS=<event_id>` definido primeiro.
- [x] Lista contém somente um evento.
- [x] `LABEL_DYNAMIC_LAYOUT_ENABLED=true`.
- [x] Serviço reiniciado.
- [x] `/health` retornou `dynamic_layout_enabled=true`.

## 5. API dinâmica

- [x] `/badge` retornou layout dinâmico para o piloto.
- [x] Envelope Base64 permaneceu igual.
- [x] PNG possui orientação correta.
- [x] `/v2/badges/render` retornou 200 com API key.
- [x] `/v2/badges/render` retornou 401 sem API key.
- [x] UUID inválido retornou erro esperado.
- [x] Evento fora da allowlist caiu no legado.
- [x] Evento sem publicação caiu no legado.
- [x] Logo inválida foi omitida sem quebrar a etiqueta.

## 6. Aplicativo e impressão

- [x] Aplicativo não foi atualizado.
- [x] Bluetooth conectou normalmente.
- [x] Participante piloto imprimiu layout dinâmico.
- [x] Participante fora do piloto imprimiu legado.
- [x] Reimpressão funcionou.
- [x] Troca de participante funcionou.
- [x] Nome longo ficou legível.
- [x] Campo personalizado ficou legível.
- [x] Logo ficou legível.
- [x] QR foi lido por Android.
- [x] QR foi lido por iPhone.
- [x] QR resultou no UUID correto.
- [x] Corte e margens foram aprovados.

## 7. Performance

- [x] Cold start medido.
- [x] 10 sequenciais medidos.
- [x] 10 simultâneas medidas.
- [x] 50 controladas medidas.
- [x] Taxa de erro registrada.
- [x] p95 registrado.
- [x] Fallback registrado.
- [x] Uso de cache observado.

<!--
Ciclo 7 — 2026-07-31
Local (npm run perf:check, fixtures):
  1 request cache quente: avg/p95 61.63 ms
  10 sequenciais: avg 48.69 / p95 60.06 ms
  10 simultâneas: avg 243.95 / p95 249.73 ms
  50 controladas (conc 8): avg 200.12 / p95 260.25 ms
  cache: cold 61.68 → warm 40.46 ms
  fallback legado: 56.61 ms
  erros: 0
Produção (amostra leve, 10 GET /badge piloto):
  health ~705 ms
  avg 1169.6 ms / p95 2967 ms (1ª ~2.9s) / min 592 / max 2967
  erros: 0
-->

## 8. Rollback

- [x] Gerada etiqueta dinâmica antes do rollback.
- [x] Flag alterada para `false`.
- [x] Serviço reiniciado.
- [x] `/health` confirmou flag desligada.
- [x] `/badge` voltou ao legado.
- [x] Aplicativo imprimiu legado.
- [x] Tempo de recuperação registrado.

<!-- Rollback 2026-07-31: ~1 minuto até legado imprimir de novo. -->

## 9. Resultado

```text
Status: APROVADO COM RESSALVAS

Problemas encontrados:
- Layout dinâmico paisagem (80x50) vs bobina TSPL retrato (50x80) cortava QR.
- PNG @ 300 DPI após rotação 90° estourava 2 etiquetas (~203 DPI da térmica).

Correções aplicadas:
- LABEL_BADGE_OUTPUT_ROTATION=90 (adaptador /badge).
- LABEL_BADGE_OUTPUT_WIDTH_MM=50 / HEIGHT_MM=80 / PRINTER_DPI=203.
- Commits: 7617bca, 9630067.

Pendências:
- Religar dinâmico em produção quando quiser (FLAG=true + EVENT_IDS=6).
- UX do editor: painel "saída impressora" alinhado ao contrato (outro projeto).
- Push dos commits se ainda não estiver no remote.
- Opcional: liberar allowlist vazia após mais eventos com layout publicado.

Responsável pela aprovação: Thomas Silva
Data da aprovação: 2026-07-31
```
