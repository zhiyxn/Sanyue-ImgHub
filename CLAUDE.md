# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是 [CloudFlare-ImgBed](https://github.com/MarSeventh/CloudFlare-ImgBed) 项目的前端仓库，一个基于 Vue 3 的文件托管系统前端应用。该项目支持多种存储渠道（Cloudflare R2、S3 API、Telegram Bot 等），提供文件上传、管理、预览等功能。

## 开发命令

### 启动开发服务器
```bash
npm run serve
```
开发服务器运行在 `http://localhost:3000`，通过代理将 `/api` 请求转发到后端服务（默认 `http://127.0.0.1:8080`）。

### 构建生产版本
```bash
npm run build
```
构建输出到 `/dist` 目录。构建完成后，需要将 `/dist` 目录中的所有内容复制到 `CloudFlare-ImgBed` 后端项目的根目录进行部署。

### 环境配置
- 开发环境：修改 `.env.development` 中的 `VUE_APP_BACKEND_URL` 来配置后端服务地址
- 生产环境：通过 `vue.config.js` 中的代理配置，生产环境下 baseURL 为 `/`

## 核心架构

### 技术栈
- **框架**: Vue 3 (Composition API 和 Options API 混用)
- **UI 库**: Element Plus (使用 unplugin-auto-import 和 unplugin-vue-components 自动导入)
- **图标**: FontAwesome + Element Plus Icons
- **状态管理**: Vuex 4 (使用 vuex-persistedstate 持久化)
- **路由**: Vue Router 4
- **HTTP 客户端**: Axios (自定义实例，支持认证拦截)
- **构建工具**: Vue CLI 5

### 目录结构
```
src/
├── assets/          # 静态资源（背景图等）
├── components/      # 可复用组件
├── mixins/          # Vue mixins（背景管理器）
├── router/          # 路由配置
├── store/           # Vuex 状态管理
├── styles/          # 全局样式
├── utils/           # 工具函数
│   ├── axios.js           # Axios 实例配置
│   ├── fetchWithAuth.js   # 带认证的 fetch 封装
│   └── fileManager.js     # 文件管理工具类
├── views/           # 页面组件
├── App.vue          # 根组件
└── main.js          # 应用入口
```

### 认证系统

项目实现了双重认证机制：

1. **用户认证** (`authCode`)
   - 使用 `vue-cookies` 存储在 cookie 中
   - 通过 `axios.js` 中的请求拦截器添加到 header
   - 需要在请求配置中设置 `withAuthCode: true` 来启用
   - 401 错误会自动跳转到 `/login` 页面
   - 路由守卫：`userAuthGuard` (router/index.js:35)

2. **管理员认证** (`credentials`)
   - 使用 Basic Auth，存储在 Vuex store 中
   - 通过 `fetchWithAuth.js` 封装的 fetch 函数处理
   - 路由守卫：`adminAuthGuard` (router/index.js:8)

### 状态管理 (Vuex Store)

**核心状态**:
- `userConfig`: 用户配置（从后端 `/api/userConfig` 获取）
- `bingWallPapers`: Bing 壁纸数据
- `credentials`: 管理员认证凭据
- `useDarkMode` / `cusDarkMode`: 深色模式状态
- `compressConfig`: 图片压缩配置
- `uploadMethod` / `uploadCopyUrlForm`: 上传相关配置
- `customUrlSettings` / `adminUrlSettings`: 自定义 URL 设置

**重要 Actions**:
- `fetchUserConfig`: 获取用户配置（应用启动时调用）
- `fetchBingWallPapers`: 获取并预加载 Bing 壁纸

### 路由结构

- `/` - 上传主页 (UploadHome.vue) - 需要用户认证
- `/login` - 用户登录页
- `/adminLogin` - 管理员登录页
- `/dashboard` - 管理员仪表板 - 需要管理员认证
- `/customerConfig` - 客户配置页 - 需要管理员认证
- `/systemConfig` - 系统配置页 - 需要管理员认证
- `/blockimg` - 图片封禁页
- `/whiteliston` - 白名单开启页
- `/:pathMatch(.*)*` - 404 页面

### 文件管理器 (fileManager.js)

`FileManager` 类提供文件和目录管理功能：
- 使用 `localStorage` 存储文件列表 (`data/fileList.json`)
- 支持文件/文件夹的增删改查操作
- 提供分页加载功能 (`refreshFileList`, `loadMoreFiles`)
- 支持搜索和标签过滤

**关键方法**:
- `getLocalFileList()` / `saveFileList()`: 本地存储操作
- `addFile()` / `removeFile()`: 文件操作
- `addFolder()` / `removeFolder()`: 文件夹操作
- `moveFile()`: 移动文件或文件夹
- `refreshFileList()`: 从后端刷新文件列表
- `loadMoreFiles()`: 加载更多文件（分页）

### 背景管理器 Mixin (backgroundManager.js)

提供统一的背景图管理功能，支持：
- Bing 壁纸轮播
- 自定义壁纸轮播
- 单张壁纸
- 默认壁纸（支持深色/浅色主题）
- 平滑主题切换

**使用方式**:
```javascript
import backgroundManager from '@/mixins/backgroundManager'

export default {
  mixins: [backgroundManager],
  mounted() {
    // configKey: 用户配置中的键名
    // containerSelector: 容器选择器
    // useDefaultBackground: 是否使用默认背景
    // autoCreateElements: 是否自动创建背景元素
    this.initializeBackground('loginBackground', '.login', true, true)
  }
}
```

### 深色模式

深色模式通过以下机制实现：
1. **状态管理**: `useDarkMode` (布尔值) 和 `cusDarkMode` (是否自定义模式)
2. **初始化逻辑** (main.js:31-56):
   - 自定义模式：使用用户设置
   - 自动模式：跟随系统或时间（22:00-6:00 为深色）
3. **CSS 类**: 通过在 `<html>` 元素上添加/移除 `dark` 类实现
4. **Element Plus**: 使用 `element-plus/theme-chalk/dark/css-vars.css`
5. **响应式**: Vuex store 订阅机制监听模式变化并更新 DOM

### API 请求规范

**开发环境**:
- baseURL: `/api` (通过 vue.config.js 代理到 `VUE_APP_BACKEND_URL`)

**生产环境**:
- baseURL: `/` (直接请求同源)

**认证方式**:
- 用户 API: 在请求配置中添加 `withAuthCode: true`
- 管理员 API: 使用 `fetchWithAuth` 函数

## 重要注意事项

1. **Element Plus 自动导入**: 组件和 API 通过 unplugin 自动导入，无需手动 import
2. **状态持久化**: Vuex store 使用 `vuex-persistedstate` 自动持久化到 localStorage
3. **图标使用**:
   - FontAwesome: `<font-awesome-icon icon="icon-name" />`
   - Element Plus: 直接使用组件名（已全局注册）
4. **背景图元素**: 需要 `#bg1` 和 `#bg2` 两个 img 元素用于背景轮播（可通过 mixin 自动创建）
5. **部署流程**: 构建后必须将 dist 内容复制到后端项目根目录
6. **压缩优化**: 生产构建启用 gzip 压缩 (CompressionPlugin)

## 常见开发场景

### 添加新页面
1. 在 `src/views/` 创建 Vue 组件
2. 在 `src/router/index.js` 添加路由配置
3. 根据需要添加认证守卫 (`userAuthGuard` 或 `adminAuthGuard`)

### 添加新的 API 调用
```javascript
import axios from '@/utils/axios'

// 用户 API
const response = await axios.get('/api/endpoint', { withAuthCode: true })

// 管理员 API
import fetchWithAuth from '@/utils/fetchWithAuth'
const response = await fetchWithAuth('/api/manage/endpoint', { method: 'GET' })
```

### 使用 Vuex 状态
```javascript
import { mapGetters } from 'vuex'

export default {
  computed: {
    ...mapGetters(['userConfig', 'useDarkMode'])
  },
  methods: {
    updateConfig() {
      this.$store.commit('setUserConfig', newConfig)
    }
  }
}
```

### 文件管理操作
```javascript
import { fileManager } from '@/utils/fileManager'

// 刷新文件列表
await fileManager.refreshFileList('/', 'searchTerm', 'includeTags', 'excludeTags')

// 添加文件
fileManager.addFile({ name: 'path/to/file.jpg', ... })

// 删除文件
fileManager.removeFile('path/to/file.jpg')
```
