import { useState } from "react";

interface Document {
  _id: string;
  title: string;
  ownerId: string;
  collaborators: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface DocumentBrowserProps {
  onOpenDoc: (docId: string) => void;
}

export function DocumentBrowser({ onOpenDoc }: DocumentBrowserProps) {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");

  useState(() => {
    fetchDocuments();
  });

  async function fetchDocuments() {
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch("/api/documents", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = (await res.json()) as Document[];
        setDocs(data);
      }
    } catch {
      console.error("Failed to fetch documents");
    } finally {
      setLoading(false);
    }
  }

  async function createDocument() {
    if (!newTitle.trim()) return;
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: newTitle }),
      });
      if (res.ok) {
        const doc = (await res.json()) as Document;
        setDocs((prev) => [doc, ...prev]);
        setNewTitle("");
      }
    } catch {
      console.error("Failed to create document");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-500">Loading documents...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-slate-900">SyncDoc</h1>
        <p className="text-slate-500 text-sm mt-1">
          Collaborative documents with AST conflict resolution
        </p>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex gap-3 mb-8">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New document title..."
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            onKeyDown={(e) => e.key === "Enter" && createDocument()}
          />
          <button
            onClick={createDocument}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Create
          </button>
        </div>

        {docs.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-lg">No documents yet</p>
            <p className="text-sm mt-1">Create your first document above</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {docs.map((doc) => (
              <button
                key={doc._id}
                onClick={() => onOpenDoc(doc._id)}
                className="text-left bg-white border border-slate-200 rounded-lg p-5 hover:border-blue-300 hover:shadow-md transition-all"
              >
                <h2 className="text-lg font-semibold text-slate-900">
                  {doc.title}
                </h2>
                <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                  <span>v{doc.version}</span>
                  <span>{doc.collaborators.length} collaborators</span>
                  <span>
                    {new Date(doc.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
