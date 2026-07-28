# Fluxos e planos

## Decisão de produto

O plano Network anterior combinava assinatura, equipe, distribuição de leads e
marketplace. Com um cliente ativo, isso aumentava telas, permissões e estados
sem gerar valor proporcional.

O novo desenho segue a estrutura validada do SorvyNutri: uma conta, um link,
um painel e um destino inequívoco para cada triagem. “Network” sobrevive apenas
como valor legado convertido para Elite durante a leitura de dados antigos.

## Jornada do paciente

| Etapa | Dados | Resultado |
|---|---|---|
| Landing | nenhum | proposta e responsável pelo link |
| Consentimento | versão, data, maioridade e titularidade | autorização específica para a foto |
| Foto | imagem temporária | validação de enquadramento |
| Preview | nenhum contato | harmonia e brilho aparentes |
| Captura | nome + WhatsApp | autorizações separadas de compartilhamento e contato |
| Relatório | dados já autorizados | leitura visual permitida pelo plano |
| Conversão | WhatsApp | conversa direta com o profissional do link |

O profissional é resolvido pelo slug no início. O sistema mantém os formatos
legados `?d=slug`, `?c=slug` e `?p=slug`; o endereço canônico é `/p/slug`.
Sem slug, a página principal permanece comercial e não encaminha o lead para
um cliente por padrão.

## Jornada do profissional

1. acessa o painel com Firebase Authentication;
2. vê novos leads e consumo mensal;
3. inicia a conversa pelo WhatsApp;
4. registra status, primeiro contato e agendamento;
5. edita cidade, UF, bio e mensagens permitidas pelo plano;
6. exclui um lead quando solicitado pelo titular.

O Lite recebe funil simples. Pro e Elite recebem CRM completo,
templates, alertas e agendamento. O Post do Dia permanece como apoio prático do
modelo validado no Nutri.

## Jornada comercial

1. entender o benefício para o negócio;
2. comparar Lite, Pro e Elite;
3. criar conta com aceite versionado;
4. abrir o link de pagamento do plano;
5. enviar o comprovante com a referência gerada;
6. HQ localizar a conta pendente e conferir o pagamento;
7. HQ ativar plano, usuário e link público;
8. assinante receber confirmação e entrar no painel.

A ativação é deliberadamente manual nesta primeira fase. Ela reproduz o fluxo
já validado no Nutri e evita introduzir um novo gateway/webhook antes de haver
volume que justifique essa complexidade.

## Planos confirmados

| Recurso | Lite | Pro | Elite |
|---|---:|---:|---:|
| Mensalidade confirmada | R$ 149 | R$ 297 | R$ 497 |
| Triagens mensais | 15 | 60 | 150 |
| Link profissional | sim | sim | sim |
| Preview visual | sim | sim | sim |
| Relatório completo | não | sim | sim |
| CRM, templates e agendamento | não | sim | sim |
| Assistente especializado | não | não | por etapas |

O assistente do Elite aparece como “em validação” até ter fluxo, limites,
mensagens e supervisão homologados. Nenhuma tela deve prometer uma automação
que ainda não funciona.

## Fora do escopo da primeira produção

- marketplace público;
- escolha ou ranking de profissionais;
- distribuição e redistribuição de leads;
- clínicas com múltiplos assentos;
- gamificação competitiva;
- atendimento autônomo por IA;
- ativação automática por webhook.

Esses itens só devem voltar como módulos separados, guiados por demanda real.
