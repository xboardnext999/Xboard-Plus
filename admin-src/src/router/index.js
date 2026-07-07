import { createRouter, createWebHashHistory } from 'vue-router';
import AdminLayout from '../layout/AdminLayout.vue';
import Dashboard from '../pages/Dashboard.vue';
import GroupBuy from '../pages/GroupBuy.vue';
import Placeholder from '../pages/Placeholder.vue';
import { flatMenus } from '../config/menu';

const menuRoutes = flatMenus
  .filter((item) => !['/dashboard', '/finance/plan?xgb=group-buy'].includes(item.path))
  .map((item) => ({
    path: item.path,
    name: item.title,
    component: Placeholder,
    meta: { title: item.title, group: item.group },
  }));

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
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

export default router;
