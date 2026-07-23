import { useCallback, useEffect, useState } from "react";
import { DatabaseBackup } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { get, post } from "@/services/http";
import {
    EmptyState,
    PageHeader,
    PageShell,
    Panel,
    StatusBadge,
    errorMessage,
    formatBytes,
    formatUnixTime,
    type UnknownRecord,
} from "./react-page-helpers";

export default function BackupManagement() {
    const [rows, setRows] = useState<UnknownRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        enabled: false,
        time: "03:30",
        retention: 14,
    });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = (await get("/backup/fetch")) as UnknownRecord;
            setRows(Array.isArray(data.files) ? data.files : []);
            if (data.settings)
                setForm((previous) => ({ ...previous, ...data.settings }));
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        void load();
    }, [load]);

    const create = async () => {
        setCreating(true);
        try {
            await post("/backup/create");
            toast.success("数据库备份已完成");
            await load();
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setCreating(false);
        }
    };
    const save = async () => {
        setSaving(true);
        try {
            await post("/backup/settings", form);
            toast.success("自动备份设置已保存");
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setSaving(false);
        }
    };

    return (
        <PageShell>
            <PageHeader
                title="备份管理"
                description="创建数据库压缩备份，核对文件大小与 SHA-256 完整性。"
                action={
                    <Button disabled={creating} onClick={() => void create()}>
                        <DatabaseBackup />
                        {creating ? "备份执行中…" : "立即创建备份"}
                    </Button>
                }
            />
            <Panel className="backup-settings">
                <div className="grid gap-4 lg:grid-cols-[1fr_auto_12rem_12rem_auto] lg:items-end">
                    <div>
                        <h2 className="font-medium">自动备份</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            定时生成本地数据库压缩备份，并按保留天数自动轮换。
                        </p>
                    </div>
                    <div className="grid gap-2">
                        <Label>启用计划</Label>
                        <div className="flex h-8 items-center gap-2">
                            <Switch
                                checked={form.enabled}
                                onCheckedChange={(enabled) =>
                                    setForm({ ...form, enabled })
                                }
                            />
                            <span className="text-sm">
                                {form.enabled ? "已开启" : "已关闭"}
                            </span>
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label>执行时间</Label>
                        <Input
                            type="time"
                            value={form.time}
                            onChange={(event) =>
                                setForm({ ...form, time: event.target.value })
                            }
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>保留天数</Label>
                        <Input
                            type="number"
                            min={1}
                            max={365}
                            value={form.retention}
                            onChange={(event) =>
                                setForm({
                                    ...form,
                                    retention: Number(event.target.value),
                                })
                            }
                        />
                    </div>
                    <Button
                        variant="outline"
                        disabled={saving}
                        onClick={() => void save()}
                    >
                        {saving ? "保存中…" : "保存计划"}
                    </Button>
                </div>
            </Panel>
            <Panel className="table-wrap p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>备份文件</TableHead>
                            <TableHead>生成时间</TableHead>
                            <TableHead>大小</TableHead>
                            <TableHead>SHA-256 校验值</TableHead>
                            <TableHead>状态</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5}>
                                    <EmptyState>正在读取备份…</EmptyState>
                                </TableCell>
                            </TableRow>
                        ) : rows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5}>
                                    <EmptyState>暂无备份文件</EmptyState>
                                </TableCell>
                            </TableRow>
                        ) : (
                            rows.map((row) => (
                                <TableRow key={row.name}>
                                    <TableCell className="font-medium">
                                        {row.name}
                                    </TableCell>
                                    <TableCell>
                                        {formatUnixTime(Number(row.created_at))}
                                    </TableCell>
                                    <TableCell>
                                        {formatBytes(row.size)}
                                    </TableCell>
                                    <TableCell>
                                        <code
                                            className="block max-w-md truncate text-xs"
                                            title={row.sha256}
                                        >
                                            {row.sha256}
                                        </code>
                                    </TableCell>
                                    <TableCell>
                                        <StatusBadge>校验完成</StatusBadge>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Panel>
        </PageShell>
    );
}
