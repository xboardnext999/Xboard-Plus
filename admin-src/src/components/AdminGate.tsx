import { type FormEvent, useEffect, useState } from 'react';
import { Activity, CreditCard, LockKeyhole, UsersRound } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorMessage, get, post } from '@/services/http';

interface AdminGateProps {
  scope: string;
  onScopeChange: (scope: string) => void;
}

interface UnlockResponse {
  scope?: string;
}

interface StatusSummary {
  service?: string;
  account?: string;
  sync?: string;
  updated_at?: string;
}

export function AdminGate({ scope, onScopeChange }: AdminGateProps) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<StatusSummary>({});

  useEffect(() => {
    if (scope !== 'a') return;
    let active = true;
    get<StatusSummary>('/admin-lock/summary')
      .then((data) => {
        if (active) setSummary(data);
      })
      .catch((loadError) => {
        if (active) setError(errorMessage(loadError));
      });
    return () => {
      active = false;
    };
  }, [scope]);

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password) return;
    setBusy(true);
    setError('');
    try {
      const data = await post<UnlockResponse>('/admin-lock/unlock', { password });
      setPassword('');
      onScopeChange(data.scope || 'locked');
    } catch (unlockError) {
      setError(errorMessage(unlockError));
    } finally {
      setBusy(false);
    }
  }

  async function lock() {
    try {
      await post('/admin-lock/lock');
    } finally {
      onScopeChange('locked');
    }
  }

  if (scope === 'locked') {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <Card className="w-full max-w-md shadow-xl shadow-slate-950/5">
          <CardHeader>
            <div className="mb-2 grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
              <LockKeyhole className="size-5" />
            </div>
            <CardTitle className="text-xl">访问验证</CardTitle>
            <CardDescription>请输入访问密码继续</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-5" onSubmit={unlock}>
              <div className="grid gap-2">
                <Label htmlFor="access-password">访问密码</Label>
                <Input
                  id="access-password"
                  type="password"
                  value={password}
                  autoComplete="current-password"
                  autoFocus
                  placeholder="请输入访问密码"
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              {error ? (
                <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
              ) : null}
              <Button type="submit" className="h-10" disabled={busy || !password}>
                {busy ? '验证中…' : '继续'}
              </Button>
              <p className="text-center text-xs text-muted-foreground">连续输错将暂时限制验证。</p>
            </form>
          </CardContent>
        </Card>
      </main>
    );
  }

  const metrics = [
    { label: '服务状态', value: summary.service || '读取中…', icon: Activity },
    { label: '账户服务', value: summary.account || '—', icon: UsersRound },
    { label: '数据同步', value: summary.sync || '—', icon: CreditCard },
  ];

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-6xl content-start gap-6 p-6 sm:p-10">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">System status</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">系统状态</h1>
          <p className="mt-1 text-sm text-muted-foreground">服务运行状态与基础信息。</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onScopeChange('locked')}>重新验证</Button>
          <Button variant="outline" onClick={() => void lock()}>退出</Button>
        </div>
      </header>
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <div className="grid gap-4 md:grid-cols-3">
        {metrics.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 p-5">
              <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span>
              <span className="text-sm text-muted-foreground">{label}<strong className="mt-1 block text-base text-foreground">{value}</strong></span>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Activity className="size-5 text-primary" />运行信息</CardTitle>
          <CardDescription>各项服务当前运行正常，无需进行额外操作。</CardDescription>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">数据更新时间：{summary.updated_at || '—'}</CardContent>
      </Card>
    </main>
  );
}
