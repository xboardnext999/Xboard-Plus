export const resources = {
  '/system/config': { title: '系统配置', endpoint: '/config/fetch', save: '/config/save', rowKeys: ['key', 'value'] },
  '/system/plugin': { title: '插件管理', endpoint: '/plugin/getPlugins', rowKeys: ['name', 'code', 'version', 'type', 'status'] },
  '/system/theme': { title: '主题配置', endpoint: '/theme/getThemes', rowKeys: ['name', 'version', 'author', 'status'] },
  '/system/notice': { title: '公告管理', endpoint: '/notice/fetch', save: '/notice/save', drop: '/notice/drop', rowKeys: ['id', 'title', 'tags', 'show', 'popup'] },
  '/system/payment': { title: '支付配置', endpoint: '/payment/fetch', save: '/payment/save', drop: '/payment/drop', rowKeys: ['id', 'name', 'payment', 'handling_fee_percent', 'enable'] },
  '/system/knowledge': { title: '知识库管理', endpoint: '/knowledge/fetch', save: '/knowledge/save', drop: '/knowledge/drop', rowKeys: ['id', 'title', 'category', 'show', 'updated_at'] },
  '/node/server': { title: '服务器管理', endpoint: '/server/machine/fetch', save: '/server/machine/save', drop: '/server/machine/drop', rowKeys: ['id', 'name', 'host', 'status', 'updated_at'] },
  '/node/list': { title: '节点管理', endpoint: '/server/manage/getNodes', save: '/server/manage/save', drop: '/server/manage/drop', rowKeys: ['id', 'name', 'type', 'host', 'port', 'is_online'] },
  '/node/group': { title: '权限组管理', endpoint: '/server/group/fetch', save: '/server/group/save', drop: '/server/group/drop', rowKeys: ['id', 'name', 'user_count', 'server_count'] },
  '/node/route': { title: '路由管理', endpoint: '/server/route/fetch', save: '/server/route/save', drop: '/server/route/drop', rowKeys: ['id', 'remarks', 'match', 'action'] },
  '/node/diagnostic': { title: '节点数据分析', endpoint: '/node-sync-diagnostic/snapshots', rowKeys: ['id', 'node_id', 'node_name', 'status', 'created_at'] },
  '/subscription/plan': { title: '套餐管理', endpoint: '/plan/fetch', save: '/plan/save', drop: '/plan/drop', rowKeys: ['id', 'name', 'group_id', 'transfer_enable', 'show', 'renew'] },
  '/subscription/order': { title: '订单管理', endpoint: '/order/fetch', rowKeys: ['trade_no', 'user_id', 'plan_id', 'total_amount', 'status', 'created_at'], paginated: true },
  '/subscription/coupon': { title: '优惠券管理', endpoint: '/coupon/fetch', save: '/coupon/generate', drop: '/coupon/drop', rowKeys: ['id', 'code', 'name', 'type', 'value', 'limit_use', 'show'], paginated: true },
  '/subscription/gift-card': { title: '礼品卡管理', endpoint: '/gift-card/templates', rowKeys: ['id', 'name', 'type', 'value', 'status', 'created_at'], paginated: true },
  '/user/list': { title: '用户管理', endpoint: '/user/fetch', rowKeys: ['id', 'email', 'plan_id', 'balance', 'commission_balance', 'expired_at', 'banned'], paginated: true },
  '/user/ticket': { title: '工单管理', endpoint: '/ticket/fetch', rowKeys: ['id', 'subject', 'user_id', 'level', 'status', 'updated_at'], paginated: true },
  '/user/traffic-reset-log': { title: '流量重置日志', endpoint: '/traffic-reset/logs', rowKeys: ['id', 'user_id', 'email', 'type', 'reset_at', 'created_at'], paginated: true },
  '/plugin-apps': { title: '插件应用', endpoint: '/plugin/getPlugins', rowKeys: ['name', 'code', 'version', 'type', 'status'] },
};

export function resourceFor(path) {
  return resources[path];
}
