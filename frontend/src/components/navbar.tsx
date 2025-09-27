"use client"

import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { WalletWidget } from "@/components/wallet"
import { Menu } from "lucide-react"

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

        {/* Right: auth + wallet */}
        <div className="hidden md:flex items-center gap-3">
          <Button variant="outline" className="rounded-md bg-transparent">
            Login / Signup
          </Button>
          <WalletWidget />
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
                <Button variant="outline" className="w-full rounded-md mt-2 bg-transparent">
                  Login / Signup
                </Button>
                <div className="mt-2">
                  <WalletWidget compact />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
