# Fluxos e planos

## Decisão de produto

A infraestrutura muda para Firebase, mas o produto não é reinterpretado. A
jornada do paciente, o portal individual e o painel de clínica/equipe são
preservados. O Network continua como terceiro plano. Marketplace público,
ranking e escolha aleatória de profissional permanecem fora do produto.

## Jornada do paciente

| Etapa | Dados | Resultado |
|---|---|---|
| Landing | nenhum | proposta e responsável pelo link |
| Sorriso guiado + consentimento | enquadramento local da boca, imagem temporária, versão, maioridade, titularidade e processamento reunidos em um aceite | confirmação “Analisar meu sorriso” |
| Descoberta | nenhum contato | índice visual, quatro indicadores aparentes e insight em linguagem simples |
| Captura | nome + WhatsApp | autorizações separadas de compartilhamento e contato |
| Mapa | dados já autorizados | painel visual, pontos para conversar e próximo passo permitido pelo plano |
| Conversão | escolha registrada | conversa direta ou pedido de contato ao profissional do link |

O profissional é resolvido pelo slug no início. O sistema mantém os formatos
legados `?d=slug`, `?c=slug` e `?p=slug`; o endereço canônico é `/p/slug`.
Sem responsável ativo, a página mantém o CTA de triagem visível, mas não cria um
lead sem destino. Em homologação, o slug piloto pode ser definido por ambiente.

## Jornada do profissional

1. acessa o painel com Firebase Authentication;
2. vê novos leads e consumo mensal;
3. inicia a conversa pelo WhatsApp;
4. registra status, primeiro contato e agendamento;
5. edita cidade, UF, bio e mensagens permitidas pelo plano;
6. altera com segurança o slug e a foto exibidos na vitrine;
7. consulta o Post do Dia e indicadores de 7/30/90 dias ou gerais;
8. exclui um lead quando solicitado pelo titular.

O Lite recebe funil simples. Pro e Network recebem CRM completo,
templates, alertas e agendamento. O Post do Dia permanece como apoio prático do
modelo validado no Nutri.

## Jornada comercial

1. entender o benefício para o negócio;
2. comparar Lite, Pro e Network;
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

| Recurso | Lite | Pro | Network |
|---|---:|---:|---:|
| Mensalidade confirmada | R$ 149 | R$ 297 | R$ 497 |
| Triagens mensais | 15 | 60 | 150 |
| Link profissional | sim | sim | sim |
| Preview visual | sim | sim | sim |
| Relatório completo | não | sim | sim |
| CRM, templates e agendamento | não | sim | sim |
| Gestão e atribuição de equipe | não | não | sim |
| KPIs por dentista (7/30/90 dias) | não | não | sim |
| Sofia — Conversão e Gestão | não | sim | sim |
| Acessos incluídos | 1 | 1 | 2 |
| Acesso adicional | — | — | R$ 79 |

Add-ons confirmados: +50 leads por R$ 99 e +150 leads por R$ 249. Registros com
o valor legado `elite` são normalizados para `network`.

## Fora do escopo da primeira produção

- marketplace público;
- escolha ou ranking de profissionais;
- distribuição automática ou aleatória de leads;
- gamificação competitiva;
- atendimento autônomo por IA (as assistentes implementadas são apoio humano revisável);
- ativação automática por webhook.

O painel Network permite atribuição manual e auditável dentro da própria clínica.
