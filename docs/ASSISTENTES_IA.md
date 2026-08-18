# Assistentes de IA — arquitetura oficial

## Decisão de produto

- **Lite:** sem acesso à Sofia.
- **Pro:** Sofia Conversão e Sofia Gestão para o profissional solo, sempre restritas aos próprios dados.
- **Network:** Sofia Gestão para o gestor da clínica e Sofia Conversão para cada profissional, sempre com isolamento por conta e profissional.
- **Trial existente:** não é duplicado. Quando a conta elegível está em trial, a Sofia permite até 10 interações totais, preserva o histórico e bloqueia novas mensagens ao atingir o limite ou a data final.

O valor legado `elite` continua normalizado para `network`. A regra atual Pro/Network substitui a antiga restrição exclusiva ao Network.

## Identidades

| Identidade | Público | Implementação |
| --- | --- | --- |
| Aury | paciente | guia determinístico com respostas aprovadas; não recebe foto nem contato |
| Sofia Conversão | profissional | priorização de leads, follow-up e rascunhos revisáveis |
| Sofia Gestão | gestor ou profissional solo | indicadores, gargalos e até três prioridades |
| Sofia Comercial | interessado | definição versionada pronta para canal comercial futuro |
| Personalizada | paciente de conta/profissional Pro ou Network | vinculada por `accountId` e, quando aplicável, `professionalId` |

Conversão e Gestão são modos da mesma Sofia. Não existem personagens concorrentes para esses modos.

## Diagnóstico da versão anterior

A versão anterior possuía um único painel genérico, uma única chamada Gemini e limite fixo de 40 solicitações por usuário/dia. Não havia conversa persistida, limite mensal por conta, consumo de tokens, custo configurável, ação confirmável, feedback, configuração por cliente, definições versionadas ou Aury pública.

## Fluxo seguro da Sofia

1. O frontend solicita o workspace da assistente.
2. O backend valida autenticação, conta, plano, status, papel e profissional.
3. O backend calcula limites por conta e período.
4. O contexto é construído com métricas agregadas ou com um lead anonimizado.
5. Telefone, email e imagem não entram no contexto do modelo.
6. A interação é reservada de forma transacional.
7. O Gemini responde em JSON validado por schema.
8. Pergunta sanitizada e resposta ficam na conversa autorizada.
9. Tokens, custo configurado e eventos ficam em coleções separadas.
10. Uma mudança de status permanece `proposed` até a confirmação explícita do usuário que recebeu a sugestão.

Falhas do modelo exibem fallback seguro e não executam ações.

## Contextos

### Conversão

- visão geral anonimizada das prioridades do funil;
- status, idade, tempo sem contato, consentimento de contato e agendamento;
- categoria informativa estruturada quando já existente;
- nenhum nome, telefone, email, fotografia ou conversa integral é enviado ao modelo;
- mensagens retornam como rascunhos com o marcador `[NOME]`.

### Gestão

- período explícito de 30 dias, comparação com os 30 dias anteriores e visão geral acumulada;
- quantidade por etapa, conversão, tempo médio de resposta e leads sem atendimento;
- distribuição anonimizada da equipe apenas para gestor Network;
- profissional individual recebe somente os próprios indicadores;
- uso agregado do Post do Dia;
- no máximo três prioridades por resposta.

## Limites

Valores iniciais:

- 100 interações por conta/mês;
- 20 interações por conta/dia;
- 10 interações durante o trial.

Os três limites e os custos por milhão de tokens são editáveis pela HQ em `accountAssistantSettings`, sem alteração do frontend. O bloqueio sempre ocorre no backend.

## Coleções

| Coleção | Finalidade |
| --- | --- |
| `assistantDefinitions` | identidades globais e versões |
| `assistantKnowledge` | conhecimento aprovado e versionado |
| `accountAssistantSettings` | habilitação e limites por conta |
| `customAssistantProfiles` | identidade pública específica por conta/profissional |
| `assistantConversations/{id}/messages` | histórico sanitizado e isolado |
| `assistantUsage` | solicitações, tokens, custo e uso diário |
| `assistantActions` | ações propostas e confirmação humana |
| `assistantAuditLogs` | eventos operacionais sem conteúdo sensível |

O navegador não escreve diretamente nessas coleções. Todas as mutações passam por Callable Functions.

## Callables

- `getAssistantWorkspace`
- `askBusinessAssistant`
- `resolveAssistantAction`
- `recordAssistantFeedback`
- `recordAssistantClientEvent`
- `getAssistantAdminSettings`
- `getAssistantAdminOverview`
- `updateAssistantSettings`
- `updateCustomAssistantProfile`

## Aury

A Aury usa respostas determinísticas para explicar jornada, uso temporário da foto, natureza informativa da triagem e contato. Ela é montada fora de `PatientJourney.tsx`; assim, o arquivo protegido da triagem permanece byte a byte intacto.

Uma identidade personalizada é publicada apenas nos perfis públicos da conta ou do profissional explicitamente selecionado. A HQ configura nome, saudação, tom, vocabulário, contexto institucional, conhecimento aprovado, cores, imagens e CTA. Alterar slug não muda o vínculo, pois a origem permanece `accountId`/`professionalId`.

Avatares e imagens completas são enviados pela HQ em PNG/WebP, validados no navegador (dimensão e tamanho), protegidos por regras do Storage e versionados no perfil. O sistema nunca gera ou troca uma personagem automaticamente.

## Deploy de homologação

O script `npm run deploy:hml` publica regras, índices e todas as novas Functions e executa `seedAssistantDefinitions.js`. O seed aceita somente `sorvysmile-homologacao`.

## Critérios cobertos

- definições separadas para Aury e os modos da Sofia;
- Pro e Network habilitados; Lite bloqueado no backend e sem aba funcional;
- modos também validados no backend: gestor Network usa Gestão, profissional da equipe usa Conversão e profissional solo pode usar ambos;
- isolamento por conta e por profissional;
- nenhum telefone, email ou fotografia no contexto;
- prompt resistente a instruções contidas nos dados;
- histórico preservado;
- limites mensais, diários e de trial;
- ações externas somente após confirmação;
- feedback, tokens, custo, erro e bloqueio auditados;
- configuração personalizada sem vínculo por slug;
- triagem validada preservada.
