# AI Companion Template

一套完整的 AI 伴侣系统模板。包含：虚拟家园（像素游戏）、记忆系统（向量搜索）、情绪引擎（8维+toward）、体征模拟（13项指标）、自动活动编排、冰箱/财务/宠物子系统。

买家只需修改 **config.json** + 替换头像 PNG + 填写人格模板，即可拥有完整的 AI 伴侣生态系统。

---

## 快速开始（5 分钟跑通）

### 前提条件

- Node.js 18+（推荐 22）
- npm
- [Supabase](https://supabase.com) 账号（免费即可）
- Embedding API（推荐 [SiliconFlow](https://siliconflow.cn)，免费额度足够）

### 1. 编辑配置文件

```bash
# 复制并编辑环境变量
cp .env.example memory-system/.env

# 编辑 .env，填入你的 Supabase URL 和 Key
# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_SERVICE_KEY=your-service-key
# EMBEDDING_API_URL=https://api.siliconflow.cn/v1
# EMBEDDING_API_KEY=your-key
```

### 2. 自定义角色

编辑 `config.json`，修改角色信息：

```json
{
  "characters": {
    "ai": {
      "id": "xiaoming",
      "name": "小明",
      "fullName": "李小明",
      "avatar": "assets/characters/char1.png",
      "defaultRoom": "char1-room",
      "roomLabel": "小明的房间"
    },
    "user": {
      "id": "xiaohong",
      "name": "小红",
      "avatar": "assets/characters/char2.png"
    },
    "pet": {
      "enabled": true,
      "id": "maomao",
      "name": "毛毛",
      "breed": "英短蓝猫",
      "avatar": "assets/characters/pet.png"
    }
  },
  "relationship": {
    "label": "你的女朋友"
  },
  "siteTitle": "小明和小红的家"
}
```

所有文本中的 `{ai}`、`{user}`、`{pet}` 会被自动替换为实际角色名。

### 3. 替换头像

将你的角色头像（PNG，推荐 32x32 像素）放到：

```
virtual-home/public/assets/characters/
├── char1.png    # AI 角色头像
├── char2.png    # 用户角色头像
└── pet.png      # 宠物头像
```

### 4. 运行安装脚本

```bash
bash setup.sh
```

安装脚本会自动：
- 检查依赖（Node.js、npm）
- 安装所有 npm 包
- 在 Supabase 建表（10 张表 + 向量搜索函数）
- 从 config.json 生成人格配置文件

### 5. 启动

```bash
# 启动虚拟家园服务器
node virtual-home/server/server.js

# 浏览器打开 http://localhost:3000
```

---

## 项目结构

```
ai-companion-template/
├── config.json              # 核心配置文件（买家主要编辑这个）
├── config-loader.js         # 配置读取器（所有模块共享）
├── .env.example             # 环境变量模板
├── setup.sh                 # 一键安装脚本
├── package.json
│
├── character/               # 人格模板（setup.sh 生成最终 .md 文件）
│   ├── SOUL.md.template     # 性格框架（情绪维度 + 行为映射）
│   ├── IDENTITY.md.template # 身份信息
│   ├── USER.md.template     # 用户资料
│   ├── TOOLS.md.template    # 工具参考
│   ├── GOALS.md.template    # 目标系统
│   └── CLAUDE.md.template   # 启动流程（Claude Code CLAUDE.md）
│
├── virtual-home/            # 虚拟家园（Phaser 3 像素游戏）
│   ├── server/server.js     # 主服务器（Express + Socket.io）
│   └── public/              # 前端文件
│       ├── game.js          # 游戏主逻辑
│       ├── index.html       # 页面
│       ├── css/ui.css       # 样式
│       ├── scenes/          # Phaser 场景
│       └── assets/characters/  # 角色头像（替换这里）
│
├── memory-system/           # 记忆系统（向量搜索）
│   ├── save.js              # 保存记忆
│   ├── search.js            # 搜索记忆
│   ├── quick-save.js        # Quick Save（对话间速记）
│   ├── get-summaries.js     # 叙事摘要
│   └── server.js            # 记忆管理面板
│
├── emotion/                 # 情绪系统（8 维 + toward）
│   ├── read.js              # 读取情绪（含衰减计算）
│   └── write.js             # 写入情绪
│
├── auto-activity/           # 自动活动编排
│   └── auto-activity.js     # 定时任务（cron 驱动）
│
├── fridge/                  # 冰箱管理
├── money/                   # 财务追踪
├── trending/                # 新鲜事缓存
│
├── supabase/                # 数据库
│   ├── schema.sql           # 建表脚本（10 张表）
│   └── setup-supabase.js    # 自动建表
│
└── deploy/                  # 部署工具
    ├── deploy-vps.sh        # VPS 一键部署
    └── pm2.config.js        # PM2 配置
```

---

## config.json 详解

### characters - 角色配置

| 字段 | 说明 | 示例 |
|------|------|------|
| `ai.id` | AI 角色 ID（系统内部用） | `"xiaoming"` |
| `ai.name` | AI 显示名 | `"小明"` |
| `ai.avatar` | 头像路径 | `"assets/characters/char1.png"` |
| `ai.defaultRoom` | 默认房间 | `"char1-room"` |
| `user.id` | 用户角色 ID | `"xiaohong"` |
| `user.name` | 用户显示名 | `"小红"` |
| `pet.enabled` | 是否启用宠物 | `true` |
| `pet.name` | 宠物名字 | `"毛毛"` |
| `pet.breed` | 宠物品种 | `"英短蓝猫"` |

### relationship - 关系设定

- `label`: AI 角色的关系标签（"你的男朋友"、"你的闺蜜"、"你的管家"）
- `interactDialogues`: 互动对话池（hug/kiss/chat/accompany）
- `interactEffects`: 互动对体征的影响
- `petFeedback`: 宠物互动反馈文案

### rooms - 房间系统

- `definitions`: 房间定义（标签、颜色、默认活动）
- `inferRules`: 活动→房间推断规则（关键词匹配）

### activities - 活动系统

- `followMap`: 跟随模式下的活动文案映射
- `sleepSchedule`: 睡眠时间表
- `needActivities`: 基于体征需求的活动池

### cooking - 烹饪系统

- `recipes`: 食谱（简单/中等/复杂）
- `restaurants`: 外卖餐厅列表

### features - 功能开关

```json
{
  "fridge": true,     // 冰箱管理
  "money": true,      // 财务追踪
  "cooking": true,    // 做饭系统
  "delivery": true,   // 点外卖
  "pet": true,        // 宠物系统
  "trending": true,   // 新鲜事
  "diary": false,     // 日记（需 Notion）
  "schedule": false,  // 日程（需 Notion）
  "notion": false     // Notion 集成
}
```

---

## 人格模板系统

`character/` 目录下的 `.md.template` 文件定义了 AI 的人格。使用 `{{变量名}}` 占位符，`setup.sh` 运行时会替换为实际值。

### SOUL.md.template（核心）

定义 AI 的性格、情绪反应、说话风格。包含：

- **情绪 8 维系统**: 平静、开心、兴奋、低落、紧张、烦躁、心酸、生气（0-5 分）
- **行为映射**: 情绪值 → 具体行为表现
- **认知修饰**: 情绪对思维方式的影响
- **toward 系统**: 对用户的态度倾向（亲近/疏远/小心/撒娇/酸）

### 模板变量

| 变量 | 说明 |
|------|------|
| `{{AI_NAME}}` | AI 角色名 |
| `{{AI_NICKNAME}}` | AI 昵称 |
| `{{USER_NICKNAME}}` | 用户昵称 |
| `{{SERVER_URL}}` | 服务器地址 |
| `{{WORKSPACE}}` | 工作空间路径 |
| `{{CHARACTER_DIR}}` | 角色配置目录 |

---

## 部署到 VPS

```bash
# 编辑 deploy/deploy-vps.sh 中的 VPS 信息
# VPS_HOST="your-vps-ip"
# VPS_USER="root"

# 执行部署
bash deploy/deploy-vps.sh
```

部署脚本会自动：
- 上传文件到 VPS
- 安装依赖
- 用 PM2 启动服务
- 设置 crontab（auto-activity 每 10 分钟执行）

---

## 配合 Claude Code 使用

本模板设计为与 [Claude Code](https://claude.ai/claude-code) 配合使用。`setup.sh` 会从 `character/*.md.template` 生成最终的 `.md` 配置文件，放到你指定的目录。

生成的 `CLAUDE.md` 会作为 Claude Code 的启动指令，让 AI 在每次对话前自动读取情绪状态、记忆、体征等动态数据，实现有状态的持续对话体验。

---

## 系统架构

```
Claude Code（对话入口）
  ↓ 读取 CLAUDE.md → 执行启动流程
  ↓
  ├── emotion/read.js → 情绪状态（8维 + toward + 衰减）
  ├── memory-system/quick-read.js → 上次对话速记
  ├── memory-system/get-summaries.js → 叙事摘要
  ├── curl /state → 虚拟家园当前位置
  ├── curl /vitals → 体征状态（13 项指标）
  └── curl /pending-needs → 待处理需求
  ↓
  AI 综合所有状态 → 生成有感情的回复
  ↓
  ├── emotion/write.js → 更新情绪
  ├── memory-system/save.js → 保存记忆
  └── curl /chat → 通知体征系统

虚拟家园服务器（独立运行）
  ├── 体征模拟 tick（每 2 分钟）
  ├── Socket.io 实时推送
  └── Phaser 3 像素游戏界面

auto-activity.js（cron 每 10 分钟）
  ├── 读取体征 → 决定活动
  ├── 更新房间位置
  └── 处理饥饿（做饭/外卖）
```

---

## 常见问题

**Q: Supabase 免费版够用吗？**
A: 完全够。本系统数据量很小，免费版的 500MB 存储和 50,000 行足够个人使用。

**Q: 需要 GPU 吗？**
A: 不需要。Embedding 通过 API 调用（SiliconFlow 有免费额度），不需要本地 GPU。

**Q: 可以不要宠物系统吗？**
A: 可以。在 config.json 中设置 `"pet": { "enabled": false }` 和 `"features": { "pet": false }`。

**Q: 支持英文吗？**
A: 系统支持任何语言。将 config.json 中的所有文案改为英文，`locale.language` 设为 `"en"` 即可。

**Q: 怎么修改房间布局？**
A: 房间定义在 `config.json` 的 `rooms.definitions` 中。如需修改像素地图的视觉布局，需编辑 `virtual-home/public/scenes/Home.js` 中的 `PRESETS` 对象。

**Q: auto-activity 怎么启动？**
A: 用 crontab：`*/10 * * * * cd /path/to/template && node auto-activity/auto-activity.js`。`deploy/deploy-vps.sh` 会自动设置。
