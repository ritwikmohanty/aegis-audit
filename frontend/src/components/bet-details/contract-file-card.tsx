"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
export default function ContractFileCard({
  fileName,
  code,
}: {
  fileName: string
  code: string
}) {
  const [open, setOpen] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
    } catch (e) {
      console.log("[v0] copy failed", e)
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">{fileName}</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={copy}>
            Copy
          </Button>
          <Button size="sm" onClick={() => setOpen((v) => !v)}>
            {open ? "Hide" : "View"}
          </Button>
        </div>
      </CardHeader>
      {open ? (
        <CardContent>
          <pre className="max-h-80 overflow-auto rounded-md bg-muted p-4 text-xs leading-6">
            <code>{code}</code>
          </pre>
        </CardContent>
      ) : null}
    </Card>
  )
}
