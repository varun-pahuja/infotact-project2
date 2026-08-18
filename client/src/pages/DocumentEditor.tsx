import { useState, useEffect } from "react";
import { BlockRenderer } from "../components/blocks/BlockRenderer";
import type { ASTDocument } from "@syncdoc/shared/types";

interface DocumentEditorProps {
  docId: string;
  onBack: () => void;
}

export function DocumentEditor({ docId, onBack }: DocumentEditorProps) {
  const [doc, setDoc] = useState<ASTDocument | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocument();
  }, [docId]);

  async function fetchDocument() {
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch(`/api/documents/${docId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = (await res.json()) as ASTDocument;
        setDoc(data);
      }
    } catch {
      console.error("Failed to fetch document");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-500">Loading document...</div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">Document not found</p>
          <button
            onClick={onBack}
            className="text-blue-600 hover:underline"
          >
            Back to documents
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-200 px-6 py-3 flex items-center gap-4">
        <button
          onClick={onBack}
          className="text-slate-500 hover:text-slate-700 transition-colors"
        >
          &larr; Back
        </button>
        <h1 className="text-lg font-semibold text-slate-900">{doc.title}</h1>
        <span className="text-xs text-slate-400 ml-auto">v{doc.version}</span>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {doc.rootNodes.map((node) => (
          <BlockRenderer key={node._id} node={node} />
        ))}

        {doc.rootNodes.length === 0 && (
          <p className="text-slate-400 text-center py-16">
            Empty document. Start typing...
          </p>
        )}
      </main>
    </div>
  );
}
