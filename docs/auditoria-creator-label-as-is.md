# Auditoria AS-IS — Serviço `creator-label`

**Projeto:** `web-dks/creator-label`  
**Fase:** 1 — Análise AS-IS  
**Data:** 2026-07-29  
**Ambiente de teste local:** Node v22.14.0, Windows Server, porta `3456`  
**Status:** Concluída — aguardando aprovação antes da Fase 2

---

## 1. Resumo executivo

O `creator-label` é uma API Express monolítica (`index.js`) que gera etiquetas PNG (ou Base64) de **80×50 mm** em landscape, com nome (até 2 linhas), subtítulo opcional derivado de `extra_answers` e QR Code.

Pontos centrais:

- Contrato legado estável: `GET|POST /badge` com vários aliases de parâmetros.
- Layout, fontes, DPI, regras CPS e posições estão **hardcoded** no código.
- Consulta opcional ao Supabase por UUID (`participants.id`); sem filtro de `event_id`.
- Sem autenticação, CORS, rate limit, health check, testes automatizados, README ou artefatos de deploy no repositório.
- Funciona localmente com `@napi-rs/canvas` + `arial.ttf` na raiz; sem Supabase, o `qr` vira payload literal do QR.

**Veredito:** serviço operacional e simples, adequado a um evento/cliente específico (CPS), mas **não pronto** para motor genérico multi-evento sem refatoração de contrato, segurança e configuração dinâmica.

---

## 2. Arquitetura atual

```text
Cliente (credenciamento / app / impressora / chamada manual)
        │  GET|POST /badge
        ▼
┌───────────────────────────────────────┐
│  Express (index.js)                   │
│  parseParams → handleBadgeRequest     │
│         │                             │
│         ├─(opcional) Supabase         │
│         │  participants by id=qr      │
│         │  name + extra_answers       │
│         ▼                             │
│  renderBadgePng                       │
│  ├─ splitNameIntoTwoLines             │
│  ├─ displayLineFromExtraAnswers       │
│  ├─ wrapSubtitleLines                 │
│  ├─ QRCode.toBuffer                   │
│  └─ @napi-rs/canvas (ou canvas)       │
└───────────────────────────────────────┘
        │
        ▼
 PNG binário  |  JSON { data, dataUri } base64
```

Não há camadas, módulos, filas, cache ou versionamento de layout.

---

## 3. Mapa de arquivos

| Arquivo / pasta | Existe? | Finalidade | Impacto runtime | Manutenção |
|-----------------|---------|------------|-----------------|------------|
| `index.js` | Sim | Toda a API + renderização | Crítico | Alta |
| `package.json` | Sim | Dependências e scripts `start`/`dev` | Crítico | Média |
| `arial.ttf` | Sim (raiz) | Fonte registrada no canvas | Alto (consistência visual) | Média |
| `.gitignore` | Sim | Ignora `node_modules`, `.env`, **lockfiles** | Indireto | Baixa |
| `spec-auditoria-creator-label.md` | Sim (untracked) | Spec desta auditoria | Nenhum | — |
| `.env` / `.env.example` | Não no repo | Credenciais Supabase / PORT | Crítico se ausente em prod | Alta |
| `fonts/` | Não | Documentado no código, não usado | — | — |
| `README.md` | Não | — | Documentação ausente | — |
| `Dockerfile` / `Procfile` / `render.yaml` | Não | Deploy não versionado | Alto risco operacional | — |
| `tests/` / `scripts/` / `public/` | Não | — | Sem cobertura | — |
| `package-lock.json` | Ignorado pelo git | Builds não reproduzíveis | Alto | — |

**Obsoletos / mortos no código:**

- `resolveField()` — definida, nunca chamada.
- `SUPABASE_NAME_FIELD` / `SUPABASE_QR_FIELD` — lidas do env, nunca usadas (select fixo: `id,name,extra_answers`).
- Comentário de cabeçalho fala em “category below QR”; implementação atual desenha subtítulo **acima** do QR.

---

## 4. Dependências

| Pacote | Versão package.json | Instalada (local) | Uso real | Obrigatória? | Riscos |
|--------|---------------------|-------------------|----------|--------------|--------|
| `express` | ^4.19.2 | 4.22.2 | HTTP API | Sim | Sem helmet/rate-limit |
| `@napi-rs/canvas` | ^0.1.54 | 0.1.100 | Render PNG (preferida) | Sim (preferida) | Binário nativo por plataforma |
| `canvas` | ^2.11.2 (optional) | não instalada | Fallback | Opcional | Vulnerabilidades npm audit (via `tar`/`node-pre-gyp`) |
| `qrcode` | ^1.5.4 | 1.5.4 | Geração QR PNG | Sim | Baixo |
| `@supabase/supabase-js` | ^2.57.4 | 2.111.0 | Lookup participante | Condicional | Chave privilegiada se service role |
| `dotenv` | ^17.2.2 | 17.4.2 | `.env` | Sim em deploy | — |

**Ausentes (recomendados na evolução):** framework de testes, validação (Zod/Joi), logger estruturado, `helmet`, CORS explícito, rate limit, lockfile commitado.

**npm audit (local):** 7 vulnerabilidades (6 high, 1 critical) — principalmente cadeia do `canvas` opcional / `tar`. Com apenas `@napi-rs/canvas` ativo, o risco prático de runtime cai, mas o optionalDependency continua no grafo.

---

## 5. Deploy e runtime

| Item | Achado |
|------|--------|
| Hospedagem | **Não documentada no repo.** Código comenta Render/Linux para fontes; sem `render.yaml`/Dockerfile. URL de produção não confirmada nesta auditoria. |
| Start | `npm start` → `node index.js` |
| Porta | `process.env.PORT \|\| 3000` |
| Health check | **Ausente** |
| Autenticação API | **Ausente** (rota pública) |
| CORS | Default Express (sem middleware) |
| Payload limit | Default `express.json()` (~100kb) |
| Cache | Nenhum header `Cache-Control` |
| Restart / memória / CPU / timeout | Não versionados |
| Logs | `console.log` / `console.error` verbosos |
| Acesso | Qualquer cliente que alcance a URL |

Variáveis observadas no código:

| Variável | Obrigatória | Default | Usada? |
|----------|-------------|---------|--------|
| `PORT` | Não | `3000` | Sim |
| `SUPABASE_URL` | Para lookup | — | Sim |
| `SUPABASE_KEY` | Para lookup | — | Sim (tipo anon vs service role **não determinável** sem env de prod) |
| `SUPABASE_PARTICIPANTS_TABLE` | Não | `participants` | Sim |
| `SUPABASE_SCHEMA` | Não | `public` | Sim |
| `SUPABASE_NAME_FIELD` | Não | — | **Não** |
| `SUPABASE_QR_FIELD` | Não | — | **Não** |

Sem Supabase: serviço sobe e renderiza com `name` + `qr` literal.

---

## 6. Contrato da API (AS-IS)

### Rotas

| Método | Rota | Handler |
|--------|------|---------|
| GET | `/badge` | `handleBadgeRequest` |
| POST | `/badge` | `handleBadgeRequest` |

Nenhuma outra rota (sem `/`, `/health`, `/docs`).

### Parâmetros

Fonte: `req.query` (GET) ou `req.body` (POST).

| Parâmetro | Aliases | Tipo | Obrigatório | Default | Min/Max | Inválido | Impacto |
|-----------|---------|------|-------------|---------|---------|----------|---------|
| `name` | — | string | **Sim*** | `''` | — | 400 `Missing required parameter: name` | Texto principal |
| `qr` | — | string | Não | omitido | trim; vazio → omitido | Sem QR na imagem | Conteúdo QR / chave Supabase |
| `dpi` | — | number | Não | `300` | clamp **72–1200** | NaN → 300; >1200 → 1200 | Resolução / memória |
| `rotation` | `rotate` | number | Não | `0` | 0/90/180/270 | Outro → `0` | Orientação final |
| `format` | — | string | Não | `png` | `png` \| `base64` | Outro → `png` | Tipo de resposta |
| `maxLine1` | `max_line1`, `maxcharsline1` | number | Não | `15` | ≥1 efetivo no split | NaN → default | Truncamento linha 1 |
| `maxLine2` | `max_line2`, `maxcharsline2` | number | Não | `15` | ≥1 efetivo no split | NaN → default | Truncamento linha 2 |

\*Se Supabase retornar participante com `name`, o nome do DB **substitui** o parâmetro. Se só houver `qr` sem nome e sem participante, responde 400.

**Não aceitos (mas relevantes):** `event_id`, `subtitle`, `layout_id`, `mmWidth`/`mmHeight` (fixos em código: 80×50 landscape).

### Respostas

| Caso | Status | Content-Type | Corpo |
|------|--------|--------------|-------|
| Sucesso PNG | 200 | `image/png` | binário; `Content-Disposition: inline; filename="badge.png"` |
| Sucesso Base64 | 200 | `application/json` | `{ success, format, data, dataUri, mimeType }` |
| Nome ausente | 400 | `application/json` | `{ error: 'Missing required parameter: name' }` |
| Erro interno | 500 | `application/json` | `{ error: 'Internal Server Error' }` |

---

## 7. Variáveis de ambiente

Ver tabela na seção 5. **Ausência de `.env.example`** no repositório.

---

## 8. Consulta ao Supabase

```text
from(SUPABASE_TABLE)
  .select('id,name,extra_answers')
  .eq('id', participantId)
  .maybeSingle()
```

| Aspecto | Comportamento |
|---------|---------------|
| Chave | `SUPABASE_KEY` — **anon ou service role não distinguíveis no código** |
| Schema | `SUPABASE_SCHEMA` (default `public`) |
| Filtro `event_id` | **Não** |
| Participante encontrado | Usa `name` do DB; subtítulo via `extra_answers`; QR = UUID enviado |
| Participante **não** encontrado (com Supabase) | **QR removido** (`resolvedQr = undefined`); nome do request permanece se existir |
| Sem Supabase | QR usado como texto livre no código |
| Erro de query | Log + retorna `null` (mesmo efeito de “não encontrado”) |
| Privacidade | UUID basta para ler qualquer linha acessível pela chave |

**Riscos:** privilégio excessivo se service role; leitura cross-evento; QR arbitrário quando DB off.

---

## 9. Dados utilizados

| Campo | Uso |
|-------|-----|
| `participants.id` | Filtro e conteúdo do QR (quando encontrado) |
| `participants.name` | Texto da etiqueta |
| `participants.extra_answers` | Subtítulo (regras CPS) |

Campos de override de env (`NAME_FIELD` / `QR_FIELD`) **não aplicados**.

---

## 10. Regras hardcoded (CPS)

Chaves e valores em `displayLineFromExtraAnswers`:

| Origem (`Área de atuação CPS`) | Resultado exibido | Observação |
|--------------------------------|-------------------|------------|
| `Adm. Central/ Polos Regionais` | `Adm. Central` | Match exato (espaço após `/`) |
| `Pós-Graduação` | `Pós-Graduação` | Match exato |
| `Etec` / `etec` / `Fatec` / `fatec` | `Unidade` ou a própria área | Case-insensitive só para etec/fatec |
| Qualquer outro | `''` (sem subtítulo) | — |

**Evento/cliente associado (provável):** CPS / Centro Paula Souza (Festival/credenciamento DKS).  
**Generalização futura:** mapa de regras ou template por evento em config/DB.  
**Risco de regressão:** alto se mudar strings exatas sem versionar layout.

---

## 11. Layout atual

### Mapa

```text
área virtual 500 × 800  →  canvas real 80mm × 50mm @ DPI
├── bloco do nome (line1, opcional line2) — bold, centrado, preto
├── subtítulo (0..N linhas wrap por largura) — bold menor
└── QR Code (se qrText) — centrado; Y empurrado para baixo se necessário
```

Orientação: conteúdo sempre desenhado em **landscape 80×50 mm**; `rotation` aplica transform no canvas final (90/270 trocam dimensões).

### Constantes

| Constante | Valor | Unidade | Finalidade |
|-----------|-------|---------|------------|
| `MM_WIDTH` / `MM_HEIGHT` | 50 / 80 | mm | Tamanho físico declarado |
| Conteúdo real | 80 × 50 | mm | Landscape forçado (`mmWidth=80`, `mmHeight=50`) |
| `DEFAULT_DPI` | 300 | dpi | Default |
| `MIN_DPI` / `MAX_DPI` | 72 / 1200 | dpi | Clamp |
| `VIRTUAL_W` / `VIRTUAL_H` | 500 / 800 | px virtuais | Régua de layout |
| `titleFont` / `secondFont` | 118 | virtual | Nome |
| `subtitleFont` | 72 | virtual | Subtítulo |
| `lineGap` | 40 | virtual | Entre linhas do nome |
| `afterTextGap` | 180 (≥40 px reais) | virtual/px | Antes do QR |
| `qrSize` | 300 (−40 no render) | virtual | QR |
| `gapNameToSubtitle` | 36 | virtual | Nome → subtítulo |
| `nameBlockTopOffset` | 22 | virtual | Empurra bloco do nome |
| paddings | top/bottom 30, side 0 | px reais | Área útil |
| cores | `#FFFFFF` fundo, `#000000` texto/QR | — | Fixas |

**Dimensões medidas localmente (PNG):**

| Caso | Largura × Altura (px) |
|------|------------------------|
| 72 DPI, rot 0 | 227 × 142 |
| 300 DPI, rot 0 | 945 × 591 |
| 600 DPI | 1890 × 1181 |
| 1200 DPI | 3780 × 2362 |
| 300 DPI, rot 90/270 | 591 × 945 |

---

## 12. Limites

| Limite | Valor AS-IS |
|--------|-------------|
| Chars linha 1/2 (default) | 15 / 15 |
| DPI | 72–1200 |
| Rotação | 0, 90, 180, 270 |
| Formatos | png, base64 |
| Linhas de subtítulo | **Sem teto** — wrap por largura; pode empurrar/comprimir espaço do QR (`qrY` limitado a `maxQrY`) |
| Autenticação / rate | Nenhum |

**Importante:** limite de caracteres **não garante** largura visual (`measureText` não é usado no nome).

---

## 13. Tratamento de nomes

Funções: `truncateToMaxChars`, `splitNameIntoTwoLines`.

| Cenário | Comportamento observado |
|---------|-------------------------|
| Vazio | `line1/line2` vazios → 400 se sem nome resolvido |
| Uma palavra | Só line1; truncate se > max |
| Duas palavras | Split balanceado |
| Longo / composto | Balanceado se couber; senão greedy + truncate com **`.`** (não `…`) |
| Acentos / hífen / apóstrofo | Preservados |
| Espaços duplicados | Colapsados no `split(/\s+/)` |
| Emoji | Tratado como token de palavra |
| >100 chars | Truncado por caps de linha |

Risco: sobrenomes perdidos no truncate; nomes “largos” (W, M) podem estourar visualmente dentro do limite de chars.

---

## 14. Subtítulo e `extra_answers`

| Entrada | Resultado |
|---------|-----------|
| objeto | Usado direto |
| JSON string válida | `JSON.parse` |
| JSON inválido / null / não-objeto | `null` → sem subtítulo |
| Regras CPS | Ver seção 10 |
| Wrap | `wrapSubtitleLines` por `measureText`, largura 92% |

Sem limite máximo de linhas de subtítulo — risco de colisão visual com o QR (QR é reposicionado para não sair da base, o que pode sobrepor texto).

---

## 15. QR Code

| Item | Valor |
|------|-------|
| Biblioteca | `qrcode` → `toBuffer` PNG |
| ECC | `M` |
| Margin | `0` |
| Cores | preto/branco |
| Conteúdo desejado | `participants.id` (UUID) |
| Sem texto | QR não desenhado |
| Supabase off | Qualquer string em `qr` |
| Participante inexistente (DB on) | QR **omitido** |

Risco de texto livre no QR quando DB não está configurado.

---

## 16. Segurança

| Risco | Severidade | Detalhe |
|-------|------------|---------|
| API pública sem auth | **Crítico** | Qualquer um gera etiquetas / satura CPU |
| DoS por DPI alto + concorrência | **Alto** | 1200 DPI ≈ 3780×2362 px por request |
| Lookup por UUID sem `event_id` | **Alto** | Escopo amplo se chave forte |
| Possible service role em `SUPABASE_KEY` | **Alto** | Não auditável sem secrets de prod |
| Logs com body/query/nome/UUID | **Médio** | PII em stdout |
| QR arbitrário (sem Supabase) | **Médio** | Conteúdo não controlado |
| Sem rate limit / helmet / CORS policy | **Médio** | Superfície aberta |
| Stack trace | **Baixo** | 500 genérico (bom); detalhe só no log |
| Vulnerabilidades npm (`canvas`/tar) | **Médio** | Principalmente optional path |
| Repo público + fonte proprietária (`arial.ttf`) | **Médio** | Licenciamento |

---

## 17. Performance

Medições locais (sem Supabase, máquina de desenvolvimento):

| Cenário | Latência observada | Tamanho PNG típico |
|---------|--------------------|--------------------|
| 1 req @ 72 DPI | ~29 ms | ~2 KB |
| 1 req @ 300 DPI | ~80–190 ms | ~7–30 KB |
| 1 req @ 600 DPI | ~259 ms | ~24 KB |
| 1 req @ 1200 DPI | ~660–740 ms | ~63 KB |
| Base64 @ 300 | ~105 ms | JSON ~27 KB |
| **10 simultâneas** @ 300 | 175–309 ms cada, **10/10 OK** | — |
| **50 simultâneas** @ 72 DPI | **50/50 OK**, wall ~9,3 s | — |
| 100 simultâneas | Não executado (evitar carga agressiva); expectativa de maior pressão de memória em DPI altos | — |

Fatores: geração QR + encode PNG + (em prod) round-trip Supabase por impressão. Fontes registradas no boot (OK). Cold start: carregar nativos `@napi-rs/canvas`.

---

## 18. Observabilidade

Existente: logs ad-hoc (`parseParams`, splits, Supabase, erros).

Ausente: request ID, logs estruturados, métricas, tracing, versão de layout, correlação por evento.

**Recomendações (não implementar nesta fase):** request ID, duração, status, erro sanitizado, `layoutVersion`, ambiente.

---

## 19. Consumidores

Busca limitada:

- Org/user `web-dks` no GitHub: repositórios `pwa-nfc`, `dks-festival-25`, `api-ftp`, `crypto-helper`, `supabase-dkseventos`, `n8n`, `weweb-test`, além de `creator-label`.
- `gh` CLI indisponível no ambiente; busca de código na API GitHub retornou 401.
- Nenhum consumidor com chamada explícita a `/badge` foi confirmado no código remoto nesta auditoria.

**Consumidores esperados (por contexto/spec):** sistema de credenciamento, app/totem de impressão, chamadas manuais/n8n.

**Contrato a preservar:** `GET|POST /badge`, PNG default, `format=base64`, aliases `maxLine*`, `rotation`/`rotate`.

---

## 20. Testes executados

Matriz local (dados sintéticos), evidências em `audit-evidence/` (não versionar PII real).

| ID | Resultado |
|----|-----------|
| name-short/medium/long/compound/intl/emoji/100+ | 200 PNG |
| dpi 72/600/1200 | 200; dimensões conferidas |
| rotation 0/90/180/270 | 200; swap de eixos OK |
| rotation 45 | 200 com fallback 0 |
| format base64 | 200 JSON |
| format jpeg | 200 PNG (fallback) |
| sem qr | 200 sem QR |
| missing name | 400 |
| dpi inválido / >max | 200 (fallback/clamp) |
| POST JSON | 200 |
| aliases max_line / rotate | 200 |
| regras CPS (unit) | conforme tabela seção 10 |
| concorrência 10 | 10/10 sucesso |
| concorrência 50 @ 72 DPI | 50/50 sucesso (~9,3 s wall) |

Não testado com Supabase real (sem `.env` no ambiente).

---

## 21. Riscos (consolidado)

1. **Crítico:** endpoint aberto + custo de render.  
2. **Alto:** multi-evento sem isolamento (`event_id`).  
3. **Alto:** regras/layout CPS no código → regressão ao generalizar.  
4. **Alto:** deploy/infra não versionados; builds sem lockfile.  
5. **Médio:** logs com PII; QR livre; subtítulo sem teto de linhas; licença Arial.

---

## 22. Dívida técnica

- Monólito único arquivo (~620 linhas).
- Sem testes, lint, CI, README, `.env.example`.
- Lockfiles no `.gitignore`.
- Código morto (`resolveField`, env fields).
- Logs de debug em produção.
- Comentários desatualizados vs comportamento.
- Fonte na raiz em vez de `fonts/`.

---

## 23. Capacidades reutilizáveis

- Pipeline PNG via `@napi-rs/canvas` + fallback.
- Conversão mm→px e régua virtual escalável.
- Split de nome + truncate.
- Wrap de subtítulo por `measureText`.
- Rotação 0/90/180/270.
- Dual output PNG/Base64.
- Integração Supabase opcional com degrade.

---

## 24. Pontos que precisam mudar (próximas fases — sem implementar agora)

1. Separar módulos: HTTP / domínio / render / providers.  
2. Layout e regras de negócio → configuração versionada por evento.  
3. Auth (API key/JWT) + rate limit + limites de DPI/concorrência.  
4. Exigir `event_id` (ou RPC segura) na consulta.  
5. Validação de entrada (schema).  
6. Observabilidade e healthcheck.  
7. Testes de regressão visual/contrato.  
8. Documentar e versionar deploy.

---

## 25. Decisões pendentes

1. URL e provedor de produção (Render?).  
2. Tipo real de `SUPABASE_KEY` (anon vs service role).  
3. Consumidores oficiais e payloads exatos.  
4. O QR **deve** ser sempre `participants.id`?  
5. Comportamento desejado quando participante não existe (hoje: sem QR).  
6. Tamanho físico canônico: documentar 80×50 landscape vs comment 50×80.  
7. Default `maxLine` 15 vs histórico de commits (já foi 10).  
8. Política de fonte (Arial embutida vs open font).  
9. Manter rota `/badge` como legado forever vs versionar `/v2`.

---

## 26. Perguntas para o aplicativo / impressora

1. Qual URL chama hoje e com qual método?  
2. Espera PNG binário ou Base64?  
3. Qual DPI e rotação usam na prática?  
4. Enviam `name` sempre ou só `qr`?  
5. Dependem do filename `badge.png`?  
6. Timeout do cliente?  
7. Precisam de preview vs render final distintos?  
8. Como tratam 400/500?  
9. Há cache local da imagem?  
10. Impressão térmica: leitura do QR após print foi validada em qual DPI?

---

## 27. Recomendações para a próxima fase

1. Congelar contrato `/badge` como legado.  
2. Desenhar motor de layout configurável **sem** quebrar aliases atuais.  
3. Introduzir autenticação e quotas antes de abrir multi-evento.  
4. Extrair regras CPS para config do evento.  
5. Adicionar suite de golden images (DPI/rotação/nomes).  
6. Versionar infra + `.env.example` + lockfile.  
7. Cruzar esta auditoria com a do sistema de credenciamento (seção abaixo).

---

## Contrato de integração necessário para o sistema de credenciamento

| Tópico | Proposta AS-IS → TO-BE |
|--------|-------------------------|
| Identificadores mínimos | Hoje: `qr` (= UUID) e/ou `name`. Futuro: `participant_id` + `event_id` (+ opcional `layout_version`). |
| Dados que o serviço deve receber | Nome (override), DPI, rotação, format, caps de linha; futuramente subtítulo/layout id. |
| Dados que pode buscar | `name`, `extra_answers` (ou campos mapeados) **somente no escopo do evento**. |
| Formato de layout | Hoje: único hardcoded 80×50 mm. Futuro: manifesto JSON versionado. |
| Versionamento | Hoje: implícito no deploy. Futuro: `layoutVersion` no response/header. |
| Fallback | Sem DB: name obrigatório + qr literal. Com DB miss: name request, **sem QR** (comportamento a confirmar). |
| Preview | Mesmo endpoint; sugerir `dpi` baixo (72–150) para preview. |
| Render final | `dpi=300` (ou 600) + rotação exigida pela impressora. |
| Erros | 400 validação; 404 participante (hoje não existe); 429 rate; 500 genérico. |
| Autenticação | Hoje nenhuma. Futuro: API key/mTLS entre credenciamento e label. |
| Cache | Hoje nenhum. Futuro: cache por `(participant_id, layoutVersion, dpi, rotation)` com invalidação. |
| Compatibilidade | Manter `GET|POST /badge` e aliases atuais até todos os clientes migrarem. |

---

## Encerramento da Fase 1

Esta auditoria **não alterou** o comportamento do serviço.  
**Próximo passo:** aprovação humana → só então Fase 2.

### Achados-chave

- Serviço monolítico funcional com contrato `/badge` legado.  
- Regras CPS e layout no código.  
- Sem segurança de borda nem isolamento multi-evento.  
- Deploy e documentação operacional ausentes no repositório.

### Riscos críticos

- API aberta + render custoso.  
- Lookup por UUID sem `event_id`.  

### O que reaproveitar

- Motor canvas/QR/rotação/split/base64.  

### O que refatorar

- Modularização, config dinâmica, auth, validação, testes, observabilidade.

**Aguardando aprovação.**
