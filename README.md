# XRPL Stablecoin POC

Um projeto de demonstração (POC) para criação e gerenciamento de stablecoins e NFTs na XRP Ledger (XRPL).

## 🚀 Funcionalidades

### 💰 Stablecoin (SBR)
- **Criação**: Emitir stablecoin SBR na XRPL
- **Distribuição**: Transferir SBR entre wallets
- **Balances**: Visualizar saldos de XRP e SBR
- **Trust Lines**: Configurar linhas de confiança automáticas

### 🎨 NFTs (XLS-20)
- **Mint**: Criar NFTs individuais ou em lote (até 200)
- **Ofertas**: Criar, aceitar e cancelar ofertas de venda
- **Galeria**: Visualizar NFTs agrupados por coleção
- **Burn**: Queimar NFTs (irreversível)

### 🔧 Configuração
- **Wallets**: Geração automática de 4 wallets (issuer, hot, seller, buyer)
- **Rede**: Suporte para TESTNET e MAINNET
- **Faucet**: Fundação automática na TESTNET

## 🛠️ Como Executar

### Pré-requisitos
- Node.js 18+
- npm ou yarn

### Instalação
```bash
npm install
```

### Desenvolvimento
```bash
npm run dev
```

### Produção
```bash
npm run build
npm start
```

## 📱 Páginas

- **`/`** - Dashboard principal
- **`/setup`** - Configuração de wallets e stablecoin
- **`/nft`** - Operações de NFTs (mint, ofertas, burn)
- **`/nft-gallery`** - Galeria de NFTs

## 🔧 Configuração

### Variáveis de Ambiente
```env
XRPL_NETWORK=TESTNET  # ou MAINNET
XRPL_WS_URL=wss://s.altnet.rippletest.net:51233
```

### TESTNET vs MAINNET
- **TESTNET**: Fundação automática via faucet
- **MAINNET**: Requer XRP real para transações

## 💡 Regras de Reserva XRPL

- **Wallet Base**: 1 XRP (ativação)
- **Trust Lines**: 0.2 XRP cada
- **NFTs**: 0.2 XRP por NFTokenPage (16-32 NFTs por página)
- **Offers**: 0.2 XRP cada

## 🏗️ Arquitetura

- **Frontend**: Next.js 15 + React + Tailwind CSS
- **Backend**: Next.js API Routes
- **Blockchain**: XRPL SDK
- **Storage**: Vercel KV (dados persistentes)

## 📁 Estrutura

```
src/
├── app/           # Páginas Next.js
├── components/    # Componentes React
├── hooks/         # Custom hooks
├── lib/           # Utilitários e helpers
└── types/         # Definições TypeScript
```

## 🚨 Avisos

- **MAINNET**: Use apenas com XRP real
- **Burn NFT**: Ação irreversível
- **Private Keys**: Mantenha seguras

## 📄 Licença

MIT
