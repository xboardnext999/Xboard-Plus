import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Save, Send } from "lucide-react";
import { toast } from "sonner";

import { AppIcon } from "@/components/AppIcon";
import { SmartEditor, type EditorField, type EditorModel } from "@/components/SmartEditor";
import { TemplateCodeEditor, type TemplateCodeEditorHandle } from "@/components/TemplateCodeEditor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { configSections } from "@/config/systemConfig";
import { cn } from "@/lib/utils";
import { get, post } from "@/services/http";
import { PageHeader, PageShell, errorMessage } from "@/pages/react-page-helpers";

type ConfigStore = Record<string, EditorModel>;

export default function SystemConfig() {
  const [activeKey, setActiveKey] = useState("site");
  const [configs, setConfigs] = useState<ConfigStore>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);
  const templateEditor = useRef<TemplateCodeEditorHandle>(null);
  const active = useMemo(
    () => configSections.find((section) => section.key === activeKey) || configSections[0],
    [activeKey],
  );
  const model = configs[activeKey] || {};

  async function load() {
    setLoading(true);
    try {
      const result = await get<ConfigStore>("/config/fetch");
      setConfigs(result || {});
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function updateModel(next: EditorModel) {
    setConfigs((current) => ({ ...current, [activeKey]: next }));
  }

  async function save() {
    if (!active) return;
    setSaving(true);
    try {
      await post("/config/save", model);
      templateEditor.current?.markSaved();
      toast.success(`${active.title}已保存`);
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  async function runAction() {
    if (!active || !("action" in active) || !active.action) return;
    setActing(true);
    try {
      if (active.action === "mail") await post("/config/testSendMail");
      if (active.action === "telegram") await post("/config/setTelegramWebhook", configs.telegram || {});
      toast.success(active.action === "mail" ? "测试邮件已发送" : "Telegram Webhook 已设置");
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setActing(false);
    }
  }

  if (!active) return null;
  const action = "action" in active ? active.action : undefined;
  const wide = "wide" in active && Boolean(active.wide);

  return (
    <PageShell>
      <PageHeader
        title="系统配置"
        description="管理站点、订阅、安全、通知和节点通信等核心设置。"
        action={
          <Button variant="outline" onClick={load} disabled={loading || saving}>
            <RefreshCw className={cn(loading && "animate-spin")} />刷新
          </Button>
        }
      />

      <div className="grid min-h-[680px] gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <Card className="h-fit overflow-hidden py-2 lg:sticky lg:top-20">
          <ScrollArea className="max-h-[calc(100vh-150px)]">
            <nav className="grid gap-1 p-2" aria-label="系统配置分类">
              {configSections.map((section) => (
                <Button
                  key={section.key}
                  type="button"
                  variant="ghost"
                  className={cn(
                    "h-10 justify-start gap-3 px-3 text-muted-foreground",
                    activeKey === section.key && "bg-primary/10 text-primary hover:bg-primary/12 hover:text-primary",
                  )}
                  onClick={() => setActiveKey(section.key)}
                >
                  <AppIcon name={section.icon} className="size-4" />
                  <span>{section.title}</span>
                </Button>
              ))}
            </nav>
          </ScrollArea>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="flex flex-col gap-4 border-b sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{active.title}</CardTitle>
              <CardDescription className="mt-1">{active.description}</CardDescription>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {action ? (
                <Button variant="outline" disabled={acting || loading} onClick={runAction}>
                  {action === "mail" ? <Send /> : <AppIcon name="Send" />}
                  {acting ? "执行中…" : action === "mail" ? "发送测试邮件" : "设置 Webhook"}
                </Button>
              ) : null}
              <Button disabled={saving || loading} onClick={save}>
                <Save />{saving ? "保存中…" : "保存设置"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {loading ? (
              <div className="grid gap-5 md:grid-cols-2">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
            ) : wide ? (
              <TemplateCodeEditor
                ref={templateEditor}
                value={model}
                fields={active.fields as readonly EditorField[]}
                onChange={updateModel}
              />
            ) : (
              <>
                <SmartEditor
                  value={model}
                  fields={active.fields as readonly EditorField[]}
                  onChange={updateModel}
                />
                <Separator className="mt-7" />
                <div className="mt-5 flex justify-end">
                  <Button disabled={saving} onClick={save}><Save />{saving ? "保存中…" : "保存设置"}</Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
