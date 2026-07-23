import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { AlignLeft, Check, Copy, Maximize2, Minimize2 } from "lucide-react";
import { toast } from "sonner";
import { basicSetup } from "codemirror";
import { indentWithTab } from "@codemirror/commands";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { yaml } from "@codemirror/lang-yaml";
import { linter, lintGutter } from "@codemirror/lint";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { EditorField, EditorModel } from "@/components/SmartEditor";

export interface TemplateCodeEditorHandle {
  markSaved: () => void;
}

export const TemplateCodeEditor = forwardRef<TemplateCodeEditorHandle, {
  value: EditorModel;
  fields: readonly EditorField[];
  onChange: (value: EditorModel) => void;
}>(function TemplateCodeEditor({ value, fields, onChange }, ref) {
  const entries = useMemo(() => fields.map((field) => ({
    ...field,
    language: field.language || (/singbox/i.test(field.key) ? "json" : /surge|surfboard/i.test(field.key) ? "ini" : "yaml"),
  })), [fields]);
  const [activeKey, setActiveKey] = useState(entries[0]?.key || "");
  const [baseline, setBaseline] = useState<EditorModel>(() => ({ ...value }));
  const [fullscreen, setFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({ lines: 1, characters: 0 });
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  valueRef.current = value;
  onChangeRef.current = onChange;

  const active = entries.find((field) => field.key === activeKey) || entries[0];
  const markSaved = () => setBaseline({ ...valueRef.current });
  useImperativeHandle(ref, () => ({ markSaved }), []);

  useEffect(() => {
    if (!entries.some((field) => field.key === activeKey)) setActiveKey(entries[0]?.key || "");
  }, [activeKey, entries]);

  useEffect(() => {
    if (!hostRef.current || !active) return;
    setError("");
    const language = active.language === "json"
      ? [json(), linter(jsonParseLinter())]
      : active.language === "yaml" ? [yaml()] : [];
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: String(valueRef.current[active.key] || ""),
        extensions: [
          basicSetup,
          lintGutter(),
          keymap.of([indentWithTab]),
          ...language,
          EditorView.lineWrapping,
          EditorView.theme({
            "&": { height: fullscreen ? "calc(100vh - 230px)" : "560px", backgroundColor: "transparent", fontSize: "13px" },
            ".cm-scroller": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", lineHeight: "1.65" },
            ".cm-content": { padding: "14px 0" },
            ".cm-gutters": { backgroundColor: "transparent", border: "none", color: "#7890aa" },
            ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "rgba(2, 123, 254, .06)" },
            "&.cm-focused": { outline: "none" },
            ".cm-foldGutter": { width: "14px" },
          }),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return;
            const text = update.state.doc.toString();
            setError("");
            setStats({ lines: update.state.doc.lines, characters: update.state.doc.length });
            onChangeRef.current({ ...valueRef.current, [active.key]: text });
          }),
        ],
      }),
    });
    editorRef.current = view;
    setStats({ lines: view.state.doc.lines, characters: view.state.doc.length });
    return () => { view.destroy(); editorRef.current = null; };
  }, [active?.key, active?.language, fullscreen]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && fullscreen) setFullscreen(false);
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [fullscreen]);

  async function copyCode() {
    await navigator.clipboard.writeText(editorRef.current?.state.doc.toString() || "");
    setCopied(true);
    toast.success("代码已复制");
    window.setTimeout(() => setCopied(false), 1500);
  }

  function formatJson() {
    const editor = editorRef.current;
    if (!editor || active?.language !== "json") return;
    try {
      const formatted = JSON.stringify(JSON.parse(editor.state.doc.toString()), null, 2);
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: formatted } });
      setError("");
    } catch (reason) {
      setError(`JSON 格式错误：${reason instanceof Error ? reason.message : "无法解析"}`);
    }
  }

  if (!active) return null;

  return (
    <Card className={cn("overflow-hidden border", fullscreen && "fixed inset-4 z-50 bg-background shadow-2xl")}>
      <CardHeader className="gap-4 border-b pb-4">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="订阅模板类型">
          {entries.map((field) => {
            const changed = String(value[field.key] || "") !== String(baseline[field.key] || "");
            return (
              <Button
                key={field.key}
                type="button"
                role="tab"
                size="sm"
                variant={field.key === active.key ? "default" : "ghost"}
                aria-selected={field.key === active.key}
                onClick={() => setActiveKey(field.key)}
              >
                {field.tabLabel || field.label?.replace(" 模板", "") || field.key}
                {changed ? <span className="size-1.5 rounded-full bg-amber-400" title="尚未保存" /> : null}
              </Button>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-semibold">{active.label}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {active.help || `配置 ${active.tabLabel || active.label?.replace(" 模板", "")} 客户端的订阅模板。`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">{stats.lines} 行 · {stats.characters} 字符</span>
            <Badge variant="secondary">{active.language?.toUpperCase()}</Badge>
            <Button type="button" variant="outline" size="sm" onClick={copyCode}>
              {copied ? <Check /> : <Copy />}{copied ? "已复制" : "复制"}
            </Button>
            {active.language === "json" ? (
              <Button type="button" variant="outline" size="sm" onClick={formatJson}><AlignLeft />格式化</Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={() => setFullscreen((current) => !current)}>
              {fullscreen ? <Minimize2 /> : <Maximize2 />}{fullscreen ? "退出全屏" : "全屏"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div ref={hostRef} className={cn("overflow-hidden", error && "ring-1 ring-destructive")} />
        <div className="border-t px-4 py-3 text-xs text-muted-foreground">
          {error ? <span className="text-destructive">{error}</span> : "支持行号、语法高亮、代码折叠、搜索和快捷键；修改后请保存设置。"}
        </div>
      </CardContent>
    </Card>
  );
});
