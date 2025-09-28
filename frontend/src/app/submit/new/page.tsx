import type { Metadata } from "next"
import Link from "next/link"
import { CreateContestForm } from "@/components/create-contest-form"

export const metadata: Metadata = {
  title: "Create Contest",
  description: "Start a new decentralized contest",
}

export default function CreateContestPage() {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 md:py-12">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-balance text-2xl font-semibold tracking-tight md:text-3xl">Create Contest</h1>
          <Link
            href="/"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            aria-label="Back to dashboard"
          >
            Back to dashboard
          </Link>
        </div>

        <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
          Create a new contest by linking a GitHub repository or by specifying a smart contract address. Provide the key
          details and submit to publish.
        </p>

        <CreateContestForm />
      </div>
    </main>
  )
}
