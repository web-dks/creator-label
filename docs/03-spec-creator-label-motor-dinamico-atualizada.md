# Spec 03 atualizada — Motor dinâmico no `creator-label`

**Projeto:** `web-dks/creator-label`  
**Fase:** Implementação 3  
**Dependências:** Fases 1 e 2 concluídas e ajustes finais da Spec 03A validados  
**Objetivo:** evoluir o serviço atual para renderizar o layout publicado de cada evento, preservando integralmente o contrato legado consumido pelo aplicativo FlutterFlow.

## 1. Premissas fechadas

1. O aplicativo atual não será alterado.
2. A impressão continua sendo realizada pelo aplicativo via Bluetooth.
3. O aplicativo chama `GET /badge`.
4. O parâmetro dinâmico principal é `qr=<participants.id>`.
5. O aplicativo também envia parâmetros fixos como `name`, `dpi=300`, `rotation=0` e `format=base64`.
6. A resposta Base64 atual deve manter exatamente o mesmo formato.
7. Evento sem layout publicado utiliza o renderer legado.
8. A dimensão homologada permanece 80 × 50 mm.
9. O DPI homologado permanece 300.
10. A orientação permanece landscape.
11. O canvas lógico do layout dinâmico é 800 × 500.
12. O conteúdo do QR continua sendo `participants.id`.
13. A Fase 3 não altera aplicativo, Bluetooth ou impressora.
14. Não será criada uma RPC adicional apenas para obter `event_id`.

## 2. Decisão sobre resolução do evento

O `creator-label` já recebe o UUID do participante e já consulta o Supabase.

O novo fluxo utilizará uma consulta backend mínima:

```js
supabase
  .from('participants')
  .select('id,event_id')
  .eq('id', participantId)
  .maybeSingle()
```

Essa consulta existe apenas para resolver:

```text
participant_id → event_id
```

Depois serão usadas as RPCs já implementadas:

```text
get_published_event_label_layout(event_id)
resolve_participant_label_data(participant_id, event_id)
```

### Justificativa

Uma RPC extra não é necessária porque:

- o serviço já possui conexão backend com o Supabase;
- `participants.id` já é a chave recebida;
- `event_id` está na própria linha do participante;
- a consulta seleciona somente duas colunas;
- a service role permanece exclusivamente no servidor;
- os dados completos continuam sendo resolvidos pela RPC allowlisted.

### Restrições

A consulta de contexto não pode selecionar:

- nome;
- e-mail;
- telefone;
- documento;
- `extra_answers`;
- demais colunas.

O lookup legado existente poderá continuar selecionando `name` e `extra_answers` somente quando o renderer legado realmente for utilizado.

## 3. Leitura obrigatória

Antes de planejar ou codificar, ler no sistema de credenciamento:

```text
docs/plano-fundacao-etiquetas.md
docs/contrato-renderer-etiquetas.md
docs/validacao-fundacao-etiquetas.md
docs/plano-editor-etiquetas.md
docs/validacao-editor-etiquetas.md
docs/references/02-spec-credenciamento-editor-etiquetas-atualizada.md
```

Ler no `creator-label`:

```text
index.js
package.json
auditoria-creator-label-as-is.md, quando presente
```

Validar no Supabase:

```text
participants.id
participants.event_id
get_published_event_label_layout
resolve_participant_label_data
```

Antes de escrever código:

1. criar `docs/plano-motor-dinamico-etiquetas.md`;
2. apresentar pseudocódigo;
3. mapear módulos;
4. mapear contrato legado exato;
5. definir estratégia de fallback;
6. definir rollout;
7. parar para aprovação.

## 4. Contrato legado obrigatório

Manter:

```http
GET /badge
POST /badge
```

Parâmetros aceitos:

```text
name
qr
dpi
rotation
rotate
format
maxLine1
max_line1
maxcharsline1
maxLine2
max_line2
maxcharsline2
```

### PNG

```text
Content-Type: image/png
Content-Disposition: inline; filename="badge.png"
```

### Base64

Manter exatamente:

```json
{
  "success": true,
  "format": "base64",
  "data": "<base64 puro>",
  "dataUri": "data:image/png;base64,<base64 puro>",
  "mimeType": "image/png"
}
```

Não renomear propriedades e não substituir por outro formato de envelope.

## 5. Fluxo da rota legada

```text
GET /badge?qr=<participant_id>
    ↓
parse e validação compatível
    ↓
LABEL_DYNAMIC_LAYOUT_ENABLED?
    ├── false
    │     ↓
    │  fluxo legado atual
    │
    └── true
          ↓
validar qr como UUID
          ↓
consulta mínima participants(id,event_id)
          ├── participante ausente → fallback legado
          ├── event_id nulo → fallback legado
          └── event_id encontrado
                ↓
evento permitido no rollout?
                ├── não → fallback legado
                └── sim
                      ↓
get_published_event_label_layout(event_id)
                      ├── null → fallback legado
                      └── layout publicado
                            ↓
resolve_participant_label_data(participant_id,event_id)
                            ↓
validar contrato
                            ↓
renderer dinâmico
                            ↓
resposta no contrato legado
```

O aplicativo não envia:

```text
event_id
template_id
version_id
```

O serviço resolve tudo no backend.

## 6. Clientes Supabase

Variáveis:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_KEY
```

### Cliente dinâmico

Usar:

```text
SUPABASE_SERVICE_ROLE_KEY
```

Para:

- consulta mínima `participants(id,event_id)`;
- `get_published_event_label_layout`;
- `resolve_participant_label_data`.

### Cliente legado

`SUPABASE_KEY` pode continuar temporariamente para preservar o comportamento atual.

O renderer dinâmico só pode ser habilitado quando:

```text
SUPABASE_SERVICE_ROLE_KEY
```

estiver configurada.

Nunca expor a service role ao aplicativo, navegador ou resposta da API.

## 7. Repositório de participante

Criar separação explícita:

```text
fetchParticipantContext(participantId)
fetchLegacyParticipant(participantId)
```

### `fetchParticipantContext`

Seleciona somente:

```text
id
event_id
```

### `fetchLegacyParticipant`

Preserva o lookup atual:

```text
id
name
extra_answers
```

Essa segunda consulta só é executada quando o fluxo realmente cair no renderer legado.

Não misturar os dois contratos.

## 8. Rotas novas do MVP

Criar:

```http
POST /v2/badges/render
GET /health
```

### `/v2/badges/render`

Payload:

```json
{
  "participant_id": "uuid",
  "format": "base64"
}
```

Renderiza somente a versão publicada.

Exigir:

```text
Authorization: Bearer <LABEL_API_KEY>
```

Comparar o segredo em tempo constante.

### Preview de draft

Não criar `/v2/badges/preview` nesta entrega.

Motivos:

- a Fase 2 já possui preview local;
- não existe contrato backend técnico para ler draft por versão;
- aceitar `layout_config` arbitrário amplia a superfície de ataque.

## 9. Modularização

Refatorar incrementalmente o monólito CommonJS atual.

Estrutura sugerida:

```text
src/
  app.js
  server.js
  config/
    env.js
    constants.js
  routes/
    legacyBadgeRoutes.js
    badgeV2Routes.js
    healthRoutes.js
  controllers/
    legacyBadgeController.js
    badgeV2Controller.js
  services/
    badgeService.js
    layoutService.js
    imageService.js
  repositories/
    participantRepository.js
    labelRpcRepository.js
  renderers/
    legacyLabelRenderer.js
    dynamicLabelRenderer.js
    textRenderer.js
    qrRenderer.js
    imageRenderer.js
  validators/
    requestValidator.js
    layoutContractValidator.js
  utils/
    logger.js
    errors.js
    cache.js
```

Preservar:

```text
npm start
CommonJS
entrypoint Node
```

Não realizar reescrita total sem necessidade.

## 10. Contrato real do layout

```json
{
  "schemaVersion": 1,
  "orientation": "landscape",
  "virtualWidth": 800,
  "virtualHeight": 500,
  "backgroundColor": "#FFFFFF",
  "elements": []
}
```

Limites:

```text
maxElements: 12
fontSize: 10–140
minFontSize: 10–140
maxLines: 1–4
maxCharacters: 1–250
QR: 100–360
rotation: 0
```

Tipos:

```text
text
qr_code
image
```

O renderer deve revalidar o layout recebido.

## 11. Mapeamento físico

Perfil atual:

```text
width_mm: 80
height_mm: 50
dpi: 300
default_rotation: 0
```

Dimensão aproximada:

```text
945 × 591 px
```

Conversão:

```text
width_px = round(width_mm / 25.4 × dpi)
height_px = round(height_mm / 25.4 × dpi)

scaleX = width_px / 800
scaleY = height_px / 500
uniformScale = min(scaleX, scaleY)
```

Aplicar:

- `x`, `width`: `scaleX`;
- `y`, `height`: `scaleY`;
- fonte: `uniformScale`;
- QR: quadrado sem distorção, centralizado na caixa.

O renderer legado mantém sua lógica atual em régua virtual 500 × 800 para preservar o resultado existente.

## 12. Resolução de dados

Fontes:

```text
participant.name
participant.category
participant.id
event.name
event.venue
event.city
event.state
static_text
custom_field.<id>
```

Imagem:

```text
event.label_logo
```

QR:

```text
participant.id
qr_code
```

Normalizar:

```text
qr_code → participant.id
```

Campo ausente utiliza:

```text
fallbackValue
```

Campo personalizado indisponível não deve derrubar toda a etiqueta; usar fallback ou vazio e registrar warning.

## 13. Renderização de texto

Ordem:

```text
1. resolver dataSource;
2. aplicar fallbackValue;
3. normalizar espaços;
4. aplicar maxCharacters;
5. aplicar overflowStrategy;
6. desenhar dentro da caixa.
```

### `maxCharacters`

Quando exceder:

```text
primeiros maxCharacters - 1 + …
```

O resultado final não pode ultrapassar o limite configurado.

### `wrap`

- usar `measureText`;
- respeitar `maxLines`;
- usar reticências na última linha quando necessário;
- respeitar alinhamento;
- centralizar verticalmente o bloco.

### `shrink`

- iniciar em `fontSize`;
- reduzir até `minFontSize`;
- validar largura e linhas;
- se ainda não couber, aplicar reticências.

### `truncate`

- manter `fontSize`;
- encontrar o maior conteúdo que cabe;
- usar reticências;
- respeitar `maxLines`.

### `hide`

- medir;
- não desenhar quando não couber.

### Fonte

MVP:

```text
Arial
```

Fonte desconhecida deve cair para Arial e gerar warning.

## 14. QR Code

Usar:

```text
errorCorrectionLevel: L | M | Q | H
margin: integer >= 0
```

Conteúdo sempre:

```text
participants.id
```

Regras:

- fundo branco;
- sem URL customizada;
- sem texto arbitrário;
- quadrado;
- centralizado;
- sem distorção.

## 15. Imagem e logo

Fonte:

```text
event.label_logo
```

Segurança:

- apenas HTTPS;
- host do Supabase Storage configurado ou allowlist explícita;
- bloquear localhost e IP privado;
- timeout de até 2 segundos;
- limite recomendado de 2 MB;
- aceitar PNG, JPEG e WebP;
- cache curto;
- bloquear redirect para host não autorizado.

Falha do logo:

```text
omitir elemento
registrar warning
continuar renderização
```

## 16. Fallback legado

Usar renderer legado quando:

- feature flag desligada;
- service role ausente;
- participante não encontrado no contexto;
- `event_id` nulo;
- evento fora da allowlist piloto;
- evento sem layout publicado;
- schema incompatível;
- layout inválido;
- RPC temporariamente indisponível.

Logo opcional indisponível não aciona fallback total.

### Participante inexistente

Preservar o comportamento atual:

- se `name` foi enviado, ainda pode gerar layout legado;
- com Supabase legado configurado e participante inexistente, o QR permanece omitido;
- não transformar QR desconhecido em payload livre;
- registrar warning sanitizado.

### Erros sem fallback

- payload excessivo;
- formato malicioso;
- autenticação inválida na rota v2;
- rate limit;
- limite de concorrência.

## 17. Feature flags e rollout

```text
LABEL_DYNAMIC_LAYOUT_ENABLED=false
LABEL_DYNAMIC_EVENT_IDS=
```

Regras:

```text
flag false → todos no legado
flag true + lista vazia → eventos com layout publicado
flag true + lista preenchida → somente eventos informados
```

Rollout:

1. deploy com flag desligada;
2. validar contrato legado;
3. habilitar somente evento de homologação;
4. comparar imagens;
5. testar aplicativo;
6. expandir gradualmente.

## 18. Cache

### Contexto

```text
participant_id → event_id
```

TTL curto.

### Layout

```text
event_id + version_id
```

TTL de 30 a 120 segundos.

Não manter cache persistente de dados pessoais.

## 19. Segurança da API

### Rota legada

Permanece sem autenticação adicional no primeiro rollout.

Aplicar:

- rate limit por IP;
- limite de payload;
- timeout;
- validação de UUID;
- clamp de DPI;
- limite de concorrência;
- CORS explícito;
- `helmet`;
- logs sanitizados.

Não exigir novo header no aplicativo nesta fase.

### Rota v2

Exigir:

```text
LABEL_API_KEY
```

A service role nunca é credencial do consumidor da API.

## 20. Observabilidade

Logs:

```text
request_id
route
method
participant_id_masked
event_id
layout_version_id
renderer=legacy|dynamic
fallback_used
fallback_reason
duration_ms
status
error_code
```

Não registrar:

- nome;
- `extra_answers`;
- custom fields;
- body completo;
- API key;
- service role;
- Base64.

## 21. Health check

Criar:

```http
GET /health
```

Resposta:

```json
{
  "status": "ok",
  "service": "creator-label",
  "version": "x.y.z",
  "dynamic_layout_enabled": false
}
```

## 22. Baseline legado obrigatório

Antes da refatoração, capturar golden images ou hashes para:

```text
nome curto
nome médio
nome longo
duas linhas
regra CPS com subtítulo
sem QR
Base64
PNG
rotation 0
dpi 300
```

A modularização não pode alterar esse baseline sem aprovação.

## 23. Testes obrigatórios

### Contrato legado

- GET;
- POST;
- aliases;
- Base64 com estrutura exata;
- PNG;
- filename;
- nome ausente;
- participante inexistente;
- Supabase indisponível.

### Consulta de contexto

- UUID válido e participante existente;
- participante inexistente;
- `event_id` nulo;
- erro Supabase;
- nenhuma coluna além de `id,event_id`;
- service role ausente mantém fluxo legado.

### Dinâmico

- layout padrão;
- nome;
- categoria;
- dados do evento;
- custom field;
- texto estático;
- fallback;
- `maxCharacters`;
- `wrap`;
- `shrink`;
- `truncate`;
- `hide`;
- QR L/M/Q/H;
- logo;
- logo indisponível;
- elemento oculto;
- evento sem publicação.

### Segurança

- URL privada;
- redirect de imagem;
- payload grande;
- DPI inválido;
- rota v2 sem API key;
- excesso de chamadas;
- logs sem PII.

### Performance

```text
1 request
10 sequenciais
10 simultâneas
50 controladas
```

Medir:

- média;
- p95;
- memória;
- CPU;
- tamanho da resposta;
- cache;
- fallback.

## 24. Infraestrutura

Adicionar:

```text
README.md
.env.example
package-lock.json
render.yaml ou documentação equivalente
scripts de teste
health check
```

Variáveis:

```text
PORT
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_KEY
LABEL_DYNAMIC_LAYOUT_ENABLED
LABEL_DYNAMIC_EVENT_IDS
LABEL_API_KEY
LABEL_LOGO_ALLOWED_HOSTS
LABEL_LAYOUT_CACHE_TTL_SECONDS
LABEL_RATE_LIMIT_MAX
```

Não versionar segredos.

## 25. Entregáveis

```text
docs/plano-motor-dinamico-etiquetas.md
docs/validacao-motor-dinamico-etiquetas.md
README.md
.env.example
src/
tests/
golden/
package-lock.json
configuração de deploy
```

## 26. Critérios de aceite

- [ ] `/badge` continua funcionando sem alteração no aplicativo.
- [ ] Estrutura Base64 preservada.
- [ ] PNG preservado.
- [ ] Baseline legado preservado.
- [ ] Evento resolvido pelo UUID com consulta mínima.
- [ ] Nenhuma RPC adicional criada.
- [ ] Layout publicado lido.
- [ ] Dados resolvidos pela RPC allowlisted.
- [ ] Canvas 800 × 500 convertido corretamente.
- [ ] Perfil 80 × 50 mm / 300 DPI respeitado.
- [ ] Overflow implementado.
- [ ] `maxCharacters` implementado.
- [ ] QR dinâmico implementado.
- [ ] Logo seguro implementado.
- [ ] Campo ausente usa fallback.
- [ ] Evento sem layout usa legado.
- [ ] Feature flag funciona.
- [ ] Allowlist piloto funciona.
- [ ] Rota v2 protegida.
- [ ] Logs sem PII.
- [ ] Health check funciona.
- [ ] Golden images criadas.
- [ ] Performance documentada.
- [ ] Deploy reproduzível.
- [ ] Aplicativo e Bluetooth não foram alterados.

## 27. Gate

```text
criar plano
    ↓
aprovar plano
    ↓
capturar baseline legado
    ↓
modularizar preservando legado
    ↓
implementar consulta mínima + layout dinâmico
    ↓
deploy com flag off
    ↓
validar legado
    ↓
habilitar evento piloto
    ↓
homologação física
```
