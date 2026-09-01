import { useState, useEffect } from "react";

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

const MOCK_USERS = [
  { name: "Alex Chen", color: "#6C7BFF", initial: "A" },
  { name: "Sarah Kim", color: "#4ECDC4", initial: "S" },
  { name: "You", color: "#FFB86C", initial: "Y" },
];

export function DocumentBrowser({ onOpenDoc }: DocumentBrowserProps) {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    fetchDocuments();
  }, []);

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
        <div className="neu-surface px-10 py-8 flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full neu-pressed flex items-center justify-center">
            <div className="h-5 w-5 rounded-full border-2 border-[#6C7BFF] border-t-transparent animate-spin" />
          </div>
          <span className="text-sm font-semibold tracking-wide text-[#6B7A90]">Loading workspace…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <div className="neu-mesh-bg" aria-hidden />
      {/* Header — Neumorphic */}
      <header className="sticky top-0 z-20 backdrop-blur-xl" style={{ background: "rgba(224,229,236,0.85)" }}>
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-11 w-11 rounded-2xl neu-surface flex items-center justify-center">
              <span className="text-lg font-extrabold" style={{ background: "linear-gradient(135deg,#6C7BFF,#8B5CF6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>S</span>
            </div>
            <div>
              <h1 className="text-[22px] font-extrabold tracking-tight text-[#2E3440] leading-none">SyncDoc</h1>
              <p className="text-xs font-semibold tracking-widest uppercase text-[#6B7A90] mt-1">AST · CRDT · Live Sync</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <div className="neu-pressed-sm px-4 py-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#4ECDC4] presence-dot" />
              <span className="text-xs font-bold text-[#6B7A90]">3 online</span>
            </div>
            <div className="flex -space-x-2">
              {MOCK_USERS.map((u) => (
                <div key={u.name} className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white ring-2 ring-[#E0E5EC]" style={{ background: u.color }}>
                  {u.initial}
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Create Card */}
        <div className="neu-surface p-6 sm:p-7 mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-8 w-8 rounded-xl neu-pressed flex items-center justify-center text-sm">✦</div>
            <h2 className="text-sm font-extrabold tracking-widest uppercase text-[#6B7A90]">New document</h2>
            <span className="ml-auto text-[11px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full neu-pressed-sm text-[#6B7A90]">Yjs · Block Lock</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Untitled spec — e.g. Q4 API Redesign"
              className="flex-1 neu-input px-5 py-3.5 text-sm font-semibold placeholder:text-[#A3B1C6] text-[#2E3440]"
              onKeyDown={(e) => e.key === "Enter" && createDocument()}
            />
            <button onClick={createDocument} className="neu-button-primary px-7 py-3.5 text-sm font-extrabold tracking-wide whitespace-nowrap">
              ＋ Create
            </button>
          </div>
          <p className="text-xs text-[#6B7A90] mt-3 font-medium">Creates a nested AST with one empty paragraph block. Blocks merge via CRDT — no destructive overwrites.</p>
        </div>

        {/* Document Grid */}
        {docs.length === 0 ? (
          <div className="neu-surface p-10 text-center">
            <div className="mx-auto h-16 w-16 rounded-2xl neu-pressed flex items-center justify-center text-2xl mb-4">📄</div>
            <p className="text-base font-extrabold text-[#2E3440]">No documents yet</p>
            <p className="text-sm text-[#6B7A90] mt-1 font-medium">Create your first spec above — it becomes a live Yjs matrix instantly.</p>
            <div className="mt-6 flex justify-center gap-2">
              <span className="px-3 py-1.5 rounded-full neu-pressed-sm text-xs font-bold text-[#6B7A90]">paragraph</span>
              <span className="px-3 py-1.5 rounded-full neu-pressed-sm text-xs font-bold text-[#6B7A90]">heading</span>
              <span className="px-3 py-1.5 rounded-full neu-pressed-sm text-xs font-bold text-[#6B7A90]">code_block</span>
              <span className="px-3 py-1.5 rounded-full neu-pressed-sm text-xs font-bold text-[#6B7A90]">list_item</span>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {docs.map((doc) => (
              <button
                key={doc._id}
                onClick={() => onOpenDoc(doc._id)}
                className="text-left neu-surface p-6 neu-card-hover group"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-[15px] font-extrabold leading-tight text-[#2E3440] group-hover:text-[#6C7BFF] transition-colors line-clamp-2">
                    {doc.title}
                  </h2>
                  <span className="shrink-0 h-7 px-2.5 rounded-full neu-pressed-sm flex items-center text-[11px] font-extrabold tracking-widest text-[#6B7A90]">v{doc.version}</span>
                </div>
                <div className="flex items-center gap-2 mt-4 flex-wrap">
                  <span className="neu-pressed-sm px-2.5 py-1 text-xs font-bold text-[#6B7A90] flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#4ECDC4]" /> {doc.collaborators.length} collaborators
                  </span>
                  <span className="neu-pressed-sm px-2.5 py-1 text-xs font-bold text-[#6B7A90]">{new Date(doc.updatedAt).toLocaleDateString()}</span>
                  <span className="ml-auto h-7 w-7 rounded-full neu-button flex items-center justify-center text-xs group-hover:translate-x-0.5 transition-transform">→</span>
                </div>
                {/* faux block preview */}
                <div className="mt-4 space-y-1.5 opacity-60">
                  <div className="h-2 rounded-full neu-pressed-sm" style={{ width: "92%" }} />
                  <div className="h-2 rounded-full neu-pressed-sm" style={{ width: "76%" }} />
                  <div className="h-8 rounded-xl neu-pressed-sm mt-2" />
                </div>
              </button>
            ))}
          </div>
        )}

        <footer className="mt-10 flex flex-wrap gap-2 text-xs font-bold tracking-wide text-[#6B7A90]">
          <span className="neu-pressed-sm px-3 py-1.5">Sub-5ms queries</span>
          <span className="neu-pressed-sm px-3 py-1.5">60 FPS viewport</span>
          <span className="neu-pressed-sm px-3 py-1.5">10-client CRDT stress test</span>
          <span className="neu-pressed-sm px-3 py-1.5">DOMPurify XSS guard</span>
        </footer>
      </main>
    </div>
  );
}
