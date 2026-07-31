# Validação — Motor dinâmico de etiquetas (Fase 3, `creator-label`)

Este documento consolida as evidências dos gates obrigatórios definidos em
`docs/plano-motor-dinamico-etiquetas.md` §8 e do checklist de aceite da
Spec 03 atualizada §26, ao final da implementação task por task (Tasks
0–10). É o entregável "docs/validacao-motor-dinamico-etiquetas.md" listado
em `docs/03-spec-creator-label-motor-dinamico-atualizada.md` §25.

Estado no momento desta validação:

- Branch: `main`, commit `3b38ae6` (HEAD).
- `LABEL_DYNAMIC_LAYOUT_ENABLED=false` em `.env.example` e `render.yaml`
  (nenhum evento habilitado em produção).
- Suíte de testes: **144/144 passando**, 100% via `node --test`.

---

## 1. Gate — Baseline legado capturado (Task 1)

Hashes SHA-256 do PNG final de cada caso golden, gravados em
`golden/manifest.json` (Node `v22.14.0`, `@napi-rs/canvas@0.1.100`,
fonte `arial.ttf`, capturados **antes** de qualquer refatoração de
`index.js`, commit `ae1422b`):

| Caso | `pngSha256` | Bytes |
|---|---|---|
| `nome-curto-png` | `a22baaf081822a5f15f849deb84c8a7b07b0dbd2db8b97553fc6a74cd3afd0b6` | 8 679 |
| `nome-medio-duas-linhas-png` | `4781f9915ff072a5de5aeb76f7b9cf72641e8011ccd6bbaf3b6ff517d141fb2b` | 24 067 |
| `nome-longo-png` | `c92a2e5b568122d60c2450db04b9a5f9222e084298a6ea48c7e536622efc0c95` | 33 245 |
| `regra-cps-com-subtitulo-png` | `f7f4802626f1637a691b1613c41eb75692efd4b4138c666775a9bd307a724cbd` | 28 994 |
| `duas-linhas-sem-qr-base64` | `e7ff14f69bc200502350c507fa01e173c108dc62a6b2ce2a48b069a29ca30bbe` | 28 840 |
| `sem-qr-nome-literal-png` | `25564e78053e0794488e851d60af63d9abfa1b9b460a12ec05d1f5e165ece165` | 19 346 |
| `base64-nome-curto` | `a22baaf081822a5f15f849deb84c8a7b07b0dbd2db8b97553fc6a74cd3afd0b6` | 8 679 |
| `aliases-max-line-rotate` | `2679a54ff5e0d8b7baa1ad01b927d12a969c5e4b6393bf54d7f72d19b761c9d0` | 25 482 |

Fonte completa: `golden/manifest.json`. Fixtures 100% locais/sintéticas
(`tests/fixtures/participants.json` + `tests/fakes/fakePostgrestServer.js`),
sem qualquer chamada ao Supabase real (ajuste 2 e 3).

## 2. Gate — Golden tests idênticos após modularização (Task 3)

`index.js` foi extraído para `src/` no commit `f74ac58`
("refactor: split creator-label into modular src layout"). O teste
`tests/legacy-contract.test.js` roda o `index.js` real (agora um thin
entry point) contra o mesmo `fakePostgrestServer`, recalcula o SHA-256 de
cada PNG gerado e:

1. Compara pixel a pixel (`scripts/compare-golden.js`, RGBA) contra o PNG
   gravado em `golden/*.png`;
2. Confere que `sha256(actualPng) === manifest.cases[nome].pngSha256`.

Isso roda a cada `npm test` (não é um teste único e descartável) — qualquer
regressão de pixel no renderer legado quebra a suíte imediatamente, mesmo
depois da modularização, do hardening de segurança e da adição do motor
dinâmico. Resultado atual: **8/8 casos golden idênticos, GET e POST
byte-a-byte iguais**, headers e envelope Base64 preservados.

## 3. Gate — Suíte completa antes do deploy (Tasks 5–9)

```text
node --test
# tests 144
# suites 0
# pass 144
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

Cobertura por área (arquivo → o que valida):

| Arquivo | Cobertura |
|---|---|
| `tests/legacy-contract.test.js` | Contrato `/badge` (GET/POST, aliases, Base64, PNG, filename, nome ausente, participante inexistente, Supabase indisponível, DPI inválido) |
| `tests/repositories.test.js` | `fetchParticipantContext`/RPCs: UUID válido, inexistente, `event_id` nulo, erro genérico Supabase, timeout de 2 s, cache |
| `tests/badgeService.test.js` | Orquestração `/badge`: flag off, UUID inválido, service role ausente, sucesso, fallback (participante, allowlist, layout ausente) |
| `tests/layoutContractValidator.test.js` | Contrato do layout publicado (schema, dimensões, `print_profile` homologado) |
| `tests/dataResolver.test.js`, `tests/textRenderer.test.js`, `tests/qrRenderer.test.js`, `tests/dynamicLabelRenderer.test.js` | Dinâmico: nome, categoria, evento, custom field, texto estático, fallback, `maxCharacters`, `wrap`/`shrink`/`truncate`/`hide`, QR L/M/Q/H, logo, logo indisponível, elemento oculto |
| `tests/badgeRouteDynamic.test.js`, `tests/badgeRouteV2.test.js` | Ponta a ponta HTTP das rotas `/badge` (dinâmico + fallback) e `/v2/badges/render` |
| `tests/ipSafety.test.js`, `tests/imageService.test.js` | SSRF: IP privado, redirect, MIME falso, tamanho e dimensão excessivos |
| `tests/security.test.js`, `tests/rateLimitEnforcement.test.js` | Helmet, CORS, payload grande (413), JSON malformado (400), excesso de chamadas (429) |
| `tests/apiKeyAuth.test.js`, `tests/timingSafeEqual.test.js`, `tests/requestValidator.test.js` | Rota v2 protegida (Bearer timing-safe, payload) |
| `tests/logsNoPii.test.js` | Logs de `/badge` e `/v2/badges/render` nunca contêm nome, custom field, UUID completo ou `LABEL_API_KEY` |
| `tests/health.test.js` | Health check reporta flag e versão |

## 4. Performance (`docs/03-spec-creator-label-motor-dinamico-atualizada.md` §23)

Medido com `npm run perf:check` (`scripts/perf-check.js`), que sobe
`src/app.js` real em processo contra um Supabase dinâmico fake local (sem
rede real) — números indicativos do ambiente local de desenvolvimento, não
um SLA de produção. Relatório completo em `docs/perf-results.json`.

| Cenário | Média (ms) | p95 (ms) | Mín/Máx (ms) | Resposta média |
|---|---|---|---|---|
| 1 request (cache quente) | 64.99 | 64.99 | 64.99 / 64.99 | 17 127 bytes |
| 10 sequenciais | 50.56 | 56.53 | 45.82 / 56.53 | 17 127 bytes |
| 10 simultâneas | 169.29 | 212.20 | 133.65 / 212.20 | 17 127 bytes |
| 50 controladas (concorrência 8) | 116.32 | 152.43 | 82.57 / 158.60 | 17 127 bytes |

Recursos do processo (RSS/CPU do processo Node único que hospeda a app
durante os 4 cenários acima, ~71 requests):

- RSS: 99.7 MB → 121.4 MB; heap usado ao final: 18.1 MB.
- CPU: ~4.14 s de tempo de usuário / 0.06 s de sistema.

Cache (`event_id → layout publicado`): 47.83 ms (cache limpo, com RPC) vs.
46.92 ms (cache quente) neste ambiente local — a diferença real em
produção tende a ser maior, pois o Supabase fake local não tem latência de
rede; o objetivo do cache é eliminar exatamente esse round-trip de rede
por requisição em produção.

Fallback: uma requisição para evento sem layout publicado (dinâmico →
fallback → renderer legado) levou 54.38 ms, próximo do caminho 100%
dinâmico (64.99 ms) — o fallback não introduz penalidade relevante.

## 5. Segurança (§23 "Segurança")

| Item | Como é coberto |
|---|---|
| URL privada (SSRF) | `tests/ipSafety.test.js`, `tests/imageService.test.js` — IPv4/IPv6 privado, loopback, link-local, `::ffff:`-mapeado, host fora da allowlist |
| Redirect de imagem | `tests/imageService.test.js` — no máximo 1 redirect, `Location` ausente falha |
| Payload grande | `tests/security.test.js` — corpo > 100 kb → 413 JSON |
| DPI inválido | `tests/legacy-contract.test.js` — DPI fora de faixa, negativo ou não numérico é sempre clampado ([72, 1200]), nunca derruba a rota |
| Rota v2 sem API key | `tests/apiKeyAuth.test.js`, `tests/badgeRouteV2.test.js` — 401 fail-closed mesmo sem `LABEL_API_KEY` configurada |
| Excesso de chamadas | `tests/rateLimitEnforcement.test.js` — 429 JSON ao ultrapassar `LABEL_RATE_LIMIT_MAX` |
| Logs sem PII | `tests/logsNoPii.test.js` — nome, custom field, UUID completo e `LABEL_API_KEY` nunca aparecem em stdout/stderr; apenas o prefixo mascarado (8 primeiros caracteres) do participant_id é logado |

## 6. Deploy com feature flag desligada (gate obrigatório)

- `.env.example`: `LABEL_DYNAMIC_LAYOUT_ENABLED=false` (linha 26).
- `render.yaml`: `LABEL_DYNAMIC_LAYOUT_ENABLED: "false"` (envVars), com
  comentário explícito de que a ativação exige aprovação do evento piloto.
- `src/config/env.js`: default de `LABEL_DYNAMIC_LAYOUT_ENABLED` é `false`
  quando a variável não está definida — mesmo se `render.yaml` for
  ignorado, o comportamento seguro (legado) prevalece.
- `isDynamicEngineConfigured()` (`src/services/badgeService.js`) exige
  tanto a flag quanto `SUPABASE_SERVICE_ROLE_KEY` configurada — ausência de
  qualquer uma delas mantém 100% do tráfego no renderer legado
  (`tests/badgeService.test.js`, caso "service role ausente").

**Este deploy inicial não habilita nenhum evento.** `LABEL_DYNAMIC_EVENT_IDS`
permanece vazio nos arquivos de configuração; mesmo com lista vazia
(qualquer evento elegível), a flag mestre desligada bloqueia o motor
dinâmico por completo.

## 7. Ativação do primeiro evento piloto — pendente de nova aprovação

Conforme gate definido pelo usuário, a ativação de qualquer evento em
`LABEL_DYNAMIC_EVENT_IDS` em produção **não faz parte desta execução** e
exige aprovação humana explícita e separada, feita diretamente no painel
de variáveis de ambiente do Render (não requer novo deploy de código).
Eventos de homologação candidatos, confirmados em
`docs/plano-motor-dinamico-etiquetas.md` §2.5: `event_id = 6` ou `33`.

## 8. Checklist de aceite (Spec 03 atualizada §26)

- [x] `/badge` continua funcionando sem alteração no aplicativo — contrato
      preservado bit-a-bit (§2 deste documento).
- [x] Estrutura Base64 preservada (`success`, `format`, `data`, `dataUri`,
      `mimeType`) — `tests/legacy-contract.test.js`.
- [x] PNG preservado — golden tests, §2.
- [x] Baseline legado preservado — `golden/manifest.json`, §1.
- [x] Evento resolvido pelo UUID com consulta mínima
      (`select id,event_id`) — `src/repositories/participantRepository.js`.
- [x] Nenhuma RPC adicional criada — apenas
      `get_published_event_label_layout` e `resolve_participant_label_data`,
      já existentes no projeto Supabase.
- [x] Layout publicado lido — `src/repositories/labelRpcRepository.js`.
- [x] Dados resolvidos pela RPC allowlisted — idem.
- [x] Canvas 800×500 convertido corretamente —
      `tests/dynamicLabelRenderer.test.js` ("computeScale").
- [x] Perfil 80×50 mm / 300 DPI respeitado —
      `src/validators/layoutContractValidator.js` + teste dedicado.
- [x] Overflow implementado (`wrap`/`shrink`/`truncate`/`hide`) —
      `tests/textRenderer.test.js`.
- [x] `maxCharacters` implementado — idem.
- [x] QR dinâmico implementado (L/M/Q/H) — `tests/qrRenderer.test.js`.
- [x] Logo seguro implementado (SSRF, MIME, tamanho, dimensão) —
      `tests/imageService.test.js`.
- [x] Campo ausente usa fallback — `tests/dataResolver.test.js`.
- [x] Evento sem layout usa legado —
      `tests/badgeService.test.js`/`tests/badgeRouteDynamic.test.js`.
- [x] Feature flag funciona — `LABEL_DYNAMIC_LAYOUT_ENABLED` (§6).
- [x] Allowlist piloto funciona — `LABEL_DYNAMIC_EVENT_IDS`
      (`isEventAllowlisted`).
- [x] Rota v2 protegida — Bearer timing-safe, fail-closed
      (`tests/apiKeyAuth.test.js`).
- [x] Logs sem PII — `tests/logsNoPii.test.js` (§5).
- [x] Health check funciona — `tests/health.test.js`.
- [x] Golden images criadas — `golden/*.png` + `golden/manifest.json`.
- [x] Performance documentada — §4 deste documento.
- [x] Deploy reproduzível — `package-lock.json` versionado,
      `engines.node` fixado, `render.yaml`.
- [x] Aplicativo e Bluetooth não foram alterados — nenhuma mudança fora de
      `creator-label/` neste plano.

## 9. Critérios de aceite adicionais (plano §10, ajustes do usuário)

- [x] `package-lock.json` versionado com versões congeladas de Node
      (`22.14.0`), `@napi-rs/canvas` (`0.1.100`) e fonte (`arial.ttf`)
      antes do baseline (commit `c0e2b8f`).
- [x] 100% dos testes rodando via `node --test`, sem dependências externas
      de teste (`node:assert/strict`, sem Jest/Mocha/Chai).
- [x] Golden tests offline (fixtures + fakes), sem chamadas ao Supabase
      real — `tests/fakes/fakePostgrestServer.js`.
- [x] Comparação de golden por SHA-256 e, se necessário, RGBA, sem
      auto-aprovação de diffs — `scripts/compare-golden.js`.
- [x] Taxonomia de erros implementada; apenas `FallbackEligibleError`
      aciona o legado — `src/utils/errors.js`.
- [x] Cache `participant_id→event_id` e `event_id→layout` com
      `version_id` embutido — `src/repositories/participantRepository.js`,
      `src/repositories/labelRpcRepository.js`.
- [x] Timeout de 2 s por operação Supabase e orçamento total ~5 s por
      requisição — `src/utils/withTimeout.js`,
      `DYNAMIC_FLOW_TOTAL_BUDGET_MS` em `src/services/badgeService.js`.
- [x] `imageService` endurecido contra SSRF, redirect, IP privado, MIME
      falso, tamanho e dimensões — `src/services/imageService.js`.
- [x] Rate limit e concorrência configuráveis por ambiente, com defaults
      tolerantes a IP compartilhado —
      `src/config/rateLimitDefaults.js`.
- [x] Deploy inicial em produção com `LABEL_DYNAMIC_LAYOUT_ENABLED=false`
      — §6 deste documento.

---

## 10. Próximo passo (fora deste plano de implementação)

1. Deploy em produção com a configuração atual (`render.yaml`, flag off).
2. Validar `/badge` legado em produção (smoke test manual).
3. Solicitar aprovação humana explícita para habilitar `event_id = 6`
   e/ou `33` em `LABEL_DYNAMIC_EVENT_IDS`.
4. Comparar imagem dinâmica gerada vs. esperado do editor de layouts.
5. Homologação física via aplicativo/Bluetooth (fora do escopo de código
   deste plano).
