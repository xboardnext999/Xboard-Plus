# Xboard Plus Admin Source

这是后台管理端的 Vue3 源码重建工程，用于替代直接修改 `public/assets/admin/assets/index-*.js` 这类打包产物的方式。

## 目录

- `src/layout/AdminLayout.vue`：后台整体布局。
- `src/components/AdminSidebar.vue`：左侧菜单。
- `src/components/AdminTopbar.vue`：顶部栏。
- `src/config/menu.js`：菜单和路由映射。
- `src/services/http.js`：后台接口请求封装。
- `src/pages/GroupBuy.vue`：拼团管理页面源码。

## 开发

```bash
cd admin-src
npm install
npm run dev
```

## 构建

```bash
cd admin-src
npm run build
```

构建产物默认输出到：

```text
public/assets/admin-vue
```

当前工程不会覆盖线上正在使用的 `public/assets/admin`。如需正式切换，需要确认菜单、路由和未迁移页面后再调整部署入口。
