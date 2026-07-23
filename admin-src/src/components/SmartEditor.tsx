import { useMemo } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface EditorOption {
  value: string | number;
  label: string;
}

export interface EditorField {
  key: string;
  label?: string;
  type?: "boolean" | "select" | "lines" | "textarea" | "json" | "password" | "number" | "text" | "color";
  placeholder?: string;
  help?: string;
  readonly?: boolean;
  required?: boolean;
  onLabel?: string;
  offLabel?: string;
  options?: readonly EditorOption[];
  tabLabel?: string;
  language?: "json" | "yaml" | "ini";
}

export type EditorModel = Record<string, unknown>;

const labels: Record<string, string> = {
  id: "ID", name: "名称", title: "标题", email: "邮箱", password: "新密码",
  content: "内容", remarks: "备注", status: "状态", show: "显示", popup: "弹窗展示",
  banned: "封禁", is_admin: "管理员", is_staff: "员工", enable: "启用", plan_id: "套餐 ID",
  group_id: "权限组 ID", transfer_enable: "流量配额", speed_limit: "限速",
  device_limit: "设备数限制", capacity_limit: "容量限制", balance: "余额",
  commission_balance: "佣金余额", commission_rate: "佣金比例", discount: "专属折扣",
  commission_status: "佣金状态", prices: "周期价格", tags: "标签", img_url: "图片地址",
  host: "主机", port: "端口", type: "类型",
};

const longFields = new Set(["content", "remarks", "description"]);
const secretFields = new Set(["password", "token", "secret"]);
const emptySelect = "__xboard_empty__";

function inferKind(field: EditorField, current: unknown): NonNullable<EditorField["type"]> {
  if (field.type) return field.type;
  if (
    typeof current === "boolean" ||
    ((current === 0 || current === 1) && /^(show|popup|enable|banned|is_|renew)/.test(field.key))
  ) return "boolean";
  if (current && typeof current === "object") return "json";
  if (longFields.has(field.key)) return "textarea";
  if (secretFields.has(field.key)) return "password";
  if (typeof current === "number" || /(_id|_limit|_rate|_amount|_balance|_enable|^port$)/.test(field.key)) return "number";
  return "text";
}

export function SmartEditor({
  value,
  fields,
  onChange,
  className,
}: {
  value: EditorModel;
  fields: readonly EditorField[];
  onChange: (value: EditorModel) => void;
  className?: string;
}) {
  const entries = useMemo(() => fields.map((field) => ({ ...field })), [fields]);
  const update = (key: string, next: unknown) => onChange({ ...value, [key]: next });

  return (
    <div className={cn("grid gap-5 md:grid-cols-2", className)}>
      {entries.map((field) => {
        const current = value[field.key];
        const kind = inferKind(field, current);
        const wide = kind === "textarea" || kind === "json" || kind === "lines";
        const label = field.label || labels[field.key] || field.key;

        return (
          <div key={field.key} className={cn("grid content-start gap-2", wide && "md:col-span-2")}>
            <Label htmlFor={`config-${field.key}`} className="text-sm font-medium">
              {label}{field.required ? <span className="ml-1 text-destructive">*</span> : null}
            </Label>

            {kind === "boolean" ? (
              <div className="flex min-h-10 items-center gap-3 rounded-xl border bg-background px-3 py-2">
                <Switch
                  id={`config-${field.key}`}
                  checked={Boolean(Number(current || 0))}
                  disabled={field.readonly}
                  onCheckedChange={(checked) => update(field.key, checked ? 1 : 0)}
                />
                <span className="text-sm text-muted-foreground">
                  {Boolean(Number(current || 0)) ? field.onLabel || "已开启" : field.offLabel || "已关闭"}
                </span>
              </div>
            ) : kind === "select" ? (
              <Select
                value={current === "" || current == null ? emptySelect : String(current)}
                disabled={field.readonly}
                onValueChange={(next) => {
                  if (next == null) return;
                  const normalized = next === emptySelect ? "" : next;
                  const option = field.options?.find((item) => String(item.value) === normalized);
                  update(field.key, option?.value ?? normalized);
                }}
              >
                <SelectTrigger id={`config-${field.key}`} className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {field.options?.map((option) => (
                    <SelectItem key={String(option.value)} value={option.value === "" ? emptySelect : String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : kind === "lines" ? (
              <Textarea
                id={`config-${field.key}`}
                rows={5}
                disabled={field.readonly}
                value={Array.isArray(current) ? current.join("\n") : String(current || "")}
                placeholder={field.placeholder}
                onChange={(event) => update(field.key, event.target.value.split("\n").map((line) => line.trim()).filter(Boolean))}
              />
            ) : kind === "textarea" ? (
              <Textarea
                id={`config-${field.key}`}
                rows={5}
                disabled={field.readonly}
                value={String(current || "")}
                placeholder={field.placeholder}
                onChange={(event) => update(field.key, event.target.value)}
              />
            ) : kind === "json" ? (
              <Textarea
                id={`config-${field.key}`}
                rows={8}
                className="font-mono text-xs leading-relaxed"
                disabled={field.readonly}
                value={typeof current === "string" ? current : JSON.stringify(current ?? {}, null, 2)}
                onChange={(event) => {
                  try { update(field.key, JSON.parse(event.target.value)); }
                  catch { update(field.key, event.target.value); }
                }}
              />
            ) : (
              <Input
                id={`config-${field.key}`}
                type={kind}
                disabled={field.readonly}
                value={current == null ? "" : String(current)}
                placeholder={field.placeholder}
                onChange={(event) => update(
                  field.key,
                  kind === "number" && event.target.value !== "" ? Number(event.target.value) : event.target.value,
                )}
              />
            )}

            {field.help ? <p className="text-xs leading-relaxed text-muted-foreground">{field.help}</p> : null}
          </div>
        );
      })}
    </div>
  );
}
