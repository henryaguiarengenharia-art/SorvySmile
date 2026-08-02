# Implantação e rollback

## 1. Preparar o Firebase

1. crie ou selecione um projeto dedicado;
2. ative o plano Blaze;
3. crie o Firestore em região compatível com `southamerica-east1`;
4. habilite Authentication por Email/Password e Anonymous;
5. configure a política de senha com no mínimo 10 caracteres;
6. ative a limpeza automática de contas anônimas;
7. registre o aplicativo Web;
8. configure App Check com reCAPTCHA Enterprise;
9. copie `.firebaserc.example` para `.firebaserc` e informe o project ID.

Use um projeto separado de homologação, quando possível.

## 2. Configurar frontend

Copie `.env.example` para `.env.local` e preencha:

- configuração pública do Firebase;
- chave pública do App Check;
- links atuais da InfinitePay para Lite, Pro e Network;
- confirme que o checkout de R$ 497 está identificado como Network antes do corte;
- WhatsApp comercial;
- email público de privacidade;
- slug padrão opcional. Deixe vazio para manter a raiz como página comercial;
  o cliente piloto continuará em `/p/clinica-saude-integrada-bh`.

Esses valores são públicos. Não coloque chave do Gemini, senha ou credencial
administrativa em arquivo `VITE_*`.

## 3. Configurar backend

```bash
firebase functions:secrets:set GEMINI_API_KEY
```

Use somente uma chave vinculada a um projeto com faturamento ativo e confirme a
modalidade contratual adequada ao processamento de fotografias potencialmente
sensíveis. O modelo padrão é configurável por `GEMINI_MODEL`.

## 4. Validar

```bash
npm ci
npm --prefix functions ci
npm run build:all
npm run test:all
npm run test:rules
npm audit --omit=dev
npm --prefix functions audit --omit=dev
git diff --check
```

O emulador do Firestore requer Java 21 ou superior. Faça os testes de regras
antes de qualquer deploy.

## 5. Publicar preview

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage,functions
npm run build
firebase hosting:channel:deploy migracao-smile --expires 14d
```

Não use o domínio final nessa etapa.

## 6. Preparar HQ e piloto

Crie o usuário HQ pelo comando administrativo, digitando os valores apenas no
Shell:

```bash
HQ_EMAIL="email-hq" \
HQ_PASSWORD="senha-forte" \
HQ_NAME="Administração Sorvy" \
npm --prefix functions run seed:hq
```

Depois execute `npm --prefix functions run seed:pilot` com email, senha
temporária, WhatsApp, nome, slug e o plano `network` do cliente piloto. Digite os
valores no Shell; não os salve no histórico do repositório nem envie no chat.
O cliente deve trocar a senha temporária pelo fluxo “Esqueci minha senha”.

## 7. Roteiro de homologação

- link limpo e parâmetros legados;
- consentimento e recusa;
- foto inadequada e limite de tentativas;
- preview antes do contato;
- captura com duas autorizações;
- cota por plano;
- WhatsApp e atualização do funil;
- fila da clínica, atribuição e isolamento por dentista;
- criação, pausa e reativação de acesso da equipe;
- exclusão de lead;
- cadastro de assinante;
- link de pagamento e mensagem do comprovante;
- ativação, pausa e reativação pela HQ;
- isolamento entre duas contas de teste;
- navegação móvel;
- Política de Privacidade e Termos.

## 8. Corte sem interrupção

1. mantenha o Replit ativo;
2. valide o preview com o cliente atual;
3. faça backup e marque a versão que está em uso;
4. publique Firebase Hosting;
5. troque apenas o domínio/link divulgado;
6. monitore erros, uso e conversão por pelo menos sete dias;
7. revogue a chave Gemini e credenciais expostas no protótipo;
8. cancele o Replit apenas depois da estabilização.

Todas as credenciais que ficaram codificadas no protótipo devem ser consideradas
expostas, revogadas e nunca reutilizadas no Firebase.

## Rollback

- restaure o domínio/link para o Replit;
- reverta o Hosting para a versão anterior;
- não apague Firestore, usuários ou secrets;
- corrija em novo canal de preview;
- mantenha o histórico da migração em branch e PR separados.
