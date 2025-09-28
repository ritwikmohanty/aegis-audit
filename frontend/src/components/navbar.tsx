"use client"

import Image from "next/image"
import Link from "next/link"
import { WalletButton } from '@/components/wallet-button'

const links = [
  { href: "#transactions", label: "My Transactions" },
  { href: "#bets", label: "My Bets" },
  { href: "#profile", label: "Profile" },
]

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-white backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 md:h-18 flex items-center justify-between gap-3">
        {/* Left: logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0" aria-label="Home">
          <Image src="/dash.png" width={28} height={28} alt="Project logo" />
          <span className="font-semibold tracking-tight">DeBet</span>
        </Link>

        {/* Center: nav links (hidden on small) */}
        <nav className="hidden md:flex items-center gap-6">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Right: wallet button */}
        <div className="flex items-center">
          <WalletButton />
        </div>
      </div>
    </header>
  )
}
