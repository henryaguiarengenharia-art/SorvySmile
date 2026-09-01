# Sorvy Smile

Plataforma de triagem visual informativa e captação consentida para negócios de
odontologia. Esta branch migra o protótipo do Replit para uma arquitetura
Firebase, reaproveitando a organização validada no SorvyNutri e preservando o
Replit como rollback até a homologação.

> Estado: recuperação do produto pronta para homologação isolada no projeto
> `sorvysmile-homologacao`. A automação desta branch recusa explicitamente o
> projeto de produção `sorvysmile`. O primeiro setup publica somente a camada
> gratuita; `npm run deploy:hml` conclui o backend funcional depois do Blaze e
> do secret Gemini, ainda sem alterar a produção.

## Produto preservado

A migração mantém a experiência original do Sorvy Smile sobre a arquitetura
Firebase. A raiz continua orientada ao paciente e o CTA principal abre a jornada
de triagem quando o link possui um responsável ativo.

- link canônico `/p/{slug}` e compatibilidade com `?p=`, `?d=` e `?c=`;
- foto guiada, consentimento na confirmação da foto e processamento temporário;
- preview antes da captura de nome e WhatsApp;
- relatório informativo e CTAs de agendamento ou pedido de contato;
- destino sempre definido pelo dono do link, sem marketplace público;
- portal individual do dentista e painel consolidado da clínica no Network;
- Post do Dia com biblioteca de 60 conteúdos, seleção diária por perfil,
  personalização isolada, histórico e downloads de Feed e Story;
- Sofia para Pro e Network, com o modo definido pelo papel, histórico, limites
  por conta, contexto anonimizado e confirmação humana; Aury orienta a
  jornada pública com respostas aprovadas, sem diagnóstico.

| Plano | Mensalidade | Triagens/mês | Principal evolução |
|---|---:|---:|---|
| Lite | R$ 97 | 15 | preview, bio link e captação |
| Pro | R$ 197 | 60 | relatório completo, CRM e agendamento |
| Network | R$ 297 | 150 | em breve; equipe, atribuição e KPIs por dentista |

No lançamento, somente Lite e Pro podem ser contratados. O Network aparece
como indisponível e mantém a arquitetura interna para uma fase futura. Não há
venda pública de add-ons ou acessos adicionais. O valor `elite` é tratado
apenas como alias legado e normalizado para `network`.

## Fluxos

Paciente:

1. abre o link da clínica ou do profissional;
2. enquadra o sorriso e confirma maioridade, titularidade e processamento em um
   único aceite antes de clicar em “Analisar meu sorriso”;
3. recebe um preview antes de informar contato;
4. fornece somente nome e WhatsApp;
5. autoriza separadamente o compartilhamento e o contato;
6. recebe o relatório permitido pelo plano e escolhe agendar pelo WhatsApp ou
   pedir que o responsável pelo link entre em contato.

Assinante:

1. escolhe o plano e cria a conta;
2. o backend cria um checkout vinculado à conta e ao preço oficial do plano;
3. conclui o pagamento na InfinitePay sem enviar comprovante à Sorvy;
4. webhook e retorno do navegador reconfirmam a transação na InfinitePay;
5. plano, limites, perfil público e vencimento são liberados automaticamente;
6. no vencimento, o acesso é pausado sem perda de dados e um novo pagamento o
   reativa; a HQ mantém ativação manual somente como contingência auditada.

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
pagamento entram no Vite. A chave da Gemini API fica exclusivamente no Secret
Manager e é disponibilizada somente às Functions de IA.

## Homologação sem Replit

No Google Cloud Shell aberto com a conta que possui
`sorvysmile-homologacao`, execute:

```bash
npm run setup:hml
```

A automação valida o código e as regras, habilita Auth, cria o Firestore em São
Paulo quando necessário, registra o app Web, gera a configuração pública local,
aplica regras e índices, cria um perfil fictício e publica apenas um canal de
Hosting da homologação. Ela não publica Functions, não usa dados reais e não
altera `sorvysmile`.

## Backend funcional e acessos de teste

Depois de ativar o Blaze e informar os valores públicos da homologação,
publique a camada funcional. A automação valida o secret Gemini, autoriza
somente a identidade de runtime da Function, publica em lotes menores e mantém
sete dias de artefatos de build:

```bash
npm run deploy:hml
```

Para reparar somente a integração de foto, sem republicar frontend, Firestore
ou as demais Functions, execute `npm run repair:gemini:hml`. O comando testa a
chave e o modelo multimodal antes de publicar as duas Functions de IA.

Crie HQ e clínica Network por um wrapper idempotente e protegido:

```bash
HML_HQ_EMAIL="email-hq" \
HML_HQ_PASSWORD="senha-forte" \
HML_CLINIC_EMAIL="email-clinica" \
HML_CLINIC_PASSWORD="senha-temporaria-forte" \
HML_CLINIC_WHATSAPP="55DDDNUMERO" \
npm run seed:hml
```

Valide a triagem ponta a ponta com uma foto mantida somente no Cloud Shell:

```bash
HML_SMOKE_IMAGE_PATH="$HOME/foto-sorriso-teste.jpg" npm run smoke:hml
```

O teste confere sessão anônima, validação da foto, análise do sorriso e os três
links InfinitePay; o usuário temporário é removido ao final. A imagem não é
salva no repositório nem no painel.

Os dois comandos recusam `sorvysmile` e aceitam somente
`sorvysmile-homologacao`. Digite credenciais diretamente no Shell; nunca salve
senhas ou chaves no repositório. Crie o segundo dentista pelo painel da clínica
para validar a Function real de gestão de equipe.

## Verificação

```bash
npm run build:all
npm run test:all
npm run test:rules
npm audit --omit=dev
npm --prefix functions audit --omit=dev
git diff --check
```
