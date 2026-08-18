import { useState } from "react";
import { DocumentBrowser } from "./pages/DocumentBrowser";
import { DocumentEditor } from "./pages/DocumentEditor";

type View = { page: "browser" } | { page: "editor"; docId: string };

export default function App() {
  const [view, setView] = useState<View>({ page: "browser" });

  if (view.page === "editor") {
    return (
      <DocumentEditor
        docId={view.docId}
        onBack={() => setView({ page: "browser" })}
      />
    );
  }

  return (
    <DocumentBrowser
      onOpenDoc={(docId) => setView({ page: "editor", docId })}
    />
  );
}
