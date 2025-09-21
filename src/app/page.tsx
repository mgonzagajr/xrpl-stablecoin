import Link from "next/link";
import Header from "@/components/Header";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Home - XRPL Stablecoin POC",
  description: "A complete Proof of Concept for XRPL wallet management, stablecoin operations, and NFT marketplace with XLS-20 support.",
};

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <Header />

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            XRPL <span className="text-gradient">Stablecoin</span>
          </h1>
          <p className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto">
            A complete Proof of Concept for XRPL wallet management, stablecoin operations, 
            and NFT marketplace with XLS-20 support.
          </p>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="card text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple to-purple/80 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">💳</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Wallet Management</h3>
              <p className="text-gray-600">Generate and manage XRPL wallets with auto-faucet funding</p>
            </div>

            <div className="card text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-green to-green/80 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🪙</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Stablecoin Operations</h3>
              <p className="text-gray-600">Issue and distribute SBR tokens with trust line management</p>
            </div>

            <div className="card text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple to-green rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🎨</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">NFT Marketplace</h3>
              <p className="text-gray-600">Complete XLS-20 flow with mint, trade, and gallery features</p>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/setup"
              className="btn-primary text-lg px-8 py-4 rounded-xl flex items-center space-x-2"
            >
              <span>🚀</span>
              <span>Setup XRPL Wallets</span>
            </Link>
            <Link
              href="/nft"
              className="btn-secondary text-lg px-8 py-4 rounded-xl flex items-center space-x-2"
            >
              <span>🎨</span>
              <span>Explore NFTs</span>
            </Link>
          </div>

          {/* Quick Stats */}
          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-purple mb-2">4</div>
              <div className="text-gray-600">Wallet Types</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green mb-2">XLS-20</div>
              <div className="text-gray-600">NFT Standard</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple mb-2">100%</div>
              <div className="text-gray-600">Open Source</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green mb-2">POC</div>
              <div className="text-gray-600">Ready</div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white/80 backdrop-blur-sm mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-gradient-to-r from-purple to-green rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">X</span>
              </div>
              <span className="text-gray-600">XRPL Stablecoin POC</span>
            </div>
            <div className="flex space-x-6">
              <a
                href="https://xrpl.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-purple transition-colors"
              >
                XRPL.org
              </a>
              <a
                href="https://github.com/mgonzagajr/xrpl-stablecoin"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-purple transition-colors"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
