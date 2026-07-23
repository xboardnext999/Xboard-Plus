import { useEffect, useMemo, useRef, useState } from "react";
import { CreditCard, FileText, Puzzle, RefreshCw, Settings2, Upload } from "lucide-react";
import { toast } from "sonner";

import { SmartEditor, type EditorField, type EditorModel, type EditorOption } from "@/components/SmartEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { get, post } from "@/services/http";
import {
  ConfirmAction,
  EmptyState,
  MetricCard,
  MetricGrid,
  PageDialog,
  PageHeader,
  PageShell,
  SelectField,
  errorMessage,
} from "@/pages/react-page-helpers";

interface PluginType { value: string; label: string; icon?: string }
interface PluginConfigItem {
  value?: unknown;
  label?: string;
  placeholder?: string;
  description?: string;
  type?: string;
  options?: EditorOption[] | Record<string, string>;
}
interface PluginRecord {
  code: string;
  name: string;
  version?: string;
  description?: string;
  author?: string;
  type?: string;
  is_installed?: boolean;
  is_enabled?: boolean;
  is_protected?: boolean;
  need_upgrade?: boolean;
  can_be_deleted?: boolean;
  readme?: string;
  config?: Record<string, unknown>;
}

function normalizeOptions(options: PluginConfigItem["options"]): EditorOption[] {
  if (Array.isArray(options)) return options.map((option) => typeof option === "object" ? option : { value: option, label: String(option) });
  return Object.entries(options || {}).map(([value, label]) => ({ value, label }));
}

export default function PluginManagement() {
  const [plugins, setPlugins] = useState<PluginRecord[]>([]);
  const [types, setTypes] = useState<PluginType[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyCode, setBusyCode] = useState("");
  const [keyword, setKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [uploading, setUploading] = useState(false);
  const [dialog, setDialog] = useState<{ type: "" | "readme" | "config"; plugin: PluginRecord | null }>({ type: "", plugin: null });
  const [configModel, setConfigModel] = useState<EditorModel>({});
  const [configFields, setConfigFields] = useState<EditorField[]>([]);
  const uploadInput = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => plugins.filter((plugin) => {
    const term = keyword.trim().toLowerCase();
    const matchesText = !term || `${plugin.name} ${plugin.code} ${plugin.description || ""} ${plugin.author || ""}`.toLowerCase().includes(term);
    const matchesType = !typeFilter || plugin.type === typeFilter;
    const matchesStatus = statusFilter === "all" || (statusFilter === "installed" ? plugin.is_installed : !plugin.is_installed);
    return matchesText && matchesType && matchesStatus;
  }), [keyword, plugins, statusFilter, typeFilter]);

  const counts = useMemo(() => ({
    all: plugins.length,
    installed: plugins.filter((item) => item.is_installed).length,
    enabled: plugins.filter((item) => item.is_enabled).length,
  }), [plugins]);

  async function load() {
    setLoading(true);
    try {
      const [pluginData, typeData] = await Promise.all([
        get<PluginRecord[]>("/plugin/getPlugins"),
        get<PluginType[]>("/plugin/types"),
      ]);
      setPlugins(Array.isArray(pluginData) ? pluginData : []);
      setTypes(Array.isArray(typeData) ? typeData : []);
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function runAction(plugin: PluginRecord, action: string) {
    setBusyCode(plugin.code);
    try {
      await post(`/plugin/${action}`, { code: plugin.code });
      const labels: Record<string, string> = { install: "安装", uninstall: "卸载", enable: "启用", disable: "禁用", upgrade: "升级", delete: "删除" };
      toast.success(`${labels[action] || "操作"}成功`);
      await load();
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setBusyCode("");
    }
  }

  async function openConfig(plugin: PluginRecord) {
    setBusyCode(plugin.code);
    try {
      const config = await get<Record<string, PluginConfigItem>>("/plugin/config", { code: plugin.code });
      setConfigModel(Object.fromEntries(Object.entries(config || {}).map(([key, item]) => [key, item.value])));
      setConfigFields(Object.entries(config || {}).map(([key, item]) => ({
        key,
        label: item.label || key,
        placeholder: item.placeholder,
        help: item.description,
        type: (item.type === "text" ? "textarea" : item.type === "string" ? "text" : item.type || "text") as EditorField["type"],
        options: normalizeOptions(item.options),
      })));
      setDialog({ type: "config", plugin });
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setBusyCode("");
    }
  }

  async function saveConfig() {
    if (!dialog.plugin) return;
    setBusyCode(dialog.plugin.code);
    try {
      await post("/plugin/config", { code: dialog.plugin.code, config: configModel });
      toast.success("插件配置已保存");
      setDialog({ type: "", plugin: null });
      await load();
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setBusyCode("");
    }
  }

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".zip")) {
      toast.error("仅支持 ZIP 插件包");
      event.target.value = "";
      return;
    }
    const body = new FormData();
    body.append("file", file);
    setUploading(true);
    try {
      await post("/plugin/upload", body);
      toast.success("插件上传成功");
      await load();
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  const typeName = (value?: string) => types.find((item) => item.value === value)?.label || (value === "payment" ? "支付方式" : "功能");

  return (
    <PageShell>
      <PageHeader
        title="插件管理"
        description="安装、启用和配置功能扩展与支付插件。"
        action={
          <>
            <Input ref={uploadInput} className="hidden" type="file" accept=".zip,application/zip" onChange={upload} />
            <Button disabled={uploading} onClick={() => uploadInput.current?.click()}><Upload />{uploading ? "上传中…" : "上传插件"}</Button>
          </>
        }
      />

      <MetricGrid className="xl:grid-cols-3">
        <MetricCard label="全部插件" value={counts.all} hint="当前可用扩展" />
        <MetricCard label="已安装" value={counts.installed} hint="已写入系统" />
        <MetricCard label="已启用" value={counts.enabled} hint="正在运行" />
      </MetricGrid>

      <Card>
        <CardContent className="grid gap-3 pt-6 lg:grid-cols-[minmax(240px,1fr)_220px_180px_auto]">
          <Input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="插件名称、代码或描述" />
          <SelectField label="" value={typeFilter} onValueChange={setTypeFilter} options={[{ value: "", label: "全部类型" }, ...types.map((item) => ({ value: item.value, label: `${item.icon || ""} ${item.label}`.trim() }))]} />
          <SelectField label="" value={statusFilter} onValueChange={setStatusFilter} options={[{ value: "all", label: "全部状态" }, { value: "installed", label: "已安装" }, { value: "available", label: "可安装" }]} />
          <Button variant="outline" disabled={loading} onClick={load}><RefreshCw className={loading ? "animate-spin" : ""} />刷新</Button>
        </CardContent>
      </Card>

      {loading ? <EmptyState>正在加载插件…</EmptyState> : !filtered.length ? <EmptyState>没有符合条件的插件</EmptyState> : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map((plugin) => (
            <Card key={plugin.code} className="overflow-hidden">
              <CardHeader className="flex-row items-start gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  {plugin.type === "payment" ? <CreditCard /> : <Puzzle />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><CardTitle>{plugin.name}</CardTitle><Badge variant="outline">v{plugin.version || "—"}</Badge></div>
                  <code className="mt-1 block truncate text-xs text-muted-foreground">{plugin.code}</code>
                </div>
                <Badge variant={!plugin.is_installed || !plugin.is_enabled ? "secondary" : "default"}>
                  {!plugin.is_installed ? "未安装" : plugin.is_enabled ? "已启用" : "已禁用"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <CardDescription className="min-h-10 leading-relaxed">{plugin.description || "暂无插件说明"}</CardDescription>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">{typeName(plugin.type)}</Badge>
                  <span>作者：{plugin.author || "未知"}</span>
                  {plugin.is_protected ? <Badge variant="outline">核心插件</Badge> : null}
                  {plugin.need_upgrade ? <Badge className="bg-amber-100 text-amber-900">可升级</Badge> : null}
                </div>
                <div className="flex flex-wrap gap-2 border-t pt-4">
                  {plugin.readme ? <Button variant="outline" size="sm" onClick={() => setDialog({ type: "readme", plugin })}><FileText />文档</Button> : null}
                  {!plugin.is_installed ? (
                    <Button size="sm" disabled={busyCode === plugin.code} onClick={() => runAction(plugin, "install")}>安装</Button>
                  ) : (
                    <>
                      {Object.keys(plugin.config || {}).length ? <Button variant="outline" size="sm" disabled={busyCode === plugin.code} onClick={() => openConfig(plugin)}><Settings2 />配置</Button> : null}
                      {plugin.need_upgrade ? <ConfirmAction destructive={false} confirmText="确认升级" title={`升级 ${plugin.name}`} description="升级前请确认当前配置已备份。" disabled={busyCode === plugin.code} onConfirm={() => runAction(plugin, "upgrade")}>升级</ConfirmAction> : null}
                      <Button variant={plugin.is_enabled ? "outline" : "default"} size="sm" disabled={busyCode === plugin.code} onClick={() => runAction(plugin, plugin.is_enabled ? "disable" : "enable")}>{plugin.is_enabled ? "禁用" : "启用"}</Button>
                      {!plugin.is_enabled ? <ConfirmAction title={`卸载 ${plugin.name}`} description="插件数据可能被清除，此操作请谨慎执行。" confirmText="确认卸载" disabled={busyCode === plugin.code} onConfirm={() => runAction(plugin, "uninstall")}>卸载</ConfirmAction> : null}
                    </>
                  )}
                  {!plugin.is_installed && plugin.can_be_deleted ? <ConfirmAction title={`永久删除 ${plugin.name}`} description="插件文件将从服务器删除且无法恢复。" confirmText="永久删除" disabled={busyCode === plugin.code} onConfirm={() => runAction(plugin, "delete")}>删除</ConfirmAction> : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PageDialog
        open={Boolean(dialog.type && dialog.plugin)}
        onOpenChange={(open) => !open && setDialog({ type: "", plugin: null })}
        title={dialog.type === "config" ? `配置 ${dialog.plugin?.name || "插件"}` : dialog.plugin?.name || "插件文档"}
        description={dialog.type === "config" ? "配置只对当前插件生效。" : "插件提供的使用说明。"}
        className="sm:max-w-3xl"
        footer={dialog.type === "config" ? <Button disabled={busyCode === dialog.plugin?.code} onClick={saveConfig}>{busyCode === dialog.plugin?.code ? "保存中…" : "保存配置"}</Button> : undefined}
      >
        {dialog.type === "config" ? (
          <SmartEditor value={configModel} fields={configFields} onChange={setConfigModel} />
        ) : (
          <ScrollArea className="max-h-[62vh] rounded-xl bg-muted/50 p-4"><pre className="whitespace-pre-wrap font-sans text-sm leading-7">{dialog.plugin?.readme || "暂无文档"}</pre></ScrollArea>
        )}
      </PageDialog>
    </PageShell>
  );
}
