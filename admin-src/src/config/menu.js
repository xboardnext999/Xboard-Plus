export const menuGroups = [
  {
    title: '',
    items: [
      { title: '仪表盘', path: '/dashboard', icon: 'Gauge' },
    ],
  },
  {
    title: '系统管理',
    items: [
      { title: '系统配置', path: '/system/config', icon: 'SlidersHorizontal' },
      { title: '后台访问锁', path: '/system/admin-lock', icon: 'LockKeyhole' },
      { title: '临时访问', path: '/system/temporary-access', icon: 'UserRound' },
      { title: '操作审计', path: '/system/audit', icon: 'FileText' },
      { title: '备份管理', path: '/system/backup', icon: 'DatabaseBackup' },
      { title: '插件管理', path: '/system/plugin', icon: 'Box' },
      { title: '主题配置', path: '/system/theme', icon: 'Monitor' },
      { title: '公告管理', path: '/system/notice', icon: 'Newspaper' },
      { title: '支付配置', path: '/system/payment', icon: 'CreditCard' },
      { title: '知识库管理', path: '/system/knowledge', icon: 'BookOpen' },
    ],
  },
  {
    title: '节点管理',
    items: [
      { title: '服务器管理', path: '/node/server', icon: 'Server' },
      { title: '节点管理', path: '/node/list', icon: 'HardDrive' },
      { title: '权限组管理', path: '/node/group', icon: 'LockKeyhole' },
      { title: '路由管理', path: '/node/route', icon: 'Route' },
      { title: '节点数据分析', path: '/node/diagnostic', icon: 'Activity' },
    ],
  },
  {
    title: '订阅管理',
    items: [
      { title: '套餐管理', path: '/subscription/plan', icon: 'Store' },
      { title: '拼团管理', path: '/finance/plan?xgb=group-buy', icon: 'UsersRound' },
      { title: '订单管理', path: '/subscription/order', icon: 'CreditCard' },
      { title: '优惠券管理', path: '/subscription/coupon', icon: 'BadgePercent' },
      { title: '礼品卡管理', path: '/subscription/gift-card', icon: 'Gift' },
    ],
  },
  {
    title: '用户管理',
    items: [
      { title: '用户管理', path: '/user/list', icon: 'UserRound' },
      { title: '工单管理', path: '/user/ticket', icon: 'Ticket' },
      { title: '流量重置日志', path: '/user/traffic-reset-log', icon: 'RefreshCw' },
    ],
  },
];

export const flatMenus = menuGroups.flatMap((group) => group.items.map((item) => ({
  ...item,
  group: group.title,
})));

export function titleByPath(path) {
  const cleanPath = String(path).split('?')[0];
  return flatMenus.find((item) => item.path.split('?')[0] === cleanPath)?.title || '仪表盘';
}
