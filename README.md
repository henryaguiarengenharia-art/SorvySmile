# Sorvy Smile

Plataforma de triagem visual informativa e captação consentida para negócios de
odontologia. Esta branch migra o protótipo do Replit para uma arquitetura
Firebase, reaproveitando a organização validada no SorvyNutri e preservando o
Replit como rollback até a homologação.

> Estado: código de migração pronto para preview. Ainda não publicar em produção
> sem configurar o projeto Firebase, a API paga do Gemini, App Check e o único
> cliente piloto. Os três links e valores da InfinitePay foram verificados.

## Produto simplificado

O antigo Network foi retirado do fluxo comercial. Cada cliente possui:

- uma conta e um acesso profissional;
- um link canônico `/p/{slug}`;
- um destino único para os leads;
- um painel de captação, contato e acompanhamento;
- cotas progressivas de triagens validadas no servidor.

Não há marketplace, escolha de dentista pelo paciente, distribuição de leads,
equipe por assento ou administração de rede.

A raiz do site é comercial. Somente um link profissional explícito direciona a
triagem e o lead a um cliente.

| Plano | Mensalidade | Triagens/mês | Principal evolução |
|---|---:|---:|---|
| Lite | R$ 149 | 15 | preview, bio link e captação |
| Pro | R$ 297 | 60 | relatório completo, CRM e agendamento |
| Elite | R$ 497 | 150 | assistente e automação liberados por etapas |

Os preços e limites foram confirmados para esta migração. O valor legado
`network` é aceito apenas para migração de dados e normalizado para `elite`.

## Fluxos

Paciente:

1. abre o link do profissional;
2. confirma maioridade, titularidade da foto e consentimento específico;
3. valida a foto e recebe um preview antes de informar contato;
4. fornece somente nome e WhatsApp;
5. autoriza separadamente o compartilhamento e o contato;
6. recebe o relatório permitido pelo plano e segue ao WhatsApp do profissional.

Assinante:

1. escolhe o plano e cria a conta;
2. a solicitação fica pendente no painel HQ;
3. abre o link de pagamento já usado pela operação;
4. envia o comprovante por WhatsApp com a referência da conta;
5. a HQ confere e ativa o plano e o link profissional.

## Arquitetura

- React 19, TypeScript e Vite no Firebase Hosting;
- Firebase Authentication com email/senha e acesso anônimo à triagem;
- Cloud Firestore para contas, perfis, leads, consentimentos e uso;
- Callable Functions com App Check para regras autoritativas e IA;
- Gemini acessado somente pela Function com chave no Secret Manager;
- regras do Firestore isoladas por conta;
- Firebase Storage bloqueado: a Sorvy não persiste a foto da triagem;
- exclusão automática de sessões expiradas e leads após 12 meses.

Consulte:

- [Fluxos e planos](docs/FLOWS_AND_PLANS.md)
- [Arquitetura e segurança](docs/ARCHITECTURE.md)
- [Implantação e rollback](docs/DEPLOYMENT.md)

## Desenvolvimento

Pré-requisitos: Node.js 22 e Java 21+ para o emulador.

```bash
cp .env.example .env.local
npm ci
npm --prefix functions ci
npm run build:all
npm run test:all
npm run test:rules
```

Somente a configuração pública do aplicativo Firebase e os links públicos de
pagamento entram no Vite. `GEMINI_API_KEY` deve existir apenas no Secret
Manager.

## Cliente piloto

Crie primeiro o acesso HQ por um comando administrativo idempotente:

```bash
HQ_EMAIL="email-hq" \
HQ_PASSWORD="senha-forte" \
HQ_NAME="Administração Sorvy" \
npm --prefix functions run seed:hq
```

O seed é idempotente. Ele exige que o plano seja escolhido explicitamente:

```bash
PILOT_EMAIL="email-do-cliente" \
PILOT_PASSWORD="senha-temporaria-forte" \
PILOT_WHATSAPP="55DDDNUMERO" \
PILOT_NAME="Clínica Saúde Integrada BH" \
PILOT_SLUG="clinica-saude-integrada-bh" \
PILOT_PLAN="elite" \
npm --prefix functions run seed:pilot
```

Execute apenas no projeto Firebase correto. Digite credenciais diretamente no
Shell; nunca envie senhas ou chaves no chat nem as salve no repositório. O
cliente deve trocar a senha temporária pelo fluxo “Esqueci minha senha”.

## Verificação

```bash
npm run build:all
npm run test:all
npm run test:rules
npm audit --omit=dev
npm --prefix functions audit --omit=dev
git diff --check
```
