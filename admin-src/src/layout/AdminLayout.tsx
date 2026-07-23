import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigation } from 'react-router-dom';

import { AdminGate } from '@/components/AdminGate';
import { AdminSidebar, type AccessPermissions } from '@/components/AdminSidebar';
import { AdminTopbar } from '@/components/AdminTopbar';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { errorMessage, get, post } from '@/services/http';

interface LockStatus {
  enabled?: boolean;
  scope?: string;
}

interface TemporaryAccessResponse {
  temporary?: boolean;
  permissions?: Record<string, boolean | string>;
}

const activityEvents = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;

export function AdminLayout() {
  const location = useLocation();
  const navigation = useNavigation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('admin_sidebar_collapsed') === '1');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lockReady, setLockReady] = useState(false);
  const [lockEnabled, setLockEnabled] = useState(true);
  const [lockScope, setLockScope] = useState('locked');
  const [accessPermissions, setAccessPermissions] = useState<AccessPermissions>(null);
  const [shellError, setShellError] = useState('');
  const idleTimer = useRef<number | undefined>(undefined);

  const loadAccess = useCallback(async () => {
    try {
      const data = await get<TemporaryAccessResponse>('/temporary-access/me');
      setAccessPermissions(data.temporary ? data.permissions || {} : null);
    } catch {
      setAccessPermissions({});
    }
  }, []);

  const lockNow = useCallback(async () => {
    try {
      await post('/admin-lock/lock');
    } finally {
      setLockScope('locked');
    }
  }, []);

  const resetIdleTimer = useCallback(() => {
    window.clearTimeout(idleTimer.current);
    if (lockEnabled && lockScope === 'b') {
      idleTimer.current = window.setTimeout(() => void lockNow(), 30 * 60 * 1000);
    }
  }, [lockEnabled, lockNow, lockScope]);

  useEffect(() => {
    let active = true;
    async function loadLock() {
      try {
        const data = await get<LockStatus>('/admin-lock/status');
        if (!active) return;
        const enabled = Boolean(data.enabled);
        const scope = data.scope || 'locked';
        setLockEnabled(enabled);
        setLockScope(scope);
        if (!enabled || scope === 'b') await loadAccess();
      } catch (loadError) {
        if (!active) return;
        setLockEnabled(true);
        setLockScope('locked');
        setShellError(errorMessage(loadError));
      } finally {
        if (active) setLockReady(true);
      }
    }
    void loadLock();
    return () => {
      active = false;
    };
  }, [loadAccess]);

  useEffect(() => {
    function handleLocked(event: Event) {
      const detail = (event as CustomEvent<string>).detail;
      setLockEnabled(true);
      setLockScope(detail || 'locked');
    }
    window.addEventListener('admin:locked', handleLocked);
    return () => window.removeEventListener('admin:locked', handleLocked);
  }, []);

  useEffect(() => {
    activityEvents.forEach((event) => window.addEventListener(event, resetIdleTimer, { passive: true }));
    resetIdleTimer();
    return () => {
      window.clearTimeout(idleTimer.current);
      activityEvents.forEach((event) => window.removeEventListener(event, resetIdleTimer));
    };
  }, [resetIdleTimer]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  function toggleSidebar() {
    if (window.matchMedia('(max-width: 767px)').matches) {
      setMobileOpen((open) => !open);
      return;
    }
    setCollapsed((current) => {
      const next = !current;
      localStorage.setItem('admin_sidebar_collapsed', next ? '1' : '0');
      return next;
    });
  }

  function handleScopeChange(scope: string) {
    setLockScope(scope);
    if (scope === 'b') void loadAccess();
  }

  if (!lockReady) {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <div className="grid w-full max-w-sm gap-3">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </main>
    );
  }

  if (lockEnabled && lockScope !== 'b') {
    return <AdminGate scope={lockScope} onScopeChange={handleScopeChange} />;
  }

  return (
    <div
      className={cn(
        'min-h-screen bg-background transition-[grid-template-columns] duration-200 md:grid',
        collapsed ? 'md:grid-cols-[84px_minmax(0,1fr)]' : 'md:grid-cols-[272px_minmax(0,1fr)]',
      )}
    >
      <aside className="sticky top-0 hidden h-screen border-r border-sidebar-border md:block">
        <AdminSidebar collapsed={collapsed} accessPermissions={accessPermissions} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[min(88vw,320px)] p-0" showCloseButton={false}>
          <SheetHeader className="sr-only">
            <SheetTitle>后台导航</SheetTitle>
            <SheetDescription>选择要打开的管理功能。</SheetDescription>
          </SheetHeader>
          <AdminSidebar accessPermissions={accessPermissions} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <main className="relative min-w-0">
        {navigation.state !== 'idle' ? (
          <div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-primary/15">
            <div className="h-full w-1/3 animate-pulse bg-primary" />
          </div>
        ) : null}
        <AdminTopbar onToggleSidebar={toggleSidebar} onLock={() => void lockNow()} />
        <div className="p-4 sm:p-6 lg:p-8">
          {shellError ? <p className="mb-4 text-sm text-destructive">{shellError}</p> : null}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
