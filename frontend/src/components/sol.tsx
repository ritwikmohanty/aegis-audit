  "use client";
  import { useState } from "react";

  export function Sol() {
    const [repoUrl, setRepoUrl] = useState("");
    const [files, setFiles] = useState<{ path: string; code: string }[]>([]);

    const fetchFiles = async () => {
      const res = await fetch("/api/chat/fetch-sol", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl }),
      });

      const data = await res.json();
      if (data.files) {
        setFiles(data.files);
      } else {
        alert(data.error || "Failed to fetch files");
      }
    };

    return (
      <div className="p-4">
        <input
          type="text"
          placeholder="Enter GitHub repo URL"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          className="border px-2 py-1 w-80"
        />
        <button
          onClick={fetchFiles}
          className="ml-2 bg-blue-500 text-white px-4 py-1 rounded"
        >
          Fetch .sol Files
        </button>

        <div className="mt-6 space-y-4">
          {files.map((f, i) => (
            <div key={i} className="border rounded p-3 bg-gray-50">
              <h3 className="font-bold">{f.path}</h3>
              <pre className="whitespace-pre-wrap text-sm bg-black text-green-300 p-2 rounded mt-2 overflow-x-auto">
                {f.code}
              </pre>
            </div>
          ))}
        </div>
      </div>
    );
  }
