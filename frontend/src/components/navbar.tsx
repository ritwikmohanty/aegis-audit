"use client"

import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { WalletButton } from "@/components/wallet-button"
import { Menu } from "lucide-react"

const links = [
  { href: "/", label: "Markets" },
  { href: "/submit", label: "Submit" },
  { href: "#transactions", label: "My Transactions" },
]

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-white backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 md:h-18 flex items-center justify-between gap-3">
        {/* Left: logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0" aria-label="Home">
          <Image src="/logo.png" width={28} height={28} alt="Project logo" />
          <span className="font-semibold tracking-tight">Aegis</span>
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

        {/* Right: wallet */}
        <div className="hidden md:flex items-center gap-3">
          <WalletButton />
        </div>

        {/* Mobile: menu */}
        <div className="md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle className="text-left">Menu</SheetTitle>
              </SheetHeader>
              <div className="mt-4 flex flex-col gap-4">
                {links.map((l) => (
                  <Link key={l.href} href={l.href} className="text-base font-medium text-foreground">
                    {l.label}
                  </Link>
                ))}
                <div className="mt-2">
                  <WalletButton />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
