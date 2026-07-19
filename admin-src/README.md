# Xboard Plus Admin Source

这是后台管理端的 Vue3 源码重建工程，用于替代直接修改 `public/assets/admin/assets/index-*.js` 这类打包产物的方式。

## 目录

- `src/layout/AdminLayout.vue`：后台整体布局。
- `src/components/AdminSidebar.vue`：左侧菜单。
- `src/components/AdminTopbar.vue`：顶部栏。
- `src/config/menu.js`：菜单和路由映射。
- `src/services/http.js`：后台接口请求封装。
- `src/pages/GroupBuy.vue`：拼团管理专用页面源码。
- `src/pages/ResourcePage.vue`：后台业务模块的统一列表、分页和编辑页面。
- `src/config/resources.js`：所有后台模块与 Laravel API 的映射。

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

构建同时生成 source map，部署后仍可定位回 `.vue` 源文件。默认不会覆盖线上正在使用的 `public/assets/admin`；完成验收后可将 Blade 模板的资源目录切换到 `admin-vue`。

## 接口约定

页面从 `window.settings.secure_path` 读取后台安全路径，请求 `/api/v2/{secure_path}`。登录令牌从 `XBOARD_ACCESS_TOKEN`、`token` 或 `access_token` 读取，并统一使用 Bearer Authorization。
