# creator-label

API Express que gera etiquetas de participante em PNG (ou Base64), 80×50 mm, landscape, com nome, subtítulo/categoria, QR Code e — a partir da Fase 3 — o layout publicado de cada evento no sistema de credenciamento.

## Contrato legado (não muda para o aplicativo)

```
GET|POST /badge
```

Parâmetros aceitos (e aliases): `name`, `qr`, `dpi`, `rotation`/`rotate`, `format` (`png`|`base64`), `maxLine1`/`max_line1`/`maxcharsline1`, `maxLine2`/`max_line2`/`maxcharsline2`.

- PNG (default): `Content-Type: image/png`, `Content-Disposition: inline; filename="badge.png"`.
- Base64: `{ "success": true, "format": "base64", "data": "<base64>", "dataUri": "data:image/png;base64,<base64>", "mimeType": "image/png" }`.
- Nome ausente e não resolvível: `400 { "error": "Missing required parameter: name" }`.

Este contrato é preservado integralmente pela Fase 3 — ver `docs/plano-motor-dinamico-etiquetas.md`.

## Rota nova: `POST /v2/badges/render`

Renderiza **somente** o layout publicado do evento pelo motor dinâmico — nunca cai no renderer legado. Requer o motor habilitado (`LABEL_DYNAMIC_LAYOUT_ENABLED=true` e `SUPABASE_SERVICE_ROLE_KEY` configurada) e autenticação:

```
Authorization: Bearer <LABEL_API_KEY>
```

O segredo é comparado em tempo constante (`src/utils/timingSafeEqual.js`). Sem `LABEL_API_KEY` configurada no ambiente, a rota fica bloqueada por padrão (fail closed).

Payload:

```json
{ "participant_id": "uuid", "format": "base64" }
```

`format` é opcional (`base64` por padrão, ou `png`). Respostas:

- `200`: mesmo envelope PNG/Base64 da rota legada.
- `400`: payload inválido (`participant_id` não é UUID, `format` não suportado).
- `401`: Bearer ausente ou inválido.
- `404`: participante/evento/layout não encontrado ou não elegível (nunca fallback).
- `502`/`503`: layout inválido ou dependência do Supabase temporariamente indisponível.

## Requisitos e versões congeladas

Para reproduzir exatamente o baseline visual capturado em `golden/`:

| Item | Versão |
|---|---|
| Node.js | `22.14.0` (ver `engines.node` em `package.json`) |
| `@napi-rs/canvas` | `0.1.100` (fixada, sem `^`) |
| Fonte `arial.ttf` (raiz do projeto) | SHA-256 `c9b76220a5be42ead4733611e417cd65c5fd8aeaa33eb56576ac378a37d130a` |

`package-lock.json` é versionado propositalmente — não delete nem regenere com `npm install` sem necessidade real, pois isso pode alterar transitivamente pacotes usados na renderização.

## Instalação e execução local

```bash
npm install
cp .env.example .env
npm start
```

O serviço sobe em `http://localhost:${PORT:-3000}`.

Sem `SUPABASE_URL`/`SUPABASE_KEY` configurados, o serviço funciona em modo "sem banco": `qr` é usado como payload literal do QR e `name` vem só do request.

## Testes

Runner exclusivo: [`node:test`](https://nodejs.org/api/test.html) (sem Jest/Mocha/Vitest).

```bash
npm test
```

Os testes rodam **totalmente offline**: um servidor PostgREST falso local (`tests/fakes/fakePostgrestServer.js`) simula as respostas do Supabase a partir de fixtures em `tests/fixtures/`, sem qualquer chamada a um projeto Supabase real.

### Golden tests (baseline visual do renderer legado)

```bash
npm run golden:capture   # primeira captura (falha se golden/manifest.json já existir)
npm run golden:update    # recaptura deliberada, só depois de revisar a mudança
```

A comparação (`scripts/compare-golden.js`, usada também por `npm test`) verifica **SHA-256 primeiro**; se o hash não bater, decodifica ambos os PNGs e compara pixel a pixel (RGBA) apenas para gerar um relatório de diagnóstico — **nunca aprova uma diferença automaticamente**. Qualquer mudança no `golden/manifest.json` exige rodar `npm run golden:update` manualmente e revisar o diff antes de commitar.

### Performance (motor dinâmico)

```bash
npm run perf:check   # opcional: --out caminho/para/relatorio.json
```

Sobe `src/app.js` real em processo, contra um Supabase dinâmico fake local, e mede 1 request / 10 sequenciais / 10 simultâneas / 50 controladas (média, p95, tamanho de resposta), além do efeito de cache e de fallback. Não faz parte de `npm test`; é um script manual de diagnóstico. Última medição registrada em `docs/perf-results.json` e resumida em `docs/validacao-motor-dinamico-etiquetas.md`.

## Variáveis de ambiente

Ver `.env.example` para a lista completa e comentada. Resumo:

| Variável | Uso |
|---|---|
| `PORT` | Porta HTTP |
| `SUPABASE_URL` | Projeto do sistema de credenciamento |
| `SUPABASE_KEY` | Lookup legado opcional (anon/public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Exigida para habilitar o motor dinâmico |
| `SUPABASE_PARTICIPANTS_TABLE` / `SUPABASE_SCHEMA` | Overrides do lookup legado |
| `LABEL_DYNAMIC_LAYOUT_ENABLED` | Feature flag mestre (default `false`) |
| `LABEL_DYNAMIC_EVENT_IDS` | Allowlist de eventos no rollout piloto |
| `LABEL_API_KEY` | Bearer exigido por `POST /v2/badges/render` |
| `LABEL_LOGO_ALLOWED_HOSTS` | Allowlist de hosts para a logo do evento |
| `LABEL_LAYOUT_CACHE_TTL_SECONDS` / `LABEL_CONTEXT_CACHE_TTL_SECONDS` | TTL dos caches em memória |
| `LABEL_RATE_LIMIT_WINDOW_MS` / `LABEL_RATE_LIMIT_MAX` / `LABEL_CONCURRENCY_LIMIT` | Rate limit e concorrência (defaults por `NODE_ENV`) |

Nunca commitar `.env` nem qualquer segredo real.

## Deploy

Ver `render.yaml`. Todo novo deploy **deve** subir com `LABEL_DYNAMIC_LAYOUT_ENABLED=false`; a ativação do primeiro evento em produção exige aprovação humana explícita separada deste repositório (ver `docs/plano-motor-dinamico-etiquetas.md`, seção de rollout e gates).

## Documentação da Fase 3

- `docs/plano-motor-dinamico-etiquetas.md` — plano operacional aprovado, com os ajustes de segurança/teste incorporados.
- `docs/validacao-motor-dinamico-etiquetas.md` — relatório de validação (preenchido ao final da implementação).
- `docs/auditoria-creator-label-as-is.md` — auditoria do estado anterior à Fase 3.
