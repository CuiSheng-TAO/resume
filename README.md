# Siamese Dream — HR 陪跑式简历工作台

面向中国大陆校招/应届生的 AI 辅助一页简历制作工具。核心目标：**3 分钟内生成一版可投递、单页、美观的中文简历草稿**。

## 技术栈

- **框架**: Next.js 16 (App Router) + React 19 + TypeScript 5
- **AI**: Anthropic Claude API（服务端调用，带本地 fallback）
- **数据存储**: IndexedDB（浏览器端，local-first）
- **校验**: Zod（模板 manifest、AI 响应 schema 校验）
- **测试**: Vitest + Testing Library + jsdom + fake-indexeddb
- **部署**: Vercel

## 项目结构

```
app/
├── page.tsx                    # 入口，渲染 ResumeStudio
├── layout.tsx                  # 根布局，zh-CN
├── globals.css                 # 全局样式
└── api/ai/                     # AI 相关 API Routes
    ├── extract-content/        # 从粘贴文本提取简历结构化数据
    ├── rewrite-experience/     # AI 改写经历条目
    ├── rebalance-layout/       # AI 辅助版面再平衡
    ├── intake-turn/            # 对话式信息采集的单轮交互
    ├── interview-next/         # 根据完整度决定下一个追问
    └── generate-templates/     # 生成模板候选方案

components/
├── resume-studio.tsx           # 主工作台组件（状态管理中枢）
├── resume-preview.tsx          # 简历实时预览（A4 比例）
├── photo-uploader.tsx          # 证件照上传与裁剪
└── layout-advice-panel.tsx     # 版面建议面板

lib/
├── types.ts                    # 全局类型定义
├── resume-document.ts          # ResumeContentDocument 核心数据模型与转换
├── template-manifest.ts        # 模板 Manifest 定义与校验（Zod schema）
├── template-renderer.ts        # 模板 → React 渲染树
├── flagship-template.ts        # 旗舰模板的参考实现
├── layout-plan.ts              # 单页平衡算法（密度预算 + 变体成本）
├── layout-measure.ts           # DOM 真实高度测量
├── layout-advice.ts            # 版面优化建议生成与应用
├── intake-engine.ts            # 信息采集完整度评估与追问策略
├── intake.ts                   # Intake 辅助函数
├── experience.ts               # 经历条目处理（变体生成、指标提取、bullets）
├── export.ts                   # 导出 HTML / 打印 PDF
├── storage.ts                  # IndexedDB 持久化（workspace 存取）
├── anthropic.ts                # Anthropic SDK 封装（超时、重试、JSON 解析）
├── ai-prompts.ts               # Prompt 版本化管理
├── ai-fallback.ts              # AI 不可用时的本地 fallback 逻辑
├── ai-rate-limit.ts            # 轻量限流
├── analytics.ts                # 埋点事件
└── photo.ts                    # 照片处理

tests/                          # Vitest 测试
docs/
├── product/                    # 产品文档（MVP 路线图、模板族库、技能系统）
└── superpowers/                # 技术方案（plans/ + specs/）
```

## 核心数据流

```
用户输入 → Intake 采集 → ResumeContentDocument → LayoutPlan 平衡 → TemplateManifest 选择 → RenderState → 预览/导出
```

### 关键数据模型

- **WorkspaceData**: 顶层状态容器，包含 profile、education、experiences、awards、skills、intake、draft、layoutPlan、contentDocument、templateSession、renderState
- **ResumeContentDocument**: 结构化简历内容，语言固定 zh-CN，目标受众 campus-recruiting
- **TemplateManifest**: 模板配置（tone、字体对、强调色、分割线、各 section 变体、压缩策略等），用 Zod schema 严格校验
- **LayoutPlan**: 单页平衡方案（密度模式、变体选择、隐藏项、溢出状态）
- **RenderState**: 最终渲染参数

### 信息采集流程

支持两种入口模式：
1. **Guided（引导式）**: 分步问答，收集基本信息后生成初稿
2. **Paste（粘贴式）**: 粘贴已有简历文本，AI 提取结构化数据

采集完成后进入编辑器（Editor），分三个阶段：starter → strengthening → review。

### 单页平衡算法

`layout-plan.ts` 实现了核心的一页纸平衡逻辑：
- 密度预算系统：airy(22) / balanced(24) / tight(26) 行
- 经历变体成本：raw(7) > star(6) > standard(5) > compact(4)
- 溢出时：先压缩低优先级经历变体 → 隐藏低优先级奖项 → 提升密度
- 内容不足时：反向操作，恢复隐藏内容、降低密度

### AI 能力

通过 Anthropic Claude API 提供，所有 AI 功能都有本地 fallback：
- 经历改写（STAR 法则优化 bullets）
- 内容提取（从粘贴文本解析简历）
- 模板生成（基于内容生成差异化模板候选）
- 追问引导（根据完整度决定下一个问题）
- 版面再平衡

### 模板系统

- 单栏 A4 布局
- 可配置项：tone（calm/confident/academic/modern）、字体对、强调色、分割线样式
- Section 变体：hero（3种）、education（2种）、experience（3种）、awards（2种）、skills（2种）
- 内置基线模板 + AI 生成候选模板

## 开发命令

```bash
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm run test         # 运行测试
npm run test:watch   # 测试监听模式
npm run lint         # ESLint 检查
```

## 环境变量

参考 `.env.example`，关键变量：
- `ANTHROPIC_API_KEY` — Claude API 密钥
- `ANTHROPIC_MODEL` — 使用的模型 ID
- `ANTHROPIC_TIMEOUT_MS` — 超时时间（默认 12s）
- `ANTHROPIC_MAX_RETRIES` — 重试次数（默认 1）
- `AI_ROUTE_LIMIT_WINDOW_MS` / `AI_ROUTE_LIMIT_MAX_REQUESTS` — 限流配置

无 API Key 时所有 AI 功能自动降级为本地 fallback，主流程仍可用。

## 设计原则

- **Local-first**: 数据存浏览器 IndexedDB，无需注册登录
- **AI 可降级**: 所有 AI 功能都有纯本地 fallback
- **单页至上**: 通过密度/变体/隐藏策略保证一页纸，不靠缩字号
- **编辑部美学**: 克制、专业、纸张感，拒绝模板味和科技泡沫感
- **用户控制内容，系统控制版式**
