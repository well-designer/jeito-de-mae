# Jeito de Mãe — Delícias Caseiras

Sistema de pedidos online (estilo iFood) para o restaurante da família:
cardápio com fotos, carrinho, checkout com dados de entrega, **Pix com
confirmação automática**, aviso de pedido novo no WhatsApp e painel
administrativo com login.

Stack: **Next.js 14** (App Router) · **Supabase** (Postgres + login + fotos) ·
**Mercado Pago** (Pix) · **WhatsApp Cloud API** (avisos).

---

## Vercel ou Railway?

**Use a Vercel.** Motivos, na ordem que importa para vocês agora:

| | Vercel | Railway |
|---|---|---|
| Plano grátis | Sim, sem cartão, sem prazo | US$ 5 de crédito/mês; acabou, o app cai |
| Next.js | É de quem fez o Next | Funciona, mas você configura na mão |
| Webhook do Mercado Pago | Funciona direto | Funciona |
| Custo quando crescer | Só se passar do Hobby | Cobra por hora ligada |

O Railway só compensa depois, se vocês quiserem algo que precise de um
processo rodando o tempo todo (impressão automática de comanda na cozinha,
por exemplo). Hoje não é o caso — e "não gastar agora" é o seu critério.

O banco **não** vai na Vercel: fica no Supabase, que também tem plano grátis
permanente (500 MB de banco e 1 GB de fotos, muito além do que um
restaurante de bairro consome).

Custo total hoje: **R$ 0/mês**, fora as taxas do Mercado Pago por venda.

---

## Passo a passo do deploy

### 1. Supabase

1. Crie uma conta em https://supabase.com e um projeto novo (região São Paulo).
2. Abra **SQL Editor**, cole todo o conteúdo de `supabase/schema.sql` e rode.
3. Em **Authentication → Users → Add user**, crie o login de vocês
   (e-mail + senha). Marque "Auto Confirm User".
4. Copie o UUID do usuário criado e rode no SQL Editor:
   ```sql
   insert into public.perfis (id, nome, papel)
   values ('COLE-O-UUID-AQUI', 'Mãe', 'admin');
   ```
   Repita para cada pessoa que vai ter acesso ao painel.
   **Quem não estiver nessa tabela não entra, mesmo tendo conta.**
5. Em **Settings → API**, copie: `Project URL`, `anon public` e
   `service_role` (essa última é secreta).

### 2. GitHub

```bash
cd jeito-de-mae
git init
git add .
git commit -m "Sistema de pedidos Jeito de Mae"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/jeito-de-mae.git
git push -u origin main
```

O `.gitignore` já impede que o `.env` vá junto. **Nunca** comite chaves.

### 3. Vercel

1. https://vercel.com → **Add New → Project** → importe o repositório.
2. Em **Environment Variables**, cadastre tudo que está em `.env.example`.
3. Deploy. Anote a URL final e volte para preencher `NEXT_PUBLIC_SITE_URL`
   com ela, depois faça um redeploy.

### 4. Mercado Pago

1. https://www.mercadopago.com.br/developers/panel → crie uma aplicação.
2. Copie o **Access Token de produção** para `MP_ACCESS_TOKEN`.
3. Em **Webhooks → Configurar notificações**, cadastre:
   `https://SEU-SITE.vercel.app/api/webhooks/mercadopago`
   evento **Pagamentos**. Copie a **chave secreta** para `MP_WEBHOOK_SECRET`.
4. Teste com um Pix de R$ 0,01 antes de divulgar.

> A conta precisa ser do CPF/CNPJ de quem recebe. O dinheiro cai na conta
> Mercado Pago e vocês transferem para o banco quando quiserem.

### 5. WhatsApp — sem tomar ban

**Não use** whatsapp-web.js, Baileys, Venom, Z-API não oficial ou bot rodando
num celular antigo. Todos se passam pelo WhatsApp Web, violam os termos e o
banimento do número é rotina — e levaria junto o WhatsApp comercial da família.

O caminho certo é a **WhatsApp Cloud API**, oficial da Meta e gratuita para o
volume de vocês:

1. https://developers.facebook.com → criar app do tipo **Business**.
2. Adicione o produto **WhatsApp**, pegue o `Phone Number ID` e gere um token
   permanente (System User com permissão `whatsapp_business_messaging`).
3. Em **Message Templates**, crie um template chamado `novo_pedido`,
   categoria **Utility**, idioma **Português (BR)**, com este corpo:

   ```
   Novo pedido {{1}} de {{2}}. Itens: {{3}}. Total: {{4}}.
   ```

   A aprovação costuma sair em minutos.
4. Preencha `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` e `WHATSAPP_DESTINO`
   (número que recebe o aviso, formato `5511999999999`).

O aviso dispara sozinho quando o Pix é confirmado, ou na hora do pedido
quando o pagamento é em dinheiro.

---

## Rodando na sua máquina

```bash
npm install
cp .env.example .env.local   # preencha as variáveis
npm run dev                  # http://localhost:3000
```

Painel em `/admin` (redireciona para `/login` se não estiver logado).

Para testar o webhook local, use `ngrok http 3000` e aponte a URL do
Mercado Pago para o endereço temporário do ngrok.

---

## Como a segurança foi montada

Vocês vão guardar nome, telefone e endereço de clientes. A LGPD trata isso
como dado pessoal, então o projeto já nasce assim:

- **RLS ligado e sem policies em todas as tabelas.** Nenhum navegador lê o
  banco direto. Mesmo que alguém descubra a URL do Supabase e a chave `anon`
  (que é pública por natureza), as consultas voltam vazias. Todo acesso passa
  pelo servidor do Next.js.
- **A `service_role` key só existe no servidor.** Ela nunca é importada em
  arquivo com `'use client'`. Se vazasse, daria acesso total ao banco.
- **Preços recalculados no servidor.** O navegador manda só qual produto e
  qual tamanho. Quem editar o JSON para mandar "feijoada por R$ 1" recebe o
  preço real de volta.
- **Webhook com assinatura HMAC conferida.** Sem isso, qualquer pessoa
  chamaria a URL e marcaria pedidos como pagos sem ter pagado.
- **O webhook não acredita no que recebe:** ele consulta a API do Mercado
  Pago para saber o status verdadeiro do pagamento.
- **Duas barreiras no painel:** middleware bloqueia a rota e cada endpoint
  confere de novo sessão + presença na tabela `perfis`.
- **Toda entrada validada com Zod** (tamanho, formato, limites) antes de
  tocar no banco.
- **Rate limit** por IP na criação de pedidos, contra flood de trote.
- **Cabeçalhos de segurança** (CSP, HSTS, X-Frame-Options) em `next.config.mjs`.
- **Vocês nunca veem cartão.** O Mercado Pago cuida do pagamento; o sistema
  só guarda o id da transação.
- Mensagem de erro do login é genérica de propósito: não revela se o e-mail
  existe.

### O que ainda vale fazer depois
- Ativar 2FA nas contas Supabase, Vercel, GitHub e Mercado Pago.
- Publicar uma política de privacidade curta no rodapé (exigência da LGPD).
- Apagar pedidos com mais de 6 meses — dado que não existe não vaza.
- Trocar o rate limit em memória por Upstash Redis se o movimento crescer.

---

## Controle financeiro

A aba **Financeiro** do painel mostra, para hoje / esta semana / semana passada /
este mês / tudo:

- número de vendas, faturamento, ticket médio e quantas foram entrega
- quebra dia a dia ("Segunda — 20 vendas — R$ 500,00")
- total por forma de pagamento (Pix e dinheiro separados)
- Pix ainda não confirmado, contado à parte para não inflar o faturamento

O botão **Baixar planilha** gera um CSV que abre direto no Excel e no Google
Planilhas, com separador `;` e acentuação correta.

O que conta como venda: pedido não cancelado que já foi pago no Pix, ou pedido
em dinheiro. Pix pendente e pedido cancelado ficam de fora do faturamento e
aparecem separados — assim o número que vocês olham é dinheiro que entrou de
verdade.

Nada disso exigiu mudança no banco: os dados já estavam na tabela `pedidos`.

---

## Estrutura

```
src/
  app/
    page.js                      cardápio público (renderizado no servidor)
    login/page.js                login do painel
    admin/page.js                painel (protegido)
    api/
      pedidos/route.js           cria pedido + cobrança Pix
      pedidos/status/route.js    a tela do Pix consulta aqui
      webhooks/mercadopago/      confirmação automática do pagamento
      admin/relatorio/route.js   relatório financeiro + exportação CSV
      admin/...                  cardápio, config, pedidos, upload de fotos
  components/
    Loja.jsx                     interface do cliente
    Admin.jsx                    interface do painel
  lib/
    supabaseAdmin.js             acesso ao banco (só servidor)
    supabaseServer.js            sessão + porteiro do painel
    mercadopago.js               Pix e validação de assinatura
    whatsapp.js                  aviso de pedido novo
    validation.js                schemas Zod
    rateLimit.js                 limite por IP
supabase/schema.sql              tabelas, RLS, storage e cardápio inicial
middleware.js                    bloqueia /admin sem sessão
```

---

## Atualização: banner, logo, preço com desconto e avaliação

Essa leva de mudança é aditiva — não apaga nada do que já está rodando.
Ordem segura para aplicar:

1. **Rode a migração no Supabase primeiro.** Abra o SQL Editor e execute
   `supabase/migration_2_banner_avaliacao.sql`. Ela só acrescenta colunas
   (`banner_url`, `nota_media`, `total_avaliacoes`) — o site no ar continua
   funcionando igual, porque o código antigo nem sabe que elas existem.
2. **Suba o código numa branch, não direto na main:**
   ```bash
   git checkout -b banner-e-logo
   git add .
   git commit -m "Banner, logo, preco com desconto e avaliacao"
   git push origin banner-e-logo
   ```
3. A Vercel gera uma URL de prévia para essa branch. Confira lá com calma.
4. Satisfeito? Abra o Pull Request no GitHub e clique em **Merge**. Só nesse
   momento o site principal (o que seus pais usam) atualiza.

### O que mudou

- **Logo**: `public/logo.png` — a logo que você mandou, já otimizada
  (1,7 MB → 247 KB) para não pesar no carregamento. Aparece no cabeçalho
  do site e sobreposta ao banner, igual ao efeito do iFood.
- **Banner**: campo novo em Configurações → Banner do topo. Sobe a imagem
  pelo próprio painel, tamanho recomendado 1200 × 400 px.
- **Preço "de/por"**: no editor de cada item, o campo "De" é opcional —
  preencha só quando o prato estiver com desconto. O site calcula e mostra
  o percentual sozinho (ex.: -34%). O valor cobrado no pedido sempre usa o
  "por", nunca o "de" — o desconto é só visual.
- **Avaliação no topo**: nota e quantidade preenchidas manualmente em
  Configurações (peguem do Google ou WhatsApp de vocês). Um sistema de
  avaliação real, onde o próprio cliente avalia pelo site, é um recurso
  maior — exige identificar quem já comprou e moderar comentários. Dá para
  construir depois, como uma etapa separada.

### Tipografia e emojis de placeholder

Ainda não mexi nisso — me diga o nome da fonte (ou o estilo que você quer)
e se prefere trocar o emoji de placeholder por um ícone neutro, que eu
ajusto tudo numa passada só, na mesma branch.

---

## Atualização: tipografia e remoção total dos emojis

- **Tipografia**: trocada para a pilha de fontes do sistema (`-apple-system,
  BlinkMacSystemFont, 'Helvetica Neue', Helvetica, 'Segoe UI', Roboto, Arial`).
  Em iPhone e Mac isso renderiza a **Helvetica Neue de verdade**, nativa do
  aparelho — sem custo de licença e sem carregar arquivo de fonte externo.
  Em Windows/Android cai num Arial muito parecido. O Google Fonts (Fraunces
  + Inter) foi removido do projeto: o site ficou mais leve e a política de
  segurança (CSP) mais enxuta, já que não depende mais de nenhum domínio
  externo para fontes.
  Se vocês comprarem a licença da Helvetica Now de verdade (Adobe Fonts ou
  Monotype), mandem os arquivos `.woff2` (Regular e Bold) que eu hospedo
  dentro do próprio projeto e troco a pilha por ela.
- **Emojis**: removidos de toda a interface. Onde não há foto de um prato,
  agora aparece um ícone de linha neutro (`IconePrato.jsx`); o mesmo vale
  para o placeholder do banner (`IconeImagem.jsx`) e para a tela de pedido
  confirmado, que ganhou um ícone de check no lugar da tigela.

## Como publicar esta leva de mudanças

Essa atualização é só de front-end — não mexe no banco, então não precisa
rodar nada no Supabase. Suba assim:

```bash
# dentro da pasta do projeto, com os arquivos deste zip já sobrescritos
git checkout -b visual-sem-emoji
git add .
git commit -m "Tipografia Helvetica e remocao dos emojis"
git push origin visual-sem-emoji
```

A Vercel comenta automaticamente no push com o link de prévia (algo como
`jeito-de-mae-git-visual-sem-emoji-SEU-USUARIO.vercel.app`). Abra esse link
no celular pra ver como ficou. Gostou? Abra o Pull Request no GitHub e
clique em **Merge** — só nesse momento o site principal atualiza.
