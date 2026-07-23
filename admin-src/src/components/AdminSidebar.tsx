import { Link, useLocation } from 'react-router-dom';

import { AppIcon } from '@/components/AppIcon';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { menuGroups, type AdminMenuItem } from '@/config/menu';
import { cn } from '@/lib/utils';

export type AccessPermissions = Record<string, boolean | string> | null;

interface AdminSidebarProps {
  collapsed?: boolean;
  accessPermissions?: AccessPermissions;
  onNavigate?: () => void;
}

function canAccess(item: AdminMenuItem, permissions: AccessPermissions) {
  const permissionPath = item.path.split('?')[0] ?? item.path;
  return permissions === null || Boolean(permissions[permissionPath]);
}

export function AdminSidebar({
  collapsed = false,
  accessPermissions = null,
  onNavigate,
}: AdminSidebarProps) {
  const location = useLocation();
  const fullPath = `${location.pathname}${location.search}`;
  const visibleGroups = menuGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => canAccess(item, accessPermissions)) }))
    .filter((group) => group.items.length > 0);

  function menuLink(item: AdminMenuItem) {
    const active = item.path.includes('?') ? fullPath === item.path : location.pathname === item.path;
    const content = (
      <>
        <AppIcon name={item.icon} className="size-[18px] shrink-0" strokeWidth={2.2} />
        <span className={cn('truncate', collapsed && 'sr-only')}>{item.title}</span>
      </>
    );
    const className = cn(
      'flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-sidebar-foreground/70 transition-colors',
      'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
      collapsed && 'justify-center px-0',
      active && 'bg-sidebar-primary text-black shadow-sm hover:bg-sidebar-primary hover:text-black',
    );

    if (!collapsed) {
      return (
        <Link key={item.path} to={item.path} className={className} onClick={onNavigate}>
          {content}
        </Link>
      );
    }

    return (
      <Tooltip key={item.path}>
        <TooltipTrigger
          render={<Link to={item.path} className={className} onClick={onNavigate} />}
        >
          {content}
        </TooltipTrigger>
        <TooltipContent side="right">{item.title}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
      <Link
        to="/dashboard"
        className={cn('flex h-20 shrink-0 items-center gap-3 border-b border-sidebar-border px-5', collapsed && 'justify-center px-2')}
        onClick={onNavigate}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-lg font-black text-primary-foreground shadow-sm">X</span>
        <span className={cn('text-base font-semibold tracking-tight', collapsed && 'sr-only')}>Xboard Plus</span>
      </Link>
      <ScrollArea className="min-h-0 flex-1">
        <nav className="grid gap-6 p-3">
          {visibleGroups.map((group) => (
            <section key={group.title || 'root'} className="grid gap-1.5">
              {group.title && !collapsed ? (
                <h2 className="px-3 text-[11px] font-semibold tracking-[0.14em] text-sidebar-foreground/40 uppercase">
                  {group.title}
                </h2>
              ) : null}
              <div className="grid gap-1">{group.items.map(menuLink)}</div>
            </section>
          ))}
        </nav>
      </ScrollArea>
    </div>
  );
}
