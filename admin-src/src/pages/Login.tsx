import { type FormEvent, useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { appBaseUrl, errorMessage } from '@/services/http';

interface LoginResponse {
  status?: string;
  message?: string;
  data?: {
    auth_data?: string;
    is_admin?: boolean;
  };
  auth_data?: string;
  is_admin?: boolean;
}

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const title = window.settings?.title || 'Xboard Plus';

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${appBaseUrl()}/api/v2/passport/auth/login`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = (await response.json()) as LoginResponse;
      const data = json.data || json;
      if (!response.ok || json.status === 'fail') throw new Error(json.message || '登录失败');
      if (!data.is_admin) throw new Error('该账号不是管理员');
      if (!data.auth_data) throw new Error('登录响应缺少访问令牌');

      localStorage.setItem('XBOARD_ACCESS_TOKEN', String(data.auth_data));
      await navigate('/dashboard', { replace: true });
    } catch (loginError) {
      setError(errorMessage(loginError, '登录失败'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_15%_10%,color-mix(in_oklch,var(--primary)_12%,transparent),transparent_35%)] p-6">
      <Card className="w-full max-w-md shadow-xl shadow-slate-950/5">
        <CardHeader className="gap-4 border-b pb-5">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <LockKeyhole className="size-5" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription>登录管理后台</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="grid gap-5" onSubmit={login}>
            <div className="grid gap-2">
              <Label htmlFor="admin-email">管理员邮箱</Label>
              <Input
                id="admin-email"
                type="email"
                value={email}
                autoComplete="username"
                onChange={(event) => setEmail(event.target.value.trim())}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="admin-password">密码</Label>
              <Input
                id="admin-password"
                type="password"
                value={password}
                minLength={8}
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <Button className="h-10 w-full" type="submit" disabled={loading}>
              {loading ? '登录中…' : '登录'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
