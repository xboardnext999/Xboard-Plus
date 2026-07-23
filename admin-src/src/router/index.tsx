import { lazy, Suspense, type ReactNode } from 'react';
import { createHashRouter, Navigate, Outlet } from 'react-router-dom';

import { AdminLayout } from '@/layout/AdminLayout';
import { hasAuthToken } from '@/services/http';

const Login = lazy(() => import('@/pages/Login').then((module) => ({ default: module.Login })));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const SystemConfig = lazy(() => import('@/pages/SystemConfig'));
const AdminLockSettings = lazy(() => import('@/pages/AdminLockSettings'));
const TemporaryAccess = lazy(() => import('@/pages/TemporaryAccess'));
const AuditManagement = lazy(() => import('@/pages/AuditManagement'));
const BackupManagement = lazy(() => import('@/pages/BackupManagement'));
const PluginManagement = lazy(() => import('@/pages/PluginManagement'));
const ThemeManagement = lazy(() => import('@/pages/ThemeManagement'));
const NoticeManagement = lazy(() => import('@/pages/NoticeManagement'));
const PaymentManagement = lazy(() => import('@/pages/PaymentManagement'));
const KnowledgeManagement = lazy(() => import('@/pages/KnowledgeManagement'));
const ServerManagement = lazy(() => import('@/pages/ServerManagement'));
const NodeManagement = lazy(() => import('@/pages/NodeManagement'));
const GroupManagement = lazy(() => import('@/pages/GroupManagement'));
const RouteManagement = lazy(() => import('@/pages/RouteManagement'));
const NodeDiagnostics = lazy(() => import('@/pages/NodeDiagnostics'));
const PlanManagement = lazy(() => import('@/pages/PlanManagement'));
const GroupBuy = lazy(() => import('@/pages/GroupBuy'));
const OrderManagement = lazy(() => import('@/pages/OrderManagement'));
const CouponManagement = lazy(() => import('@/pages/CouponManagement'));
const GiftCardManagement = lazy(() => import('@/pages/GiftCardManagement'));
const UserManagement = lazy(() => import('@/pages/UserManagement'));
const TicketManagement = lazy(() => import('@/pages/TicketManagement'));
const TrafficResetManagement = lazy(() => import('@/pages/TrafficResetManagement'));
const DigitalProductManagement = lazy(() => import('@/pages/DigitalProductManagement'));
const DigitalInventoryManagement = lazy(() => import('@/pages/DigitalInventoryManagement'));
const DigitalDeliveryManagement = lazy(() => import('@/pages/DigitalDeliveryManagement'));
const ForwardingPlanManagement = lazy(() => import('@/pages/ForwardingPlanManagement'));
const FluxManagement = lazy(() => import('@/pages/FluxManagement'));

function RouteLoading() {
  return (
    <div className="flex min-h-[320px] items-center justify-center" role="status" aria-label="页面加载中">
      <span className="size-7 animate-spin rounded-full border-2 border-slate-200 border-t-[#027bfe]" />
    </div>
  );
}

function deferred(element: ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>;
}

function RequireAuth() {
  return hasAuthToken() ? <Outlet /> : <Navigate to="/login" replace />;
}

const pages = [
  ['dashboard', <Dashboard />],
  ['system/config', <SystemConfig />],
  ['system/admin-lock', <AdminLockSettings />],
  ['system/temporary-access', <TemporaryAccess />],
  ['system/audit', <AuditManagement />],
  ['system/backup', <BackupManagement />],
  ['system/plugin', <PluginManagement />],
  ['system/theme', <ThemeManagement />],
  ['system/notice', <NoticeManagement />],
  ['system/payment', <PaymentManagement />],
  ['system/knowledge', <KnowledgeManagement />],
  ['node/server', <ServerManagement />],
  ['node/list', <NodeManagement />],
  ['node/group', <GroupManagement />],
  ['node/route', <RouteManagement />],
  ['node/diagnostic', <NodeDiagnostics />],
  ['subscription/plan', <PlanManagement />],
  ['finance/plan', <GroupBuy />],
  ['subscription/order', <OrderManagement />],
  ['subscription/coupon', <CouponManagement />],
  ['subscription/gift-card', <GiftCardManagement />],
  ['user/list', <UserManagement />],
  ['user/ticket', <TicketManagement />],
  ['user/traffic-reset-log', <TrafficResetManagement />],
  ['digital/products', <DigitalProductManagement />],
  ['digital/inventory', <DigitalInventoryManagement />],
  ['digital/orders', <OrderManagement />],
  ['digital/delivery', <DigitalDeliveryManagement />],
  ['forwarding/plans', <ForwardingPlanManagement />],
  ['forwarding/:resource', <FluxManagement />],
] as const;

export const router = createHashRouter([
  { path: '/login', element: deferred(<Login />) },
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/',
        element: <AdminLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: 'plugin-apps', element: <Navigate to="/system/plugin" replace /> },
          ...pages.map(([path, element]) => ({ path, element: deferred(element) })),
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to={hasAuthToken() ? '/dashboard' : '/login'} replace /> },
]);
