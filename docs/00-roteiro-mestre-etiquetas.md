# Roteiro mestre — Configuração dinâmica de etiquetas por evento

**Data:** 2026-07-30  
**Projetos envolvidos:** `web-dks/sistema-credenciamento-dks` e `web-dks/creator-label`

## Objetivo

Permitir que cada evento possua um layout de etiqueta configurável e versionado, mantendo o aplicativo atual e o contrato legado de impressão funcionando sem alterações no primeiro MVP.

## Premissas fechadas

1. A impressão atual é realizada exclusivamente pelo aplicativo.
2. O aplicativo conecta-se à impressora por Bluetooth.
3. O aplicativo chama `GET /badge` no `creator-label`.
4. O UUID do participante é o dado dinâmico essencial.
5. O contrato legado `/badge` deve continuar funcionando.
6. O padrão atual permanece: 80 × 50 mm, 300 DPI, landscape e Base64.
7. O conteúdo do QR continua sendo `participants.id`.
8. O sistema de credenciamento será a fonte das configurações.
9. O `creator-label` será o motor de renderização.
10. Evento sem layout publicado utiliza o layout legado.
11. O aplicativo não será alterado no primeiro MVP.
12. A arquitetura deve suportar futuros perfis de impressão sem liberá-los para edição agora.

## Ordem obrigatória

### Fase 1 — Fundação no credenciamento

Executar:

```text
01-spec-credenciamento-fundacao-etiquetas.md
```

Entrega:

- tabelas;
- RLS;
- catálogo de campos;
- templates;
- versões;
- publicação;
- clone;
- RPCs;
- contrato do renderer.

### Fase 2 — Editor no credenciamento

Executar:

```text
02-spec-credenciamento-editor-etiquetas.md
```

Entrega:

- tela administrativa;
- rascunho;
- elementos;
- prévia;
- publicação;
- rollback;
- duplicação.

### Fase 3 — Motor dinâmico no creator-label

Executar:

```text
03-spec-creator-label-motor-dinamico.md
```

Entrega:

- modularização;
- leitura do layout publicado;
- resolução de dados;
- renderização;
- fallback legado;
- novas rotas;
- preservação de `/badge`.

### Fase 4 — Integração e homologação

Executar:

```text
04-spec-integracao-validacao-etiquetas.md
```

Entrega:

- testes físicos;
- regressão do aplicativo;
- performance;
- rollback;
- piloto controlado.

## Dependências

```text
Fase 1 → Fase 2 → Fase 3 → Fase 4
```

Não iniciar o `creator-label` antes de existir:

- modelo de dados aprovado;
- contrato de layout;
- catálogo fechado;
- RPC segura;
- layout padrão funcional.

## Escopo do MVP

Incluído:

- um layout padrão por evento;
- versões `draft`, `published` e `archived`;
- nome;
- QR;
- categoria;
- texto fixo;
- campo dinâmico permitido;
- logo opcional;
- prévia;
- publicação;
- fallback legado;
- Base64 e PNG;
- 80 × 50 mm;
- 300 DPI;
- landscape.

Fora do MVP:

- editor totalmente livre;
- múltiplas impressoras editáveis;
- impressão direta pelo navegador;
- alteração do aplicativo;
- layout por categoria;
- histórico de reimpressão;
- portrait em produção;
- QR customizado;
- campos sensíveis.

## Resultado esperado

```text
administrador configura layout
    ↓
salva rascunho
    ↓
visualiza prévia
    ↓
publica versão
    ↓
aplicativo chama /badge
    ↓
creator-label identifica evento
    ↓
busca layout publicado
    ↓
gera Base64
    ↓
aplicativo imprime via Bluetooth
```
