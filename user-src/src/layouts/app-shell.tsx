import * as React from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useLanguage, useSession, useTheme } from "@/app/providers"
import { appAsset, appName, defaultAvatar, languageOptions, logoUrl } from "@/lib/runtime"
import {
  Bell, BookOpen, ChartNoAxesCombined, ChevronLeft, CircleDollarSign, CreditCard, Gauge, Gift,
  Globe2, Headphones, LogOut, Menu, Moon, Network, Package, PanelLeftClose, PanelLeftOpen,
  Settings, ShoppingBag, Sun, TicketCheck, UserRound, Users, WalletCards, X,
} from "lucide-react"
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"

const navItems = [
  { to: "/dashboard", label: "仪表盘", icon: Gauge },
  { to: "/plans", label: "购买套餐", icon: ShoppingBag },
  { to: "/digital", label: "数字商品", icon: Package },
  { to: "/invite", label: "邀请好友", icon: Gift },
  { to: "/subscribe", label: "我的订阅", icon: CreditCard, group: "订阅" },
  { to: "/recharge", label: "充值余额", icon: WalletCards, group: "订阅" },
  { to: "/knowledge", label: "使用教程", icon: BookOpen, group: "服务" },
  { to: "/tickets", label: "工单中心", icon: Headphones, group: "服务" },
  { to: "/nodes", label: "节点状态", icon: Network, group: "记录" },
  { to: "/orders", label: "订单记录", icon: TicketCheck, group: "记录" },
  { to: "/traffic", label: "流量统计", icon: ChartNoAxesCombined, group: "记录" },
  { to: "/profile", label: "账号设置", icon: UserRound, group: "账号" },
]

const titles: Record<string, string> = Object.fromEntries(navItems.map((item) => [item.to, item.label]))
function userName(user: Record<string, any> | null) { return String(user?.name || user?.email?.split("@")[0] || "用户") }

export function AppShell() {
  const { user, stat, logout } = useSession()
  const { theme, toggleTheme } = useTheme()
  const { language, setLanguage } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  React.useEffect(() => setMobileOpen(false), [location.pathname, location.search])
  const currentLanguage = languageOptions.find((item) => item.code === language) || languageOptions[0]
  const avatar = user?.avatar || (user?.avatar_url && !String(user.avatar_url).includes("/gravatar/") ? user.avatar_url : defaultAvatar())
  const title = titles[location.pathname] || (location.pathname.startsWith("/digital") ? "数字商品" : "Xboard Plus")
  const groups = [...new Set(navItems.map((item) => item.group || ""))]

  const sidebar = <aside className="app-sidebar flex flex-col" style={collapsed ? { width: 82 } : undefined}>
    <div className={cn("flex h-18 items-center gap-3 border-b px-5", collapsed && "justify-center px-2")}>
      <img src={logoUrl()} alt="" className="size-10 object-contain" />
      {!collapsed ? <div className="min-w-0"><strong className="block truncate text-base">{appName()}</strong><span className="text-xs text-muted-foreground">用户中心</span></div> : null}
      <Button variant="ghost" size="icon-sm" className="ml-auto hidden lg:inline-flex" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "展开菜单" : "收起菜单"}>{collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</Button>
      <Button variant="ghost" size="icon-sm" className="ml-auto lg:hidden" onClick={() => setMobileOpen(false)} aria-label="关闭菜单"><X /></Button>
    </div>
    <nav className="flex-1 space-y-5 overflow-y-auto p-3">{groups.map((group) => <div key={group || "main"} className="space-y-1">{group && !collapsed ? <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">{group}</p> : null}{navItems.filter((item) => (item.group || "") === group).map((item) => {
      const Icon = item.icon
      const content = <NavLink to={item.to} className={({ isActive }) => cn("relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", collapsed && "justify-center px-0", isActive && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground")}>
        <Icon className="size-4.5 shrink-0" />{!collapsed ? <span>{item.label}</span> : null}{item.to === "/tickets" && Number(stat?.[0] || 0) > 0 ? <span className={cn("ml-auto rounded-full bg-destructive px-1.5 text-[10px] text-white", collapsed && "absolute right-0 top-0")}>{stat[0]}</span> : null}
      </NavLink>
      return collapsed ? <Tooltip key={item.to}><TooltipTrigger asChild>{content}</TooltipTrigger><TooltipContent side="right">{item.label}</TooltipContent></Tooltip> : <React.Fragment key={item.to}>{content}</React.Fragment>
    })}</div>)}</nav>
  </aside>

  return <div className="app-grid" data-mobile-open={mobileOpen} style={collapsed ? { gridTemplateColumns: "82px minmax(0,1fr)" } : undefined}>
    {sidebar}
    {mobileOpen ? <Button type="button" variant="ghost" className="fixed inset-0 z-40 h-auto w-auto rounded-none bg-black/40 p-0 hover:bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="关闭侧栏遮罩" /> : null}
    <div className="app-main">
      <header className="sticky top-0 z-30 flex h-18 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-xl sm:px-6">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="打开菜单"><Menu /></Button>
        <div className="flex min-w-0 items-center gap-2"><ChevronLeft className="size-4 text-muted-foreground" /><strong className="truncate">{title}</strong></div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="icon" className="relative rounded-full" aria-label="消息通知"><Bell /><span className="absolute right-1 top-1 size-2 rounded-full bg-primary ring-2 ring-background" /></Button>
          <Button variant="outline" size="icon" className="rounded-full" onClick={toggleTheme} aria-label="切换主题">{theme === "light" ? <Moon /> : <Sun />}</Button>
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="rounded-full" aria-label="选择语言"><Globe2 /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-52"><DropdownMenuLabel>界面语言</DropdownMenuLabel><DropdownMenuSeparator />{languageOptions.map((item) => <DropdownMenuItem key={item.code} onSelect={() => setLanguage(item.code)} className={cn(item.code === currentLanguage.code && "bg-accent")}><img src={appAsset(`flags/${item.flag}`)} className="size-5 rounded-sm object-cover" alt="" /><span dir={item.rtl ? "rtl" : undefined}>{item.label}</span>{item.code === currentLanguage.code ? <span className="ml-auto text-primary">✓</span> : null}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="h-10 rounded-full px-1.5 sm:pr-3"><Avatar><AvatarImage src={avatar} /><AvatarFallback>{userName(user).slice(0, 1)}</AvatarFallback></Avatar><span className="hidden max-w-28 truncate text-sm sm:inline">{userName(user)}</span></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-56"><DropdownMenuLabel><span className="block truncate">{userName(user)}</span><span className="block truncate text-xs font-normal text-muted-foreground">{user?.email}</span></DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => navigate("/profile")}><Settings />账号设置</DropdownMenuItem><DropdownMenuItem onSelect={() => { logout(); navigate("/login") }} className="text-destructive focus:text-destructive"><LogOut />退出登录</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        </div>
      </header>
      <main className="page-container"><Outlet /></main>
    </div>
  </div>
}

export function AuthLayout() {
  return <main className="relative isolate grid min-h-screen place-items-center overflow-hidden bg-muted/50 p-4 sm:p-8">
    <div className="absolute -left-32 -top-32 size-96 rounded-full bg-primary/10 blur-3xl" />
    <div className="absolute -bottom-40 -right-28 size-[30rem] rounded-full bg-primary/10 blur-3xl" />
    <div className="relative grid w-full max-w-6xl overflow-hidden rounded-4xl bg-card shadow-2xl ring-1 ring-foreground/5 lg:grid-cols-[1.05fr_.95fr] dark:ring-foreground/10">
      <section className="relative hidden min-h-[680px] overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col">
        <div className="absolute -right-24 -top-24 size-72 rounded-full border-[48px] border-white/10" />
        <div className="absolute -bottom-28 -left-20 size-80 rounded-full bg-white/10 blur-2xl" />
        <Link to="/login" className="relative z-10 flex w-fit items-center gap-3 rounded-full bg-white/15 px-4 py-2 backdrop-blur"><img src={logoUrl()} className="size-9 object-contain brightness-0 invert" alt="" /><strong className="font-heading text-lg">{appName()}</strong></Link>
        <div className="relative z-10 my-auto max-w-lg"><p className="mb-5 text-xs font-semibold uppercase tracking-[.24em] text-primary-foreground/70">Secure access</p><h1 className="font-heading text-5xl font-semibold leading-[1.08] tracking-tight">一处管理<br />全部数字服务</h1><p className="mt-6 max-w-md text-base leading-7 text-primary-foreground/80">安全管理订阅、节点、数字商品与账户余额，关键状态清晰可见。</p></div>
        <div className="relative z-10 grid grid-cols-3 gap-3">{[[Users,"账户安全"],[Globe2,"全球节点"],[CircleDollarSign,"便捷支付"]].map(([Icon,label]) => { const IconComp = Icon as React.ComponentType<{className?: string}>; return <div key={String(label)} className="rounded-3xl bg-white/15 p-4 backdrop-blur"><IconComp className="mb-3 size-5" /><span className="text-xs font-medium">{String(label)}</span></div> })}</div>
      </section>
      <section className="flex min-h-[620px] items-center bg-card p-6 sm:p-12 lg:p-14"><div className="mx-auto w-full max-w-md"><div className="mb-8 flex items-center gap-3 lg:hidden"><div className="grid size-11 place-content-center rounded-full bg-primary/10"><img src={logoUrl()} className="size-8 object-contain" alt="" /></div><div><strong className="block font-heading">{appName()}</strong><span className="text-xs text-muted-foreground">用户中心</span></div></div><Outlet /></div></section>
    </div>
  </main>
}
