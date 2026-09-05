# Sanyue ImgHub

CloudFlare-ImgBed 的现代化 Web UI。前端与后端保持同源部署，通过现有 API、上传和文件接口工作。

## 技术栈

- Vue 3 + Composition API
- TypeScript（严格模式）
- Vite
- Tailwind CSS v4
- shadcn-vue 组件模式 + Reka UI
- Pinia
- Axios
- Lucide Vue
- Vitest

## 功能

- 多文件拖放上传、上传进度与失败重试
- 大文件自动分块、三路并发上传与失败清理
- R2、S3、Telegram、Discord、Hugging Face、WebDAV 渠道选择
- 普通用户与管理员会话认证
- 文件网格/列表、目录、搜索、分页与链接复制
- 文件元数据、路径、标签、黑白名单管理
- 公开文件浏览
- 页面、安全、会话、公开浏览、WebDAV 与存储渠道设置
- 暖白/石墨/琥珀视觉主题及深色模式
- 响应式桌面端与移动端布局

## 本地开发

要求 Node.js 20.19 或更高版本。

~~~bash
npm ci
cp .env.example .env.local
npm run dev
~~~

.env.local 中的 VITE_BACKEND_URL 只用于 Vite 开发代理。浏览器请求始终保持同源，以确保 HttpOnly 会话 Cookie 正常工作。

~~~dotenv
VITE_BACKEND_URL=http://127.0.0.1:8080
~~~

## 检查与构建

~~~bash
npm run typecheck
npm test
npm run build
~~~

生产文件生成在 dist/。

## 集成到 CloudFlare-ImgBed

1. 在本仓库运行 npm run build。
2. 清空 CloudFlare-ImgBed 仓库的 frontend-dist/，再把 dist/ 中的内容复制进去。
3. 提交 CloudFlare-ImgBed 的 frontend-dist/ 更新。
4. Cloudflare Pages 的 Build output directory 继续使用 frontend-dist。

不要把 Sanyue-ImgHub 仓库本身设置成 CloudFlare-ImgBed 的 Pages 输出源；后端 Functions 位于 CloudFlare-ImgBed 仓库中。

## 目录

~~~text
src/
├── components/ui/       shadcn-vue 风格基础组件
├── components/modern/   ImgHub 业务组件
├── composables/         主题等组合式逻辑
├── services/            Axios 与后端 API 契约
├── stores/              Pinia 状态
├── types/               TypeScript 类型
└── views-modern/        页面
~~~

## 上游项目

- [CloudFlare-ImgBed](https://github.com/MarSeventh/CloudFlare-ImgBed)
- [Sanyue-ImgHub](https://github.com/MarSeventh/Sanyue-ImgHub)

本项目遵循仓库中的 LICENSE。
