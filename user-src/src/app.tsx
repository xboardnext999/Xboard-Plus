import { lazy, Suspense } from "react"
import { HashRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom"
import { AppProviders, useSession } from "@/app/providers"
import { PageLoading } from "@/components/common"
import { AppShell, AuthLayout } from "@/layouts/app-shell"

const loadAuthPages = () => import("@/pages/auth")
const LoginPage = lazy(() => loadAuthPages().then(({ LoginPage }) => ({ default: LoginPage })))
const RegisterPage = lazy(() => loadAuthPages().then(({ RegisterPage }) => ({ default: RegisterPage })))
const ForgotPage = lazy(() => loadAuthPages().then(({ ForgotPage }) => ({ default: ForgotPage })))

const DashboardPage = lazy(() => import("@/pages/dashboard").then(({ DashboardPage }) => ({ default: DashboardPage })))
const SubscriptionsPage = lazy(() => import("@/pages/subscriptions").then(({ SubscriptionsPage }) => ({ default: SubscriptionsPage })))
const PlansPage = lazy(() => import("@/pages/plans").then(({ PlansPage }) => ({ default: PlansPage })))

const loadDigitalPages = () => import("@/pages/digital")
const DigitalProductsPage = lazy(() => loadDigitalPages().then(({ DigitalProductsPage }) => ({ default: DigitalProductsPage })))
const DigitalProductDetailPage = lazy(() => loadDigitalPages().then(({ DigitalProductDetailPage }) => ({ default: DigitalProductDetailPage })))
const DigitalCheckoutPage = lazy(() => loadDigitalPages().then(({ DigitalCheckoutPage }) => ({ default: DigitalCheckoutPage })))

const OrdersPage = lazy(() => import("@/pages/orders").then(({ OrdersPage }) => ({ default: OrdersPage })))
const RechargePage = lazy(() => import("@/pages/recharge").then(({ RechargePage }) => ({ default: RechargePage })))

const loadAccountPages = () => import("@/pages/account")
const ProfilePage = lazy(() => loadAccountPages().then(({ ProfilePage }) => ({ default: ProfilePage })))
const NodesPage = lazy(() => loadAccountPages().then(({ NodesPage }) => ({ default: NodesPage })))
const TrafficPage = lazy(() => loadAccountPages().then(({ TrafficPage }) => ({ default: TrafficPage })))
const TicketsPage = lazy(() => loadAccountPages().then(({ TicketsPage }) => ({ default: TicketsPage })))
const InvitePage = lazy(() => loadAccountPages().then(({ InvitePage }) => ({ default: InvitePage })))
const KnowledgePage = lazy(() => loadAccountPages().then(({ KnowledgePage }) => ({ default: KnowledgePage })))

function RequireAuth() {
  const session = useSession()
  const location = useLocation()
  if (!session.ready) return <main className="grid min-h-screen place-items-center p-6"><div className="w-full max-w-4xl"><PageLoading cards={3} /></div></main>
  if (!session.authenticated) {
    const redirect = `${location.pathname.replace(/^\//, "")}${location.search}`
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />
  }
  return <Outlet />
}

function LoginRoute() {
  const session = useSession()
  if (!session.ready) return <PageLoading cards={1} />
  if (session.authenticated) return <Navigate to="/dashboard" replace />
  return <LoginPage />
}

function RouteChunkBoundary({ cards = 3 }: { cards?: number }) {
  return <Suspense fallback={<div className="p-6"><PageLoading cards={cards} /></div>}><Outlet /></Suspense>
}

function Router() {
  return <HashRouter>
    <Routes>
      <Route element={<AuthLayout />}>
        <Route element={<RouteChunkBoundary cards={1} />}>
          <Route path="/login" element={<LoginRoute />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot" element={<ForgotPage />} />
        </Route>
      </Route>
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route element={<RouteChunkBoundary />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/subscribe" element={<SubscriptionsPage />} />
            <Route path="/plans" element={<PlansPage />} />
            <Route path="/digital" element={<DigitalProductsPage />} />
            <Route path="/digital-detail" element={<DigitalProductDetailPage />} />
            <Route path="/digital-checkout" element={<DigitalCheckoutPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/recharge" element={<RechargePage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/nodes" element={<NodesPage />} />
            <Route path="/traffic" element={<TrafficPage />} />
            <Route path="/tickets" element={<TicketsPage />} />
            <Route path="/invite" element={<InvitePage />} />
            <Route path="/knowledge" element={<KnowledgePage />} />
          </Route>
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  </HashRouter>
}

export default function App() {
  return <AppProviders><Router /></AppProviders>
}
