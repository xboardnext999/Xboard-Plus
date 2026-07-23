import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ImageIcon, PanelsTopLeft, Upload } from "lucide-react";
import { toast } from "sonner";

import { SmartEditor, type EditorField, type EditorModel } from "@/components/SmartEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { get, post } from "@/services/http";
import {
  ConfirmAction,
  EmptyState,
  MetricCard,
  MetricGrid,
  PageDialog,
  PageHeader,
  PageShell,
  errorMessage,
} from "@/pages/react-page-helpers";

interface ThemeConfigSchema {
  field_name: string;
  label?: string;
  placeholder?: string;
  description?: string;
  field_type?: string;
  select_options?: Record<string, string>;
  default_value?: unknown;
}
interface ThemeRecord {
  key: string;
  name?: string;
  version?: string;
  description?: string;
  author?: string;
  images?: string[] | string;
  is_system?: boolean;
  can_delete?: boolean;
  configs?: ThemeConfigSchema[];
}
interface ThemePayload { active?: string; themes?: Record<string, Omit<ThemeRecord, "key">> }

function imageList(theme: ThemeRecord | null) {
  if (!theme) return [];
  if (Array.isArray(theme.images)) return theme.images.filter(Boolean);
  if (typeof theme.images === "string") return theme.images.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function imageUrl(theme: ThemeRecord, image: string) {
  if (/^(https?:|data:|\/)/.test(image)) return image;
  return `/theme/${theme.key}/${image}`;
}

function schemaField(item: ThemeConfigSchema): EditorField {
  const typeMap: Record<string, EditorField["type"]> = {
    input: "text", textarea: "textarea", select: "select", switch: "boolean",
    boolean: "boolean", number: "number", color: "color",
  };
  return {
    key: item.field_name,
    label: item.label || item.field_name,
    placeholder: item.placeholder,
    help: item.description,
    type: typeMap[item.field_type || ""] || "text",
    options: Object.entries(item.select_options || {}).map(([value, label]) => ({ value, label })),
  };
}

export default function ThemeManagement() {
  const [themes, setThemes] = useState<ThemeRecord[]>([]);
  const [activeName, setActiveName] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyName, setBusyName] = useState("");
  const [dialog, setDialog] = useState<{ type: "" | "preview" | "config"; theme: ThemeRecord | null; imageIndex: number }>({ type: "", theme: null, imageIndex: 0 });
  const [configModel, setConfigModel] = useState<EditorModel>({});
  const [configFields, setConfigFields] = useState<EditorField[]>([]);
  const uploadInput = useRef<HTMLInputElement>(null);
  const stats = useMemo(() => ({ total: themes.length, custom: themes.filter((item) => !item.is_system).length }), [themes]);

  async function load() {
    setLoading(true);
    try {
      const data = await get<ThemePayload>("/theme/getThemes");
      setActiveName(data.active || "");
      setThemes(Object.entries(data.themes || {}).map(([key, value]) => ({ key, ...value })));
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function activate(theme: ThemeRecord) {
    setBusyName(theme.key);
    try {
      await post("/config/save", { frontend_theme: theme.key });
      setActiveName(theme.key);
      toast.success("主题已启用");
      await load();
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally { setBusyName(""); }
  }

  async function configure(theme: ThemeRecord) {
    setBusyName(theme.key);
    try {
      const config = await post<EditorModel>("/theme/getThemeConfig", { name: theme.key });
      const fields = (theme.configs || []).map(schemaField);
      setConfigFields(fields);
      setConfigModel(Object.fromEntries(fields.map((field) => [
        field.key,
        config?.[field.key] ?? theme.configs?.find((item) => item.field_name === field.key)?.default_value ?? "",
      ])));
      setDialog({ type: "config", theme, imageIndex: 0 });
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally { setBusyName(""); }
  }

  async function saveConfig() {
    if (!dialog.theme) return;
    setBusyName(dialog.theme.key);
    try {
      await post("/theme/saveThemeConfig", { name: dialog.theme.key, config: configModel });
      toast.success("主题配置已保存");
      setDialog({ type: "", theme: null, imageIndex: 0 });
      await load();
    } catch (reason) { toast.error(errorMessage(reason)); }
    finally { setBusyName(""); }
  }

  async function remove(theme: ThemeRecord) {
    setBusyName(theme.key);
    try {
      await post("/theme/delete", { name: theme.key });
      toast.success("主题已删除");
      await load();
    } catch (reason) { toast.error(errorMessage(reason)); }
    finally { setBusyName(""); }
  }

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".zip")) {
      toast.error("仅支持 ZIP 主题包");
      event.target.value = "";
      return;
    }
    const body = new FormData(); body.append("file", file); setUploading(true);
    try { await post("/theme/upload", body); toast.success("主题上传成功"); await load(); }
    catch (reason) { toast.error(errorMessage(reason)); }
    finally { setUploading(false); event.target.value = ""; }
  }

  const previewImages = imageList(dialog.theme);

  return (
    <PageShell>
      <PageHeader title="主题配置" description="管理用户端主题、外观配置和主题包。" action={
        <>
          <Input ref={uploadInput} className="hidden" type="file" accept=".zip,application/zip" onChange={upload} />
          <Button disabled={uploading} onClick={() => uploadInput.current?.click()}><Upload />{uploading ? "上传中…" : "上传主题"}</Button>
        </>
      } />

      <MetricGrid className="xl:grid-cols-3">
        <MetricCard label="可用主题" value={stats.total} />
        <MetricCard label="自定义主题" value={stats.custom} />
        <MetricCard label="当前主题" value={<span className="truncate text-lg">{activeName || "—"}</span>} />
      </MetricGrid>

      {loading ? <EmptyState>正在加载主题…</EmptyState> : !themes.length ? <EmptyState>暂未发现有效主题</EmptyState> : (
        <div className="grid gap-4 xl:grid-cols-2">
          {themes.map((theme) => {
            const images = imageList(theme);
            const active = activeName === theme.key;
            return (
              <Card key={theme.key} className={active ? "border-primary/40 shadow-[0_12px_36px_rgba(2,123,254,.08)]" : ""}>
                <div className="relative aspect-[16/7] overflow-hidden rounded-t-[inherit] bg-muted">
                  {images.length ? (
                    <img src={imageUrl(theme, images[0]!)} alt={`${theme.name || theme.key} 预览`} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground"><PanelsTopLeft className="size-9" /><span className="text-sm">暂无预览图</span></div>
                  )}
                  {active ? <Badge className="absolute right-3 top-3 gap-1"><Check className="size-3" />当前主题</Badge> : null}
                </div>
                <CardHeader className="flex-row items-start justify-between gap-4">
                  <div className="min-w-0"><CardTitle>{theme.name || theme.key}</CardTitle><code className="mt-1 block text-xs text-muted-foreground">{theme.key}</code></div>
                  <Badge variant="outline">v{theme.version || "1.0.0"}</Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <CardDescription className="min-h-10 leading-relaxed">{theme.description || "暂无主题说明"}</CardDescription>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary">{theme.is_system ? "系统主题" : "自定义主题"}</Badge>
                    {theme.author ? <span>作者：{theme.author}</span> : null}
                    <span>{theme.configs?.length || 0} 个配置项</span>
                  </div>
                  <div className="flex flex-wrap gap-2 border-t pt-4">
                    {images.length ? <Button variant="outline" size="sm" onClick={() => setDialog({ type: "preview", theme, imageIndex: 0 })}><ImageIcon />预览</Button> : null}
                    {theme.configs?.length ? <Button variant="outline" size="sm" disabled={busyName === theme.key} onClick={() => configure(theme)}>主题设置</Button> : null}
                    {!active ? <ConfirmAction destructive={false} confirmText="启用主题" title={`启用 ${theme.name || theme.key}`} description="用户端将立即切换为该主题。" disabled={busyName === theme.key} onConfirm={() => activate(theme)}>启用主题</ConfirmAction> : null}
                    {theme.can_delete && !active ? <ConfirmAction confirmText="永久删除" title={`删除 ${theme.name || theme.key}`} description="主题文件和配置将被删除且无法恢复。" disabled={busyName === theme.key} onConfirm={() => remove(theme)}>删除</ConfirmAction> : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <PageDialog
        open={Boolean(dialog.type && dialog.theme)}
        onOpenChange={(open) => !open && setDialog({ type: "", theme: null, imageIndex: 0 })}
        title={dialog.type === "config" ? `配置 ${dialog.theme?.name || dialog.theme?.key || "主题"}` : `${dialog.theme?.name || dialog.theme?.key || "主题"} 预览`}
        description={dialog.type === "config" ? "修改主题的样式和显示选项。" : "查看主题提供的界面预览图。"}
        className="sm:max-w-4xl"
        footer={dialog.type === "config" ? <Button disabled={busyName === dialog.theme?.key} onClick={saveConfig}>{busyName === dialog.theme?.key ? "保存中…" : "保存配置"}</Button> : undefined}
      >
        {dialog.type === "config" ? <SmartEditor value={configModel} fields={configFields} onChange={setConfigModel} /> : dialog.theme && previewImages.length ? (
          <div className="space-y-3">
            <img src={imageUrl(dialog.theme, previewImages[dialog.imageIndex]!)} alt="主题预览" className="max-h-[65vh] w-full rounded-xl bg-muted object-contain" />
            {previewImages.length > 1 ? <div className="flex items-center justify-center gap-3"><Button variant="outline" size="sm" disabled={dialog.imageIndex === 0} onClick={() => setDialog((current) => ({ ...current, imageIndex: current.imageIndex - 1 }))}>上一张</Button><span className="text-sm text-muted-foreground">{dialog.imageIndex + 1} / {previewImages.length}</span><Button variant="outline" size="sm" disabled={dialog.imageIndex >= previewImages.length - 1} onClick={() => setDialog((current) => ({ ...current, imageIndex: current.imageIndex + 1 }))}>下一张</Button></div> : null}
          </div>
        ) : <EmptyState>暂无预览图</EmptyState>}
      </PageDialog>
    </PageShell>
  );
}
