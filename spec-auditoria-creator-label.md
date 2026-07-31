# Spec de auditoria — Serviço `creator-label`

**Projeto:** `web-dks/creator-label`  
**Fase:** 1 — Análise AS-IS  
**Tipo:** Auditoria técnica e funcional  
**Objetivo:** compreender integralmente o serviço atual de geração de etiquetas antes de qualquer refatoração ou implementação dinâmica  
**Status:** Pronta para execução no Cursor

---

## 1. Regra principal desta fase

Nesta etapa, **não implementar alterações**.

O Cursor deverá apenas:

1. analisar o repositório;
2. executar o serviço localmente, quando possível;
3. mapear o fluxo atual;
4. identificar limites, dependências e riscos;
5. criar o documento de auditoria;
6. apresentar decisões pendentes;
7. aguardar aprovação.

Não criar rotas novas, banco, editor, layouts dinâmicos ou refatorações antes da aprovação da auditoria.

---

## 2. Contexto

O `creator-label` é responsável por gerar a imagem PNG utilizada na impressão das etiquetas dos participantes.

Atualmente, o serviço:

- recebe dados pela rota `/badge`;
- aceita `GET` e `POST`;
- recebe nome, QR, DPI, rotação, formato e limites de caracteres;
- pode consultar o participante no Supabase;
- utiliza o UUID do participante como conteúdo do QR;
- lê `name` e `extra_answers`;
- possui regras específicas de evento no código;
- gera PNG ou Base64;
- utiliza Canvas e `qrcode`;
- possui layout, fontes, posições e limites definidos diretamente no código.

A intenção futura é transformá-lo em um motor genérico de renderização, mas esta spec trata somente da auditoria AS-IS.

---

## 3. Objetivos da auditoria

A análise deverá responder:

- Como o serviço é iniciado e publicado?
- Quais são todas as rotas disponíveis?
- Quais parâmetros são aceitos?
- Quais valores são obrigatórios, opcionais e possuem fallback?
- Como o participante é consultado?
- Qual chave autentica o acesso ao Supabase?
- O serviço usa anon key ou service role?
- Quais dados são lidos?
- Quais regras de negócio estão hardcoded?
- Como o nome é quebrado, truncado e renderizado?
- Como o QR é gerado?
- Quais dimensões e DPIs são realmente suportados?
- Como a rotação funciona?
- Quais fontes são utilizadas?
- Como o serviço reage a dados inválidos?
- Como funciona o fallback quando o Supabase não está disponível?
- Qual contrato o aplicativo de impressão espera?
- Quais pontos precisam permanecer retrocompatíveis?
- Quais partes devem ser separadas em módulos numa evolução futura?
- Quais riscos existem para múltiplos eventos simultâneos?

---

## 4. Arquivos e estrutura do projeto

Mapear todos os arquivos do repositório, incluindo possíveis itens como:

```text
package.json
index.js
.env.example
render.yaml
Dockerfile
Procfile
fonts/
public/
tests/
scripts/
```

Os nomes acima são exemplos. O Cursor deve confirmar quais existem.

Para cada arquivo relevante, documentar:

- finalidade;
- dependências;
- variáveis de ambiente;
- impacto no runtime;
- necessidade de manutenção;
- possíveis arquivos obsoletos;
- ausência de testes;
- ausência de documentação.

---

## 5. Dependências

Analisar:

```text
express
@supabase/supabase-js
@napi-rs/canvas
canvas
qrcode
dotenv
```

Documentar:

- versão;
- finalidade;
- uso real;
- compatibilidade com o ambiente de deploy;
- dependência opcional ou obrigatória;
- riscos de atualização;
- dependências sem uso;
- dependências ausentes para testes, validação ou segurança.

---

## 6. Runtime e deploy

Identificar:

- ambiente de hospedagem;
- comando de start;
- porta;
- variáveis de ambiente;
- health check;
- política de restart;
- logs;
- memória e CPU;
- timeout;
- concorrência;
- limite de payload;
- limite de resposta;
- política de cache;
- CORS;
- autenticação da API;
- acesso público;
- restrições de rede.

Documentar se o serviço está no Render ou em outro provedor e como é publicado.

Não alterar infraestrutura nesta fase.

---

## 7. Contrato atual da API

Auditar completamente:

```text
GET /badge
POST /badge
```

Mapear todos os parâmetros aceitos, inclusive aliases.

Exemplos a confirmar:

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

Para cada parâmetro, informar:

- tipo;
- obrigatório ou opcional;
- default;
- mínimo e máximo;
- aliases;
- sanitização;
- comportamento inválido;
- impacto no layout;
- presença nos consumidores atuais.

Documentar respostas:

- PNG binário;
- JSON Base64;
- erros 400;
- erros 500;
- headers;
- nome do arquivo;
- MIME type.

Criar uma tabela de contrato AS-IS.

---

## 8. Consulta ao Supabase

Mapear:

- variáveis usadas;
- URL;
- tipo de chave;
- schema;
- tabela;
- campos consultados;
- filtro;
- comportamento em erro;
- comportamento sem configuração;
- exposição de credenciais;
- nível de privilégio.

Confirmar o uso de:

```text
SUPABASE_URL
SUPABASE_KEY
SUPABASE_PARTICIPANTS_TABLE
SUPABASE_SCHEMA
SUPABASE_NAME_FIELD
SUPABASE_QR_FIELD
```

Verificar se todas são realmente usadas.

Documentar:

- se há chave com privilégios excessivos;
- se existe risco de leitura de participantes de outros eventos;
- se a consulta valida `event_id`;
- se apenas o UUID é suficiente;
- se o serviço pode consultar qualquer participante;
- se seria mais seguro usar RPC ou endpoint intermediário no futuro.

---

## 9. Dados utilizados e regras hardcoded

Documentar todos os dados usados para renderização:

```text
participants.id
participants.name
participants.extra_answers
```

Identificar regras hardcoded, incluindo:

```text
Área de atuação CPS
Unidade
Adm. Central/ Polos Regionais
Pós-Graduação
Etec
Fatec
```

Para cada regra:

- origem;
- resultado;
- motivo provável;
- evento ou cliente associado;
- possibilidade de generalização;
- risco de regressão;
- equivalente futuro em configuração dinâmica.

Mapear também campos declarados no código, mas sem uso efetivo.

---

## 10. Motor de renderização

Auditar `renderBadgePng` e funções relacionadas.

Documentar:

- tamanho físico;
- tamanho virtual;
- DPI;
- conversão mm → px;
- orientação base;
- rotação;
- margens;
- paddings;
- posições;
- tamanhos de fonte;
- QR;
- fundo;
- cor;
- alinhamento;
- ordem de desenho;
- comportamento quando elementos ultrapassam a área.

Criar um mapa do layout atual:

```text
área virtual
├── bloco do nome
├── segunda linha
├── subtítulo
└── QR Code
```

Registrar todos os valores hardcoded em uma tabela:

```text
constante
valor
unidade
finalidade
impacto
```

---

## 11. Fontes

Analisar:

- fontes presentes no repositório;
- ordem de busca;
- diferenças entre `@napi-rs/canvas` e `canvas`;
- fallback do sistema;
- peso;
- registro;
- consistência entre local e produção;
- licença das fontes;
- comportamento quando não encontra a fonte.

Não compartilhar ou exportar arquivos de fonte.

Documentar somente nomes, origem e uso técnico.

---

## 12. Tratamento de nomes

Auditar:

```text
truncateToMaxChars
splitNameIntoTwoLines
```

Testar e documentar:

- nome vazio;
- uma palavra;
- duas palavras;
- nomes longos;
- sobrenomes compostos;
- caracteres acentuados;
- hífen;
- apóstrofo;
- caracteres internacionais;
- espaços duplicados;
- emojis;
- nomes acima de 100 caracteres.

Confirmar:

- limite padrão atual;
- limite por linha;
- lógica de balanceamento;
- fallback greedy;
- forma de truncamento;
- uso de ponto em vez de reticências;
- perda de sobrenomes;
- risco de texto sair da área mesmo dentro do limite de caracteres.

Registrar explicitamente que número de caracteres não garante largura visual.

---

## 13. Subtítulo e `extra_answers`

Auditar:

```text
parseExtraAnswers
displayLineFromExtraAnswers
wrapSubtitleLines
```

Testar:

- objeto;
- JSON string;
- JSON inválido;
- valor nulo;
- chave ausente;
- valor longo;
- caracteres especiais;
- mais de uma linha;
- campo vazio;
- regras CPS.

Documentar o limite real de linhas do subtítulo e verificar se ele pode ocupar o espaço do QR.

---

## 14. QR Code

Mapear:

- conteúdo;
- geração;
- nível de correção;
- margem;
- cor;
- tamanho;
- posição;
- limite mínimo;
- leitura após impressão;
- comportamento quando o participante não existe;
- comportamento sem Supabase;
- comportamento com QR arbitrário.

Confirmar se o QR deve continuar sendo apenas:

```text
participants.id
```

Identificar qualquer risco de permitir texto livre.

---

## 15. Segurança

Verificar:

- autenticação da rota;
- CORS;
- rate limit;
- abuso da rota pública;
- logs com dados pessoais;
- logs com UUID;
- logs do body completo;
- exposição da chave Supabase;
- tratamento de erros;
- stack traces;
- payload máximo;
- geração massiva;
- negação de serviço por DPI alto;
- limite de caracteres não controlado;
- headers de segurança.

Documentar riscos por severidade:

```text
crítico
alto
médio
baixo
```

---

## 16. Performance e concorrência

Testar ou estimar:

- tempo médio por imagem;
- uso de memória;
- efeito de 300 DPI;
- efeito de 1200 DPI;
- geração simultânea;
- consulta ao Supabase por impressão;
- inicialização de fontes;
- geração do QR;
- PNG;
- Base64;
- cold start;
- limite do ambiente de deploy.

Cenários:

```text
1 requisição
10 simultâneas
50 simultâneas
100 simultâneas
```

Não executar carga agressiva em produção.

---

## 17. Observabilidade

Mapear:

- logs existentes;
- logs excessivos;
- logs de sucesso;
- logs de erro;
- correlação por requisição;
- duração;
- status;
- participante;
- evento;
- ausência de métricas.

Recomendar, sem implementar:

- request ID;
- log estruturado;
- duração;
- status;
- erro seguro;
- ambiente;
- versão do layout.

---

## 18. Compatibilidade e consumidores

Identificar consumidores conhecidos:

- sistema de credenciamento;
- aplicativo;
- totem;
- serviço de impressão;
- integrações externas;
- chamadas manuais.

Buscar no GitHub por:

```text
creator-label
/badge
format=base64
maxLine1
maxLine2
rotation
badge.png
```

Documentar:

- URL usada;
- método;
- payload;
- retorno esperado;
- dependência do formato atual;
- risco de mudar a rota.

A rota atual deverá ser tratada como contrato legado compatível.

---

## 19. Testes obrigatórios da auditoria

Criar uma matriz de testes local.

### Dados

- nome curto;
- nome médio;
- nome longo;
- nome composto;
- nome internacional;
- subtítulo curto;
- subtítulo longo;
- subtítulo vazio;
- participante existente;
- participante inexistente.

### Layout

- 72 DPI;
- 300 DPI;
- 600 DPI;
- 1200 DPI;
- rotação 0;
- rotação 90;
- rotação 180;
- rotação 270;
- PNG;
- Base64;
- QR presente;
- QR ausente.

### Erros

- nome ausente;
- DPI inválido;
- rotação inválida;
- formato inválido;
- JSON inválido;
- Supabase indisponível;
- chave inválida.

Salvar somente evidências técnicas permitidas, sem expor dados reais.

---

## 20. Entregável obrigatório

Criar:

```text
docs/auditoria-creator-label-as-is.md
```

O documento deverá conter:

1. resumo executivo;
2. arquitetura atual;
3. mapa de arquivos;
4. dependências;
5. deploy;
6. contrato da API;
7. variáveis de ambiente;
8. consulta ao Supabase;
9. dados utilizados;
10. regras hardcoded;
11. layout atual;
12. limites;
13. tratamento de nomes;
14. subtítulo;
15. QR;
16. segurança;
17. performance;
18. observabilidade;
19. consumidores;
20. testes executados;
21. riscos;
22. dívida técnica;
23. capacidades reutilizáveis;
24. pontos que precisam mudar;
25. decisões pendentes;
26. perguntas para o aplicativo/impressora;
27. recomendações para a próxima fase.

---

## 21. Saída padronizada para cruzamento

Ao final, incluir uma seção chamada:

```text
Contrato de integração necessário para o sistema de credenciamento
```

Ela deverá informar:

- identificadores mínimos;
- dados que o serviço deve receber;
- dados que ele pode buscar;
- formato de layout esperado;
- versionamento;
- fallback;
- preview;
- render final;
- erros;
- autenticação;
- cache;
- compatibilidade.

Essa seção será cruzada com a auditoria do sistema principal.

---

## 22. Encerramento da fase

Após criar `docs/auditoria-creator-label-as-is.md`, o Cursor deverá:

1. resumir os achados;
2. listar riscos críticos;
3. listar dúvidas;
4. indicar o que pode ser reaproveitado;
5. indicar o que deverá ser refatorado;
6. parar;
7. aguardar aprovação.

Não implementar a Fase 2.
