import { createRouter, createWebHashHistory } from 'vue-router';
import AdminLayout from '../layout/AdminLayout.vue';
import Dashboard from '../pages/Dashboard.vue';
import GroupBuy from '../pages/GroupBuy.vue';
import ResourcePage from '../pages/ResourcePage.vue';
import Login from '../pages/Login.vue';
import { flatMenus } from '../config/menu';

const menuRoutes = flatMenus
  .filter((item) => !['/dashboard', '/finance/plan?xgb=group-buy'].includes(item.path))
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
