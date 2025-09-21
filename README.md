# XRPL Stablecoin - Wallet Management System

Um sistema de gerenciamento de carteiras XRPL para Proof of Concept (POC) desenvolvido com Next.js 14, TypeScript e Tailwind CSS.

## 🚀 Funcionalidades

- **Inicialização de Carteiras**: Gera automaticamente 4 carteiras XRPL (issuer, hot, seller, buyer)
- **Configuração XRPL**: Define flags do emissor e cria trust lines para tokens fungíveis
- **Emissão de Tokens**: Issue de SBR do emissor para hot wallet
- **Distribuição de Tokens**: Transferência de SBR da hot para buyer wallet
- **Operações NFT (XLS-20)**: Mint, criação de ofertas, aceitação e queima de NFTs
- **Coleções de NFT**: Suporte a NFTokenTaxon para agrupar NFTs em coleções
- **NFT Gallery**: Visualização completa de metadados, imagens e traits de NFTs
- **Queima de NFTs**: Funcionalidade para queimar NFTs (seller e buyer)
- **Visualização de Saldos**: Exibição de saldos XRP e SBR para todas as wallets
- **Sistema de Idempotência**: Geração automática de chaves sequenciais para todas as operações
- **Cache IPFS Inteligente**: Cache local com controle de concorrência para metadados
- **Persistência Segura**: Armazena segredos apenas no servidor em arquivo JSON
- **APIs Idempotentes**: Endpoints seguros para inicializar carteiras e configurar XRPL
- **Interface Desktop-First**: Páginas responsivas e intuitivas
- **Notificações Toast**: Sistema de notificações não intrusivas

## 🛠️ Tecnologias

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Blockchain**: XRPL SDK v4.4.0
- **Armazenamento**: Sistema de arquivos JSON (desenvolvimento) / Vercel Blob (produção)
- **Configuração**: Variáveis de ambiente para XRPL

## 📁 Estrutura do Projeto

```
src/
├── app/
│   ├── api/
│   │   ├── wallets/
│   │   │   ├── init/route.ts    # API para inicializar carteiras
│   │   │   ├── read/route.ts    # API para ler carteiras
│   │   │   ├── fund/route.ts    # API para fundar carteiras
│   │   │   ├── balances/route.ts # API para saldos das carteiras
│   │   │   └── configuration/route.ts # API para status de configuração
│   │   ├── xrpl/
│   │   │   ├── issuer/flags/route.ts  # API para configurar flags do emissor
│   │   │   ├── trustlines/route.ts    # API para criar trust lines
│   │   │   ├── issue/route.ts         # API para emitir tokens SBR
│   │   │   ├── distribute/route.ts    # API para distribuir tokens SBR
│   │   │   └── balances/route.ts      # API para consultar saldos
│   │   ├── nft/
│   │   │   ├── mint/route.ts          # API para mintar NFTs
│   │   │   ├── list/route.ts          # API para listar NFTs
│   │   │   ├── burn/route.ts          # API para queimar NFTs
│   │   │   └── offer/
│   │   │       ├── create/route.ts    # API para criar ofertas de venda
│   │   │       ├── list/route.ts      # API para listar ofertas
│   │   │       ├── accept/route.ts    # API para aceitar ofertas
│   │   │       └── cancel/route.ts    # API para cancelar ofertas
│   │   ├── idempotency/
│   │   │   └── generate/route.ts      # API para gerar chaves de idempotência
│   │   └── config/route.ts            # API para configurações
│   ├── setup/
│   │   └── page.tsx            # Página de setup
│   ├── nft/
│   │   └── page.tsx            # Página de operações NFT
│   ├── nft-gallery/
│   │   └── page.tsx            # Página de galeria de NFTs
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── CopyButton.tsx          # Componente para copiar endereços
│   ├── Toast.tsx               # Componente de notificação
│   └── ToastContainer.tsx      # Container de notificações
├── hooks/
│   ├── useWallets.ts           # Hook para gerenciar estado das carteiras
│   ├── useXrplOperations.ts    # Hook para operações XRPL
│   ├── useStablecoinOperations.ts # Hook para operações de stablecoin
│   ├── useNFT.ts               # Hook para operações de NFT
│   ├── useConfig.ts            # Hook para configurações
│   └── useToast.ts             # Hook para notificações
├── lib/
│   ├── xrpl-helpers.ts         # Helpers para XRPL
│   ├── issuer-auth.ts          # Helpers para autorização
│   ├── nft-log.ts              # Helpers para log de NFTs
│   ├── ipfs-cache.ts           # Cache local para metadados IPFS
│   ├── ipfs-queue.ts           # Controle de concorrência para IPFS
│   └── idempotency-helper.ts   # Helper para geração de chaves de idempotência
└── types/
    └── wallet.ts               # Tipos TypeScript
```

## ⚙️ Configuração

### Variáveis de Ambiente

#### Configuração Rápida

Para **TESTNET** (recomendado para desenvolvimento):
```bash
cp .env.testnet .env.local
```

Para **MAINNET** (⚠️ use com cuidado):
```bash
cp .env.mainnet .env.local
```

#### Configuração Manual

Ou crie manualmente o arquivo `.env.local` com as seguintes variáveis:

```bash
# XRPL Configuration
# XRPL_WS_URL é automaticamente definida baseada em XRPL_NETWORK
XRPL_NETWORK=TESTNET
XRPL_SOURCE_TAG=846813574

# Stablecoin Configuration
XRPL_CURRENCY_CODE=SBR
XRPL_TRUST_LIMIT=1000000000
XRPL_REQUIRE_AUTH=false
XRPL_NO_FREEZE=false
XRPL_AUTO_FAUCET=true
XRPL_MIN_XRP=20

# Stablecoin Operations
XRPL_DEFAULT_ISSUE=1000000
XRPL_DEFAULT_DISTRIBUTE=100
```

#### Configuração Automática de Rede

O sistema agora detecta automaticamente a URL da rede baseada na variável `XRPL_NETWORK`:

- **TESTNET**: `wss://s.altnet.rippletest.net:51233`
- **MAINNET**: `wss://xrplcluster.com`

Você não precisa mais configurar `XRPL_WS_URL` manualmente! 🎉

### Instalação

```bash
npm install
npm run dev
```

## 🔐 Segurança

⚠️ **IMPORTANTE**: Este é um projeto POC. NÃO use em produção!

- **Segredos nunca são expostos**: Seeds e chaves privadas ficam apenas no servidor
- **Validação de ambiente**: Verificação rigorosa das variáveis de ambiente
- **APIs seguras**: Respostas não incluem informações sensíveis

## 📡 APIs

### POST /api/wallets/init
Inicializa as carteiras (idempotente).

**Resposta de sucesso:**
```json
{
  "ok": true,
  "created": true,
  "data": {
    "network": "TESTNET",
    "sourceTag": 12345,
    "wallets": [
      {"role": "issuer", "address": "r..."},
      {"role": "hot", "address": "r..."},
      {"role": "seller", "address": "r..."},
      {"role": "buyer", "address": "r..."}
    ]
  }
}
```

### GET /api/wallets/read
Lê as carteiras existentes.

**Resposta de sucesso:**
```json
{
  "ok": true,
  "data": {
    "network": "TESTNET",
    "sourceTag": 12345,
    "wallets": [...]
  }
}
```

**Resposta quando não inicializado:**
```json
{
  "ok": false,
  "error": "NOT_INITIALIZED"
}
```

### POST /api/xrpl/issuer/flags
Configura as flags do emissor (idempotente).

**Resposta de sucesso:**
```json
{
  "ok": true,
  "data": {
    "issuer": {
      "address": "r...",
      "flags": {
        "defaultRipple": true,
        "requireAuth": false,
        "noFreeze": false
      }
    },
    "changed": true
  }
}
```

### POST /api/xrpl/trustlines
Cria trust lines para o token (idempotente).

**Resposta de sucesso:**
```json
{
  "ok": true,
  "data": {
    "currency": "SBR",
    "limit": "1000000000",
    "results": [
      {
        "role": "hot",
        "address": "r...",
        "created": true,
        "txHash": "hash..."
      }
    ]
  }
}
```

### POST /api/xrpl/issue
Emite tokens SBR do emissor para hot wallet.

**Body:**
```json
{
  "amount": "1000000",
  "idempotencyKey": "optional-key"
}
```

**Resposta de sucesso:**
```json
{
  "ok": true,
  "data": {
    "txHash": "hash...",
    "amount": "1000000",
    "currency": "SBR",
    "from": "rIssuer...",
    "to": "rHot..."
  }
}
```

### POST /api/xrpl/distribute
Distribui tokens SBR da hot wallet para buyer wallet.

**Body:**
```json
{
  "amount": "100",
  "idempotencyKey": "optional-key"
}
```

**Resposta de sucesso:**
```json
{
  "ok": true,
  "data": {
    "txHash": "hash...",
    "amount": "100",
    "currency": "SBR",
    "from": "rHot...",
    "to": "rBuyer..."
  }
}
```

### GET /api/xrpl/balances
Consulta saldos XRP e SBR de todas as wallets.

**Resposta de sucesso:**
```json
{
  "ok": true,
  "data": {
    "currency": "SBR",
    "entries": [
      {
        "role": "issuer",
        "address": "r...",
        "xrp": "12.345678",
        "sbr": "1000000"
      }
    ]
  }
}
```

## 🎨 APIs de NFT (XLS-20)

### POST /api/nft/mint
Minta um NFT usando a carteira seller.

**Body:**
```json
{
  "uri": "ipfs://QmHash...",
  "transferable": true,
  "taxon": 0,
  "idempotencyKey": "optional-key"
}
```

**Resposta de sucesso:**
```json
{
  "ok": true,
  "data": {
    "nftokenId": "00080000...",
    "txHash": "hash...",
    "uri": "ipfs://QmHash...",
    "transferable": true
  }
}
```

### GET /api/nft/list
Lista NFTs de uma carteira específica.

**Query Parameters:**
- `role`: "seller" ou "buyer"

**Resposta de sucesso:**
```json
{
  "ok": true,
  "data": {
    "role": "seller",
    "nfts": [
      {
        "nftokenId": "00080000...",
        "uri": "ipfs://QmHash..."
      }
    ]
  }
}
```

### POST /api/nft/offer/create
Cria uma oferta de venda de NFT por SBR.

**Body:**
```json
{
  "nftokenId": "00080000...",
  "amount": "100",
  "idempotencyKey": "optional-key"
}
```

**Resposta de sucesso:**
```json
{
  "ok": true,
  "data": {
    "offerIndex": "12345",
    "nftokenId": "00080000...",
    "amount": "100"
  }
}
```

### GET /api/nft/offer/list
Lista ofertas de NFT.

**Query Parameters:**
- `seller`: "1" para ofertas de venda
- `buyer`: "1" para ofertas de compra
- `nftokenId`: ID específico do NFT (opcional)

**Resposta de sucesso:**
```json
{
  "ok": true,
  "data": {
    "offers": [
      {
        "offerIndex": "12345",
        "nftokenId": "00080000...",
        "amount": "100"
      }
    ]
  }
}
```

### POST /api/nft/offer/accept
Aceita uma oferta de venda de NFT.

**Body:**
```json
{
  "offerIndex": "12345",
  "idempotencyKey": "optional-key"
}
```

**Resposta de sucesso:**
```json
{
  "ok": true,
  "data": {
    "txHash": "hash...",
    "offerIndex": "12345"
  }
}
```

### POST /api/nft/offer/cancel
Cancela uma oferta de venda de NFT.

**Body:**
```json
{
  "offerIndex": "12345",
  "idempotencyKey": "optional-key"
}
```

**Resposta de sucesso:**
```json
{
  "ok": true,
  "data": {
    "txHash": "hash...",
    "offerIndex": "12345"
  }
}
```

### POST /api/nft/burn
Queima um NFT (irreversível).

**Body:**
```json
{
  "nftokenId": "00080000...",
  "role": "seller",
  "idempotencyKey": "optional-key"
}
```

**Resposta de sucesso:**
```json
{
  "ok": true,
  "data": {
    "nftokenId": "00080000...",
    "txHash": "hash..."
  }
}
```

### POST /api/idempotency/generate
Gera uma chave de idempotência sequencial.

**Body:**
```json
{
  "prefix": "mint"
}
```

**Resposta de sucesso:**
```json
{
  "ok": true,
  "data": {
    "key": "mint-001",
    "prefix": "mint",
    "id": 1
  }
}
```

## 🎯 Uso

### Configuração Inicial
1. Acesse a página inicial em `/`
2. Clique em "🚀 Setup XRPL Wallets"
3. Na página `/setup`, clique em "Initialize wallets"
4. Visualize as carteiras geradas na tabela
5. Use os botões "Copy" para copiar endereços
6. Configure as flags do emissor clicando em "Set issuer flags"
7. Crie trust lines clicando em "Create trust lines"

### Operações de Stablecoin (SBR)
8. Na seção "Stablecoin (SBR)":
   - Configure o valor de emissão e clique em "Issue SBR to hot"
   - Configure o valor de distribuição e clique em "Distribute SBR to buyer"
   - Use "Refresh balances" para ver saldos XRP e SBR atualizados

### Operações de NFT (XLS-20)
9. Acesse a página `/nft` ou clique em "NFT Operations →" na página de setup
10. **Mint NFT**:
    - Insira um URI de metadados (ipfs:// ou https://)
    - Marque "Transferable" se desejado
    - Configure o "Collection Taxon" para agrupar NFTs
    - Use o botão "Auto" para gerar chave de idempotência
    - Clique em "Mint NFT"
11. **Criar Oferta de Venda**:
    - Selecione um NFT da lista "Seller NFTs"
    - Insira o preço em SBR
    - Use o botão "Auto" para gerar chave de idempotência
    - Clique em "Create sell offer"
12. **Aceitar Oferta**:
    - Selecione uma oferta da lista "Seller Offers"
    - Use o botão "Auto" para gerar chave de idempotência
    - Clique em "Accept offer (Buyer)"
13. **Cancelar Oferta**:
    - Clique no botão "Cancel" ao lado da oferta desejada
    - Confirme a ação na caixa de diálogo
14. **Queimar NFT**:
    - Selecione o owner (Seller ou Buyer)
    - Escolha o NFT para queimar
    - Use o botão "Auto" para gerar chave de idempotência
    - Clique em "Burn NFT (IRREVERSIBLE)"

### NFT Gallery
15. Acesse a página `/nft-gallery` ou clique em "NFT Gallery →" na página de NFT
16. **Visualizar NFTs**:
    - Navegue entre as abas "Seller NFTs" e "Buyer NFTs"
    - Veja metadados completos, imagens e traits
    - Use "Refresh NFTs" para atualizar a lista
    - O sistema carrega metadados automaticamente com cache inteligente

## 🔄 Funcionalidades

### Operações Básicas
- **Inicialização Idempotente**: Pode ser chamada múltiplas vezes sem efeitos colaterais
- **Configuração XRPL Idempotente**: Flags e trust lines são configurados apenas quando necessário
- **Emissão de Tokens**: Issue de SBR do emissor para hot wallet com validações
- **Distribuição de Tokens**: Transferência de SBR da hot para buyer com verificação de saldo
- **Autorização Automática**: Configuração automática de trust lines quando RequireAuth=true

### Operações de NFT (XLS-20)
- **Mint de NFTs**: Criação de NFTs com URI de metadados, flags de transferibilidade e coleções
- **Coleções de NFT**: Suporte a NFTokenTaxon para agrupar NFTs em coleções organizadas
- **Ofertas de Venda**: Criação de ofertas de venda de NFTs por SBR
- **Aceitação de Ofertas**: Compra de NFTs através de ofertas existentes
- **Cancelamento de Ofertas**: Cancelamento de ofertas de venda ativas
- **Queima de NFTs**: Funcionalidade para queimar NFTs (irreversível) - seller e buyer
- **Listagem de NFTs**: Visualização de NFTs por carteira (seller/buyer)
- **Listagem de Ofertas**: Visualização de ofertas ativas de venda/compra
- **NFT Gallery**: Visualização completa de metadados, imagens e traits de NFTs

### Recursos Técnicos
- **Sistema de Idempotência**: Geração automática de chaves sequenciais para todas as operações
- **Cache IPFS Inteligente**: Cache local com controle de concorrência para metadados
- **Controle de Concorrência**: Máximo 2 requisições simultâneas para IPFS com delay de 1s
- **Auto-faucet**: Funda automaticamente carteiras em TESTNET quando necessário
- **Validação de Saldo**: Garante saldo mínimo de XRP antes de executar transações
- **Visualização de Saldos**: Exibição em tempo real de saldos XRP e SBR
- **Cache Local**: Dados são armazenados em localStorage para melhor performance
- **Validação de Rede**: Suporte para TESTNET e MAINNET
- **Source Tags**: Configuráveis via variável de ambiente
- **Notificações Toast**: Sistema de notificações não intrusivas
- **Responsividade**: Interface otimizada para desktop com suporte mobile
- **Atualização Automática**: Listas de ofertas e NFTs se atualizam automaticamente

## 📁 Arquivos de Dados

O sistema cria os seguintes arquivos na pasta `data/`:

- **`wallets.json`**: Armazena as carteiras geradas e status de configuração
- **`txlog.json`**: Log de transações para idempotência (issue/distribute)
- **`nftlog.json`**: Log de operações NFT para idempotência (mint/offer/accept/cancel/burn)
- **`idempotency.json`**: Log de chaves de idempotência sequenciais por prefixo

### Cache Local (localStorage)

- **`ipfs_metadata_cache`**: Cache de metadados IPFS com TTL de 24 horas
- **`xrpl_wallets_cached_v1`**: Cache de carteiras para performance

## 📝 Notas de Desenvolvimento

- As carteiras são geradas usando o SDK oficial do XRPL
- O sistema de armazenamento é baseado em arquivos JSON (adequado para POC)
- Todas as operações são validadas no servidor antes da execução
- O sistema é projetado para ser stateless e reutilizável
- NFTs são criados com NFTokenTaxon configurável para coleções
- Todas as transações incluem SourceTag configurado
- Sistema de notificações toast para feedback do usuário
- Cache IPFS com controle de concorrência para evitar sobrecarga de gateways
- Sistema de idempotência com geração automática de chaves sequenciais
- Atualização automática de listas após operações (ofertas, NFTs)
- Suporte completo ao fluxo XLS-20 (mint, offer, accept, cancel, burn)

## ☁️ Deploy no Vercel

Este projeto está configurado para funcionar tanto em desenvolvimento local quanto em produção no Vercel:

### **Desenvolvimento Local:**
- Usa arquivos JSON na pasta `data/`
- Funciona exatamente como antes
- Sem configuração adicional necessária

### **Produção (Vercel):**
- Usa **Vercel Blob Storage** automaticamente
- Dados persistem entre deployments
- Acesso global e rápido

### **Configuração do Vercel Blob:**

1. **Criar Blob Storage no Vercel:**
   - Acesse o [Vercel Dashboard](https://vercel.com/dashboard)
   - Vá para seu projeto → **Storage** → **Create Database** → **Blob**
   - Dê um nome (ex: `xrpl-stablecoin-storage`)

2. **Configurar Variável de Ambiente:**
   - **Settings** → **Environment Variables**
   - **Name:** `BLOB_READ_WRITE_TOKEN`
   - **Value:** `vercel_blob_rw_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - **Environment:** Production, Preview, Development

3. **Deploy:**
   ```bash
   vercel --prod
   ```

### **Custos:**
- **$0.15/GB/mês** para armazenamento
- **$0.50/milhão** de operações de leitura
- **$5.00/milhão** de operações de escrita

Para um projeto pequeno, os custos são praticamente zero!

## 🚧 Limitações POC

- Sem autenticação ou autorização
- Sem criptografia adicional dos dados
- Sem backup automático
- Armazenamento local em desenvolvimento (produção usa Vercel Blob)

## 📄 Licença

Este projeto é para fins educacionais e de POC.
