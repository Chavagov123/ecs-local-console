import Editor, { type OnMount } from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { useRef } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** JSON Schema object registered for validation + completion. */
  schema?: object;
  height?: string | number;
}

/**
 * Lazy-loaded JSON editor for the task-definition workflow. Default-exported so
 * it lands in its own Rollup chunk via `React.lazy`.
 */
export default function MonacoJsonEditor({ value, onChange, schema, height = "60vh" }: Props) {
  const { resolvedTheme } = useTheme();
  const uri = useRef(`inmemory://task-def-${Math.random().toString(36).slice(2)}.json`);

  const handleMount: OnMount = (_editor, monaco) => {
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: false,
      schemas: schema
        ? [{ uri: "inmemory://schema/task-def.json", fileMatch: [uri.current], schema }]
        : [],
    });
  };

  return (
    <div className="overflow-hidden rounded-md border">
      <Editor
        height={height}
        defaultLanguage="json"
        path={uri.current}
        theme={resolvedTheme === "light" ? "vs" : "vs-dark"}
        value={value}
        onChange={(v) => onChange(v ?? "")}
        onMount={handleMount}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          scrollBeyondLastLine: false,
          tabSize: 2,
          formatOnPaste: true,
        }}
      />
    </div>
  );
}
