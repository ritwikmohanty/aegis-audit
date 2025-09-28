"use client"

import { Badge } from "@/components/ui/badge"
import { useState, useEffect } from "react"

export default function RepoInfo({ repoFullName }: { repoFullName: string }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!repoFullName || repoFullName.split("/").length !== 2) {
      return
    }

    const fetchRepoData = async () => {
      setLoading(true)
      setError(false)
      
      try {
        const res = await fetch(`https://api.github.com/repos/${repoFullName}`, {
          cache: "no-store",
          headers: { Accept: "application/vnd.github+json" },
        })
        
        if (res.ok) {
          const repoData = await res.json()
          setData(repoData)
        } else {
          setError(true)
        }
      } catch (_) {
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    fetchRepoData()
  }, [repoFullName])

  if (!repoFullName || repoFullName.split("/").length !== 2) {
    return (
      <div className="text-sm text-muted-foreground">
        Provide a repo with <code>repo</code> query like <code>?repo=owner/repo</code> to auto-load details.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground">
        Loading repository information...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="text-sm text-muted-foreground">
        Couldn&apos;t load GitHub details right now. You can still proceed with betting.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-xl font-semibold">{data.full_name}</h3>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">★ {data.stargazers_count}</Badge>
          <Badge variant="secondary">⑂ {data.forks_count}</Badge>
          {data.open_issues_count != null ? <Badge variant="secondary">Issues {data.open_issues_count}</Badge> : null}
        </div>
      </div>
      <p className="text-sm text-muted-foreground text-pretty">{data.description || "No description provided."}</p>
    </div>
  )
}
