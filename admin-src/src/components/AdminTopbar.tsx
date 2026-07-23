import { useState } from 'react';
import { Bell, Check, ChevronDown, Globe2, Lock, LogOut, Menu, Moon, Search, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useLocation, useNavigate } from 'react-router-dom';

import { AppIcon } from '@/components/AppIcon';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { flatMenus, titleByPath } from '@/config/menu';
import { cn } from '@/lib/utils';
import { clearAuthTokens } from '@/services/http';

interface AdminTopbarProps {
  onToggleSidebar: () => void;
  onLock: () => void;
}

const roundButtonClass =
  'relative size-11 rounded-full border-0 bg-card shadow-[0_4px_18px_rgba(15,23,42,0.08)] hover:bg-card/90 dark:shadow-[0_4px_18px_rgba(0,0,0,0.24)]';

function RoundAction({
  label,
  children,
  onClick,
  className,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            className={cn(roundButtonClass, className)}
            aria-label={label}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function AdminTopbar({ onToggleSidebar, onLock }: AdminTopbarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const title = titleByPath(`${location.pathname}${location.search}`);

  function go(path: string) {
    setSearchOpen(false);
    void navigate(path);
  }

  function logout() {
    clearAuthTokens();
    void navigate('/login', { replace: true });
  }

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between gap-4 border-b bg-background/90 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Button type="button" variant="ghost" size="icon-lg" aria-label="展开或收起菜单" onClick={onToggleSidebar}>
          <Menu />
        </Button>
        <strong className="truncate text-lg font-semibold tracking-tight">{title}</strong>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <Button
          type="button"
          variant="outline"
          className="hidden w-64 justify-start gap-2 bg-card text-muted-foreground shadow-sm lg:flex"
          onClick={() => setSearchOpen(true)}
        >
          <Search className="size-4" />
          搜索菜单和功能…
          <kbd className="ml-auto rounded border bg-muted px-1.5 py-0.5 text-[10px]">⌘ K</kbd>
        </Button>
        <RoundAction label="搜索" className="lg:hidden" onClick={() => setSearchOpen(true)}>
          <Search />
        </RoundAction>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                className={roundButtonClass}
                aria-label="通知"
              />
            }
          >
            <Bell className="size-5" />
            <span className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-primary ring-2 ring-background" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>通知</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>暂无可显示的通知</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <RoundAction
          label={resolvedTheme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        >
          {resolvedTheme === 'dark' ? <Sun /> : <Moon />}
        </RoundAction>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                className={roundButtonClass}
                aria-label="语言"
              />
            }
          >
            <Globe2 className="size-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>显示语言</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Check />
              简体中文
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button type="button" variant="outline" className="h-10 rounded-full bg-card px-1.5 pr-3 shadow-sm" />
            }
          >
            <Avatar size="sm">
              <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">A</AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline">admin</span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>管理员账户</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLock}>
              <Lock />
              立即锁定后台
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={logout}>
              <LogOut />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CommandDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        title="搜索后台功能"
        description="输入页面名称或分组快速跳转。"
      >
        <CommandInput placeholder="搜索菜单和功能…" />
        <CommandList>
          <CommandEmpty>没有找到相关功能</CommandEmpty>
          <CommandGroup heading="后台功能">
            {flatMenus.map((item) => (
              <CommandItem key={item.path} value={`${item.title} ${item.group}`} onSelect={() => go(item.path)}>
                <AppIcon name={item.icon} />
                <span>{item.title}</span>
                <span className="ml-auto text-xs text-muted-foreground">{item.group || '首页'}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </header>
  );
}
