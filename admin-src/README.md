# Xboard Plus Admin Source

后台管理端是完整的 React 19 + TypeScript + shadcn/ui 工程。页面与组件均维护在源码中，不再依赖旧 Vue 工程或手工修改编译产物。

## 目录

- `src/layout/AdminLayout.tsx`：后台整体布局。
- `src/components/AdminSidebar.tsx`：左侧菜单。
- `src/components/AdminTopbar.tsx`：顶部栏。
- `src/components/ui/`：shadcn/ui 基础组件。
- `src/config/menu.ts`：菜单和路由映射。
- `src/services/http.ts`：后台接口请求封装。
- `src/pages/`：各后台业务页面。

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
public/assets/admin-react
```

Laravel 会读取 Vite manifest 加载入口与异步页面分包。生产构建不输出 source map。

## 接口约定

页面从 `window.settings.secure_path` 读取后台安全路径，请求 `/api/v2/{secure_path}`。登录令牌从 `XBOARD_ACCESS_TOKEN`、`token` 或 `access_token` 读取，并统一使用 Bearer Authorization。
