import { createRouter, createWebHashHistory } from 'vue-router';
import AdminLayout from '../layout/AdminLayout.vue';
import Dashboard from '../pages/Dashboard.vue';
import GroupBuy from '../pages/GroupBuy.vue';
import ResourcePage from '../pages/ResourcePage.vue';
import Login from '../pages/Login.vue';
import SystemConfig from '../pages/SystemConfig.vue';
import PluginManagement from '../pages/PluginManagement.vue';
import ThemeManagement from '../pages/ThemeManagement.vue';
import NoticeManagement from '../pages/NoticeManagement.vue';
import PaymentManagement from '../pages/PaymentManagement.vue';
import KnowledgeManagement from '../pages/KnowledgeManagement.vue';
import ServerManagement from '../pages/ServerManagement.vue';
import NodeManagement from '../pages/NodeManagement.vue';
import GroupManagement from '../pages/GroupManagement.vue';
import { flatMenus } from '../config/menu';

const menuRoutes = flatMenus
  .filter((item) => !['/dashboard', '/system/config', '/system/plugin', '/system/theme', '/system/notice', '/system/payment', '/system/knowledge', '/node/server', '/node/list', '/node/group', '/finance/plan?xgb=group-buy'].includes(item.path))
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
        {
          path: 'dashboard',
          name: 'Dashboard',
          component: Dashboard,
          meta: { title: '仪表盘' },
        },
        { path: 'system/config', name: 'SystemConfig', component: SystemConfig, meta: { title: '系统配置', group: '系统管理' } },
        { path: 'system/plugin', name: 'PluginManagement', component: PluginManagement, meta: { title: '插件管理', group: '系统管理' } },
        { path: 'system/theme', name: 'ThemeManagement', component: ThemeManagement, meta: { title: '主题配置', group: '系统管理' } },
        { path: 'system/notice', name: 'NoticeManagement', component: NoticeManagement, meta: { title: '公告管理', group: '系统管理' } },
        { path: 'system/payment', name: 'PaymentManagement', component: PaymentManagement, meta: { title: '支付配置', group: '系统管理' } },
        { path: 'system/knowledge', name: 'KnowledgeManagement', component: KnowledgeManagement, meta: { title: '知识库管理', group: '系统管理' } },
        { path: 'node/server', name: 'ServerManagement', component: ServerManagement, meta: { title: '服务器管理', group: '节点管理' } },
        { path: 'node/list', name: 'NodeManagement', component: NodeManagement, meta: { title: '节点管理', group: '节点管理' } },
        { path: 'node/group', name: 'GroupManagement', component: GroupManagement, meta: { title: '权限组管理', group: '节点管理' } },
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
