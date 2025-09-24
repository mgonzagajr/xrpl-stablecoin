'use client';

import Link from 'next/link';

export default function Header() {
  return (
    <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-6">
          <Link href="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 bg-gradient-to-r from-purple to-green rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">X</span>
            </div>
            <h1 className="text-2xl font-bold text-gradient">XRPL Stablecoin</h1>
          </Link>
          
          <nav className="hidden md:flex space-x-8">
            <Link 
              href="/setup" 
              className="text-gray-600 hover:text-purple transition-colors font-medium"
            >
              Setup
            </Link>
            <Link 
              href="/dashboard" 
              className="text-gray-600 hover:text-purple transition-colors font-medium"
            >
              Dashboard
            </Link>
            <Link 
              href="/nft" 
              className="text-gray-600 hover:text-purple transition-colors font-medium"
            >
              NFTs
            </Link>
            <Link 
              href="/nft-gallery" 
              className="text-gray-600 hover:text-purple transition-colors font-medium"
            >
              Gallery
            </Link>
          </nav>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button className="text-gray-600 hover:text-purple transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
