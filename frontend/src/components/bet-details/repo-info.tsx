import { Badge } from "@/components/ui/badge"
export default async function RepoInfo({ repoFullName }: { repoFullName: string }) {
  if (!repoFullName || repoFullName.split("/").length !== 2) {
    return (
      <div className="text-sm text-muted-foreground">
        Provide a repo with <code>repo</code> query like <code>?repo=owner/repo</code> to auto-load details.
      </div>
    )
  }

  // Attempt a public GitHub fetch; show graceful fallback if blocked.
  let data: any = null
  try {
    const res = await fetch(`https://api.github.com/repos/${repoFullName}`, {
      cache: "no-store",
      headers: { Accept: "application/vnd.github+json" },
    })
    if (res.ok) data = await res.json()
  } catch (_) {
    // ignore
  }

  if (!data) {
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
