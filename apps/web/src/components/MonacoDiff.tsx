import { DiffEditor } from "@monaco-editor/react";
import { useTheme } from "next-themes";

/**
 * Default-exported so `React.lazy` gives it its own chunk (shared with the
 * task-def editor's Monaco chunk).
 */
export default function MonacoDiff({
  original,
  modified,
  height = "60vh",
}: {
  original: string;
  modified: string;
  height?: string | number;
}) {
  const { resolvedTheme } = useTheme();
  return (
    <div className="overflow-hidden rounded-md border">
      <DiffEditor
        height={height}
        language="json"
        theme={resolvedTheme === "light" ? "vs" : "vs-dark"}
        original={original}
        modified={modified}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          readOnly: true,
          renderSideBySide: true,
          scrollBeyondLastLine: false,
        }}
      />
    </div>
  );
}
