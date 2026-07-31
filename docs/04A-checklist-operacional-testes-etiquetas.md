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

- [ ] Aplicativo não foi atualizado.
- [ ] Bluetooth conectou normalmente.
- [ ] Participante piloto imprimiu layout dinâmico.
- [ ] Participante fora do piloto imprimiu legado.
- [ ] Reimpressão funcionou.
- [ ] Troca de participante funcionou.
- [ ] Nome longo ficou legível.
- [ ] Campo personalizado ficou legível.
- [ ] Logo ficou legível.
- [ ] QR foi lido por Android.
- [ ] QR foi lido por iPhone.
- [ ] QR resultou no UUID correto.
- [ ] Corte e margens foram aprovados.

## 7. Performance

- [ ] Cold start medido.
- [ ] 10 sequenciais medidos.
- [ ] 10 simultâneas medidas.
- [ ] 50 controladas medidas.
- [ ] Taxa de erro registrada.
- [ ] p95 registrado.
- [ ] Fallback registrado.
- [ ] Uso de cache observado.

## 8. Rollback

- [ ] Gerada etiqueta dinâmica antes do rollback.
- [ ] Flag alterada para `false`.
- [ ] Serviço reiniciado.
- [ ] `/health` confirmou flag desligada.
- [ ] `/badge` voltou ao legado.
- [ ] Aplicativo imprimiu legado.
- [ ] Tempo de recuperação registrado.

## 9. Resultado

```text
Status: APROVADO / APROVADO COM RESSALVAS / REPROVADO

Problemas encontrados:

Correções aplicadas:

Pendências:

Responsável pela aprovação:
Data da aprovação:
```
