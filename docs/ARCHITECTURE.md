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
| `users` | próprio usuário ou HQ | nenhuma |
| `accounts` | mesma conta ou HQ | nenhuma |
| `professionals` | HQ; clínica da conta; dentista lê o próprio perfil | campos seguros e Functions de equipe |
| `leads` | HQ; clínica da conta; dentista lê somente os atribuídos | CRM; criação e atribuição via Function |
| `triageSessions` | nenhuma | nenhuma |
| `usage` | mesma conta ou HQ | nenhuma |
| `usageReservations` | nenhuma | nenhuma |

Plano, cota, vínculo de conta, perfil público e status da assinatura são
autoritativos no servidor.

## Foto e IA

- JPEG, PNG e WebP;
- no máximo 5 MB no navegador e no backend;
- consentimento específico antes da primeira chamada;
- confirmação de maioridade e de que a foto pertence ao usuário;
- até três tentativas de validação por sessão;
- hash impede analisar uma imagem diferente da que foi validada;
- a faixa Bom/Atenção/Avaliação é calculada deterministicamente a partir do
  índice de harmonia e nunca representa urgência clínica;
- a Sorvy não grava a foto no Firestore, Storage ou lead;
- a orientação de câmera usa landmarks e luminosidade processados somente no
  aparelho; nenhum quadro do vídeo é persistido ou enviado;
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

## Consentimentos e retenção

- versão atual de consentimento: `2026-07`;
- foto, contato e privacidade têm campos separados;
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
