# XRPL Stablecoin POC

A proof-of-concept (POC) project for creating, managing, and experimenting with stablecoins and NFTs (XLS-20) on the XRP Ledger (XRPL). This project demonstrates wallet management, stablecoin issuance, NFT minting, offers, and burning, with a modern Next.js frontend and API routes.

## 🚀 Features

### 💰 Stablecoin (SBR)
- **Creation**: Issue SBR stablecoin on XRPL
- **Distribution**: Transfer SBR between wallets
- **Trust Lines**: Automatic trust line setup

### 🎨 NFTs (XLS-20)
- **Mint**: Mint individual or batch NFTs (up to 200 per batch)
- **Gallery**: View NFTs grouped by collection
- **Offers**: Create, accept, and cancel NFT sell offers
- **Burn**: Burn NFTs (irreversible)

### 🛠️ Setup & Wallets
- **Automatic Wallet Generation**: 4 roles (issuer, hot, seller, buyer)
- **Faucet Integration**: Automatic funding on TESTNET
- **Mainnet Support**: Production-ready for XRPL Mainnet (requires real XRP)

## 📦 Folder Structure

```
├── app/           # Next.js pages and API routes
├── components/    # React UI components
├── hooks/         # React hooks for business logic
├── lib/           # Utilities and helpers
├── types/         # TypeScript type definitions
├── data/          # Local data storage (dev only)
├── public/        # Static assets
```

## ⚙️ Configuration

### Environment Variables
- `XRPL_NETWORK` - XRPL network to use (`TESTNET` or `MAINNET`)
- `XRPL_CURRENCY_CODE` - Stablecoin currency code (e.g., `SBR`)
- `XRPL_REQUIRE_AUTH` - Require issuer authorization for trust lines (`true`/`false`)
- `XRPL_MIN_XRP` - Minimum XRP for account reserve (default: 20)

### Network Notes
- **TESTNET**: Automatic funding via faucet
- **MAINNET**: Requires real XRP for transactions
- **Wallet Base**: 1 XRP (activation)
- **NFTs**: 0.2 XRP per NFTokenPage (16-32 NFTs per page)

## 🖥️ Usage

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Configure environment variables:**
   - Copy `.env.example` to `.env.local` and adjust as needed.
3. **Run the development server:**
   ```bash
   npm run dev
   ```
4. **Open your browser:**
   - Visit [http://localhost:3000](http://localhost:3000)

## 📱 Main Pages
- **`/setup`** - Wallet and stablecoin setup
- **`/nft`** - NFT operations (mint, offers, burn)
- **`/nft-gallery`** - NFT gallery by collection
- **`/dashboard`** - Metrics and transaction logs

## 📝 License

MIT
