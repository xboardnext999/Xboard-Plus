import { createRouter, createWebHashHistory } from 'vue-router';
import AdminLayout from '../layout/AdminLayout.vue';
import { flatMenus } from '../config/menu';

const page = (name) => () => import(`../pages/${name}.vue`);
const Dashboard = page('Dashboard'), GroupBuy = page('GroupBuy'), ResourcePage = page('ResourcePage'), Login = page('Login');
const SystemConfig = page('SystemConfig'), AdminLockSettings = page('AdminLockSettings'), PluginManagement = page('PluginManagement'), ThemeManagement = page('ThemeManagement'), NoticeManagement = page('NoticeManagement'), PaymentManagement = page('PaymentManagement'), KnowledgeManagement = page('KnowledgeManagement');
const TemporaryAccess = page('TemporaryAccess'), AuditManagement = page('AuditManagement'), BackupManagement = page('BackupManagement');
const ServerManagement = page('ServerManagement'), NodeManagement = page('NodeManagement'), GroupManagement = page('GroupManagement'), RouteManagement = page('RouteManagement'), NodeDiagnostics = page('NodeDiagnostics');
const PlanManagement = page('PlanManagement'), OrderManagement = page('OrderManagement'), CouponManagement = page('CouponManagement'), GiftCardManagement = page('GiftCardManagement'), UserManagement = page('UserManagement'), TicketManagement = page('TicketManagement'), TrafficResetManagement = page('TrafficResetManagement');

const menuRoutes = flatMenus
  .filter((item) => !['/dashboard', '/system/config', '/system/admin-lock', '/system/temporary-access', '/system/audit', '/system/backup', '/system/plugin', '/system/theme', '/system/notice', '/system/payment', '/system/knowledge', '/node/server', '/node/list', '/node/group', '/node/route', '/node/diagnostic', '/subscription/plan', '/subscription/order', '/subscription/coupon', '/subscription/gift-card', '/user/list', '/user/ticket', '/user/traffic-reset-log', '/finance/plan?xgb=group-buy'].includes(item.path))
  .map((item) => ({
    path: item.path,
    name: item.title,
    component: ResourcePage,
    meta: { title: item.title, group: item.group },
  }));

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/login', name: 'Login', component: Login, meta: { public: true, title: '登录' } },
    {
      path: '/',
      component: AdminLayout,
      redirect: '/dashboard',
      children: [
        { path: 'plugin-apps', redirect: '/system/plugin' },
        {
          path: 'dashboard',
          name: 'Dashboard',
          component: Dashboard,
          meta: { title: '仪表盘' },
        },
        { path: 'system/config', name: 'SystemConfig', component: SystemConfig, meta: { title: '系统配置', group: '系统管理' } },
        { path: 'system/admin-lock', name: 'AdminLockSettings', component: AdminLockSettings, meta: { title: '后台访问锁', group: '系统管理' } },
        { path: 'system/temporary-access', name: 'TemporaryAccess', component: TemporaryAccess, meta: { title: '临时访问', group: '系统管理' } },
        { path: 'system/audit', name: 'AuditManagement', component: AuditManagement, meta: { title: '操作审计', group: '系统管理' } },
        { path: 'system/backup', name: 'BackupManagement', component: BackupManagement, meta: { title: '备份管理', group: '系统管理' } },
        { path: 'system/plugin', name: 'PluginManagement', component: PluginManagement, meta: { title: '插件管理', group: '系统管理' } },
        { path: 'system/theme', name: 'ThemeManagement', component: ThemeManagement, meta: { title: '主题配置', group: '系统管理' } },
        { path: 'system/notice', name: 'NoticeManagement', component: NoticeManagement, meta: { title: '公告管理', group: '系统管理' } },
        { path: 'system/payment', name: 'PaymentManagement', component: PaymentManagement, meta: { title: '支付配置', group: '系统管理' } },
        { path: 'system/knowledge', name: 'KnowledgeManagement', component: KnowledgeManagement, meta: { title: '知识库管理', group: '系统管理' } },
        { path: 'node/server', name: 'ServerManagement', component: ServerManagement, meta: { title: '服务器管理', group: '节点管理' } },
        { path: 'node/list', name: 'NodeManagement', component: NodeManagement, meta: { title: '节点管理', group: '节点管理' } },
        { path: 'node/group', name: 'GroupManagement', component: GroupManagement, meta: { title: '权限组管理', group: '节点管理' } },
        { path: 'node/route', name: 'RouteManagement', component: RouteManagement, meta: { title: '路由管理', group: '节点管理' } },
        { path: 'node/diagnostic', name: 'NodeDiagnostics', component: NodeDiagnostics, meta: { title: '节点数据分析', group: '节点管理' } },
        { path: 'subscription/plan', name: 'PlanManagement', component: PlanManagement, meta: { title: '套餐管理', group: '订阅管理' } },
        { path: 'subscription/order', name: 'OrderManagement', component: OrderManagement, meta: { title: '订单管理', group: '订阅管理' } },
        { path: 'subscription/coupon', name: 'CouponManagement', component: CouponManagement, meta: { title: '优惠券管理', group: '订阅管理' } },
        { path: 'subscription/gift-card', name: 'GiftCardManagement', component: GiftCardManagement, meta: { title: '礼品卡管理', group: '订阅管理' } },
        { path: 'user/list', name: 'UserManagement', component: UserManagement, meta: { title: '用户管理', group: '用户管理' } },
        { path: 'user/ticket', name: 'TicketManagement', component: TicketManagement, meta: { title: '工单管理', group: '用户管理' } },
        { path: 'user/traffic-reset-log', name: 'TrafficResetManagement', component: TrafficResetManagement, meta: { title: '流量重置日志', group: '用户管理' } },
        {
          path: 'finance/plan',
          name: 'GroupBuy',
          component: GroupBuy,
          meta: { title: '拼团管理', group: '订阅管理' },
        },
        ...menuRoutes.map((route) => ({
          ...route,
          path: route.path.replace(/^\//, ''),
        })),
      ],
    },
  ],
});

router.beforeEach((to) => {
  if (to.meta.public) return true;
  const token = localStorage.getItem('XBOARD_ACCESS_TOKEN') || localStorage.getItem('token') || localStorage.getItem('access_token');
  return token ? true : { name: 'Login' };
});

export default router;
