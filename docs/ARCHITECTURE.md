# Arquitetura e segurança

## Componentes

| Componente | Responsabilidade |
|---|---|
| Firebase Hosting | aplicação React e rotas SPA |
| Firebase Authentication | pacientes anônimos, profissionais e HQ |
| Cloud Firestore | contas, perfis, leads, consentimentos e uso |
| Callable Functions | sessão, regras de negócio, IA e administração |
| Secret Manager | chave da API do Gemini |
| App Check | reduzir chamadas automatizadas e repetição de tokens |
| InfinitePay/link configurado | pagamento fora da aplicação |

## Isolamento de dados

| Coleção | Leitura do cliente | Escrita do cliente |
|---|---|---|
| `publicProfiles` | somente perfil ativo por slug | nenhuma |
| `publicSlugAliases` | consulta pontual para preservar links antigos | nenhuma |
| `dailyPosts` | legado preservado para migração e auditoria | nenhuma |
| `dailyPostTemplates` | HQ lê todos; assinante lê somente publicados | nenhuma |
| `professionalContentPreferences` | HQ, profissional e gestor da própria conta | nenhuma |
| `dailyPostAssignments` | HQ, profissional e gestor da própria conta | nenhuma |
| `dailyPostEvents` | somente HQ | nenhuma |
| `users` | próprio usuário ou HQ | nenhuma |
| `accounts` | mesma conta ou HQ | nenhuma |
| `professionals` | HQ; clínica da conta; dentista lê o próprio perfil | campos seguros e Functions de equipe |
| `leads` | HQ; clínica da conta; dentista lê somente os atribuídos | CRM; criação e atribuição via Function |
| `triageSessions` | nenhuma | nenhuma |
| `usage` | mesma conta ou HQ | nenhuma |
| `usageReservations` | nenhuma | nenhuma |
| `adminAuditLogs` e `subscriptionHistory` | somente HQ | nenhuma |
| `assistantUsage` e `assistantAudit` | nenhuma | nenhuma |

Plano, cota, vínculo de conta, perfil público e status da assinatura são
autoritativos no servidor.

## Foto e IA

- JPEG, PNG e WebP;
- no máximo 5 MB no navegador e no backend;
- consentimento específico antes da primeira chamada;
- aceite único e destacado reúne maioridade, titularidade e processamento temporário;
- até três tentativas de validação por sessão;
- hash impede analisar uma imagem diferente da que foi validada;
- a faixa Bom/Atenção/Avaliação é calculada deterministicamente a partir do
  índice de harmonia e nunca representa urgência clínica;
- o índice visual geral mostrado ao paciente é a média aritmética dos índices
  aparentes de harmonia, brilho, simetria, alinhamento e refletividade; serve
  somente para resumir a leitura e não é escore clínico;
- a Sorvy não grava a foto no Firestore, Storage ou lead;
- a orientação de câmera usa landmarks e luminosidade processados somente no
  aparelho; a interface destaca a boca e recorta o sorriso antes da confirmação;
  nenhum quadro do vídeo é persistido ou enviado;
- a Function envia a imagem temporariamente à API paga do Gemini;
- a sessão expira em 30 minutos e é removida por tarefa agendada;
- o resultado é informativo e não deve afirmar diagnóstico.

“Não armazenamos a foto” descreve apenas os sistemas da Sorvy. Logs de segurança
e processamento do fornecedor seguem os contratos e termos da API paga.

## Cotas e concorrência

A Function verifica a assinatura e reserva uma unidade de uso em transação antes
da análise. Se a chamada ao Gemini falhar, a reserva é devolvida. Uma sessão já
analisada retorna o resultado existente e não consome nova unidade.

A validação inicial da foto também possui teto mensal por conta: até três
tentativas para cada triagem incluída no plano. Falhas do provedor devolvem a
tentativa. A primeira produção limita a escala das Functions a cinco instâncias,
com concorrência controlada, como proteção adicional de custo.

As assistentes operacionais do Network têm limite de 40 solicitações por usuário
por dia. O contexto enviado não inclui nome, telefone, email ou foto; um
profissional individual recebe somente indicadores dos próprios leads, enquanto
o gestor da clínica recebe os indicadores consolidados da conta.

## Consentimentos e retenção

- versão atual de consentimento: `2026-07`;
- uso da imagem, contato e privacidade têm autorizações separadas; maioridade,
  titularidade e processamento ficam reunidos no aceite específico da imagem;
- data, versão e responsável pelo link ficam registrados;
- leads expiram após 365 dias;
- o profissional ou a HQ pode excluir antes;
- fotos nunca são anexadas ao lead.
- o clique para abrir o WhatsApp e o pedido para receber contato são registrados
  sem criar novos dados de contato e ajudam a priorizar o atendimento no painel.

## Pagamento

Os links de pagamento são públicos e configurados por ambiente no frontend.
A criação da conta pendente, o preço solicitado e a versão dos termos são
registrados no servidor. A HQ confere o comprovante e usa uma Callable Function
restrita para ativar, pausar ou marcar inadimplência.

## Pendências para produção

- revisão jurídica dos textos e identificação formal do controlador;
- confirmar nome Network no checkout da InfinitePay sem alterar o link atual;
- projeto Firebase Blaze e região;
- API paga do Gemini e Secret Manager;
- App Check com reCAPTCHA Enterprise;
- criação do usuário HQ;
- credenciais e WhatsApp do cliente piloto Network;
- teste das regras no emulador com Java 21+.

## Operação HQ, trial e arquivamento

- Toda alteração administrativa recebe `accountId` e `professionalId` explícitos;
  o UID do administrador nunca é usado como alvo do cliente.
- O trial do profissional dura sete dias e fica persistido em
  `trialStartedAtMs`, `trialEndsAtMs` e `trialStatus`. A tarefa
  `expireProfessionalTrials` desativa acessos vencidos e o perfil público sem
  apagar leads.
- Arquivar é reversível: marca `status: archived`, desativa o acesso e preserva
  leads, sessões de conversa, pagamentos e histórico. Restaurar recompõe o
  estado anterior quando a conta ainda está ativa.
- Ações de HQ geram documentos em `adminAuditLogs` e `subscriptionHistory`.
  A HQ pode consultar o histórico, mas não há escrita direta pelo navegador.
- A HQ cria, duplica, programa, publica, desativa e arquiva templates do Post do
  Dia. A cada 15 minutos, o backend efetiva agendamentos e prepara a atribuição
  determinística por `professionalId` e data local.
- O seed idempotente mantém os 60 templates iniciais com IDs fixos. Cada
  atribuição salva um snapshot; alterações posteriores não reescrevem o histórico.
- Personalizações e eventos ficam isolados por profissional. Feed e Story são
  gerados em PNG com 1080 × 1350 e 1080 × 1920, sem publicação na vitrine.
- Os painéis separam indicadores de 7, 30 e 90 dias da visão geral acumulada.
- O painel Network oferece assistentes de Gestão e Conversão. Elas geram apoio
  operacional revisável e não realizam atendimento, diagnóstico ou prescrição.
- A alteração de slug é transacional e cria um alias público para que o endereço
  anterior continue resolvendo para o perfil atual.
