import * as React from "react"
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { api, clearToken, getToken, setToken } from "@/lib/api"
import { CART_STORAGE_KEY, LANGUAGE_STORAGE_KEY, THEME_STORAGE_KEY, readLanguage, readTheme, writeLanguage } from "@/lib/runtime"

type AnyRecord = Record<string, any>

interface SessionValue {
  ready: boolean
  authenticated: boolean
  guest: AnyRecord
  user: AnyRecord | null
  subscribe: AnyRecord | null
  stat: any[]
  comm: AnyRecord
  loginWithToken: (token: string) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
}

const SessionContext = React.createContext<SessionValue | null>(null)

function SessionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const [authEpoch, setAuthEpoch] = React.useState(0)
  const token = getToken()
  const guestQuery = useQuery({
    queryKey: ["guest-config"],
    queryFn: ({ signal }) => api.get<AnyRecord>("/guest/comm/config", {}, { auth: false, signal }).catch(() => ({})),
    staleTime: 5 * 60_000,
  })
  const sessionQuery = useQuery({
    queryKey: ["session", token, authEpoch],
    enabled: Boolean(token),
    retry: false,
    queryFn: async ({ signal }) => {
      const [user, subscribe, stat, comm] = await Promise.all([
        api.get<AnyRecord>("/user/info", {}, { signal }),
        api.get<AnyRecord>("/user/getSubscribe", {}, { signal }),
        api.get<any[]>("/user/getStat", {}, { signal }),
        api.get<AnyRecord>("/user/comm/config", {}, { signal }),
      ])
      return { user, subscribe, stat: Array.isArray(stat) ? stat : [0, 0, 0], comm: comm || {} }
    },
  })

  const logout = React.useCallback(() => {
    clearToken()
    queryClient.removeQueries({ queryKey: ["session"] })
    setAuthEpoch((value) => value + 1)
  }, [queryClient])

  React.useEffect(() => {
    const expired = () => logout()
    window.addEventListener("xboard:auth-expired", expired)
    return () => window.removeEventListener("xboard:auth-expired", expired)
  }, [logout])

  const refresh = React.useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["session"] })
  }, [queryClient])

  const loginWithToken = React.useCallback(async (value: string) => {
    setToken(value)
    setAuthEpoch((epoch) => epoch + 1)
    await queryClient.invalidateQueries({ queryKey: ["session"] })
  }, [queryClient])

  const authenticated = Boolean(token)
  const ready = guestQuery.isFetched && (!authenticated || sessionQuery.isFetched)
  const value: SessionValue = {
    ready,
    authenticated,
    guest: guestQuery.data || {},
    user: sessionQuery.data?.user || null,
    subscribe: sessionQuery.data?.subscribe || null,
    stat: sessionQuery.data?.stat || [0, 0, 0],
    comm: sessionQuery.data?.comm || {},
    loginWithToken,
    logout,
    refresh,
  }
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const value = React.useContext(SessionContext)
  if (!value) throw new Error("useSession must be used inside AppProviders")
  return value
}

interface ThemeValue { theme: "light" | "dark"; setTheme: (theme: "light" | "dark") => void; toggleTheme: () => void }
const ThemeContext = React.createContext<ThemeValue | null>(null)
function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<"light" | "dark">(readTheme)
  const setTheme = React.useCallback((value: "light" | "dark") => {
    setThemeState(value)
    localStorage.setItem(THEME_STORAGE_KEY, value)
  }, [])
  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
  }, [theme])
  return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme: () => setTheme(theme === "light" ? "dark" : "light") }}>{children}</ThemeContext.Provider>
}
export function useTheme() {
  const value = React.useContext(ThemeContext)
  if (!value) throw new Error("useTheme must be used inside AppProviders")
  return value
}

interface LanguageValue { language: string; setLanguage: (code: string) => void }
const LanguageContext = React.createContext<LanguageValue | null>(null)
function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = React.useState(readLanguage)
  const setLanguage = React.useCallback((code: string) => {
    setLanguageState(code)
    writeLanguage(code)
    localStorage.setItem(LANGUAGE_STORAGE_KEY, code)
  }, [])
  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>
}
export function useLanguage() {
  const value = React.useContext(LanguageContext)
  if (!value) throw new Error("useLanguage must be used inside AppProviders")
  return value
}

export interface CartItem {
  key: string
  plan_id: number
  package_id: string
  quantity: number
  name: string
  package_name: string
  unit_price: number
  image_url?: string
  stock_count?: number | null
}
interface CartValue { items: CartItem[]; add: (item: CartItem) => void; change: (key: string, delta: number) => void; clear: () => void }
const CartContext = React.createContext<CartValue | null>(null)
function loadCart(): CartItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]")
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}
function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<CartItem[]>(loadCart)
  React.useEffect(() => { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items)) }, [items])
  const value = React.useMemo<CartValue>(() => ({
    items,
    add: (item) => setItems((current) => {
      const existing = current.find((entry) => entry.key === item.key)
      if (!existing) return [...current, item]
      return current.map((entry) => entry.key === item.key ? { ...entry, quantity: Math.min(Number(item.stock_count || 20), entry.quantity + item.quantity) } : entry)
    }),
    change: (key, delta) => setItems((current) => current.map((entry) => entry.key === key ? { ...entry, quantity: Math.max(0, Math.min(Number(entry.stock_count || 20), entry.quantity + delta)) } : entry).filter((entry) => entry.quantity > 0)),
    clear: () => setItems([]),
  }), [items])
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
export function useCart() {
  const value = React.useContext(CartContext)
  if (!value) throw new Error("useCart must be used inside AppProviders")
  return value
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 20_000, retry: 1, refetchOnWindowFocus: false },
    mutations: { onError: (error) => toast.error(error instanceof Error ? error.message : "操作失败") },
  },
})

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LanguageProvider>
        <SessionProvider>
          <CartProvider>
            <TooltipProvider delayDuration={180}>
              {children}
              <Toaster />
            </TooltipProvider>
          </CartProvider>
        </SessionProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
}
