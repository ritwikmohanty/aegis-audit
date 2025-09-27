import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { repoUrl } = await req.json();

    // Validate input
    if (!repoUrl) {
      return NextResponse.json({ error: "Repository URL is required" }, { status: 400 });
    }

    // Extract owner/repo from URL
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) {
      return NextResponse.json({ error: "Invalid GitHub repo URL" }, { status: 400 });
    }
    const [_, owner, repo] = match;

    // Clean repo name (remove .git suffix if present)
    const cleanRepo = repo.replace(/\.git$/, '');

    // Fetch repo contents from GitHub API
    const res = await fetch(`https://api.github.com/repos/${owner}/${cleanRepo}/git/trees/main?recursive=1`);
    
    if (!res.ok) {
      // Try 'master' branch if 'main' fails
      const masterRes = await fetch(`https://api.github.com/repos/${owner}/${cleanRepo}/git/trees/master?recursive=1`);
      if (!masterRes.ok) {
        return NextResponse.json({ 
          error: `Failed to fetch repository. Status: ${res.status}` 
        }, { status: res.status });
      }
      const masterData = await masterRes.json();
      return await processSolFiles(masterData, owner, cleanRepo, 'master');
    }

    const data = await res.json();
    return await processSolFiles(data, owner, cleanRepo, 'main');

  } catch (err: any) {
    console.error('Error fetching Solidity files:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function processSolFiles(data: any, owner: string, repo: string, branch: string) {
  // Filter for .sol files
  const solFiles = data.tree.filter((f: any) => 
    f.path.endsWith(".sol") && f.type === "blob"
  );

  if (solFiles.length === 0) {
    return NextResponse.json({ 
      message: "No Solidity files found in this repository",
      files: [] 
    });
  }

  // Fetch contents of each .sol file
  const solFileContents = await Promise.all(
    solFiles.map(async (f: any) => {
      try {
        const fileRes = await fetch(
          `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${f.path}`
        );
        
        if (!fileRes.ok) {
          console.warn(`Failed to fetch ${f.path}: ${fileRes.status}`);
          return { path: f.path, code: null, error: `Failed to fetch file` };
        }
        
        const code = await fileRes.text();
        return { path: f.path, code, size: f.size };
      } catch (error) {
        console.warn(`Error fetching ${f.path}:`, error);
        return { path: f.path, code: null, error: 'Failed to fetch file content' };
      }
    })
  );

  // Filter out failed fetches
  const successfulFiles = solFileContents.filter(f => f.code !== null);

  return NextResponse.json({ 
    files: successfulFiles,
    totalFound: solFiles.length,
    successfullyFetched: successfulFiles.length
  });
}