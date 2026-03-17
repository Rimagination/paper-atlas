# Paper Atlas

论文图谱探索工具，可视化论文引用关系与相似度网络。基于 FastAPI、React、D3.js 构建。

## 技术栈

- 后端：FastAPI、httpx、Redis/fakeredis、networkx
- 前端：React 18、Vite、Tailwind CSS、D3.js、axios
- 数据源：Semantic Scholar API、OpenAlex API

## 本地运行

1. 安装后端依赖：

```bash
cd backend
pip install -r requirements.txt
```

2. 安装前端依赖：

```bash
cd frontend
npm install
```

3. 启动后端：

```bash
cd backend
PYTHONPATH=. python -m uvicorn backend.main:app --reload --port 8000
```

4. 启动前端：

```bash
cd frontend
npm run dev
```

前端运行在 `http://localhost:5173`，后端运行在 `http://localhost:8000`。

## Docker 部署

### 开发环境

```bash
docker compose up --build
```

### 生产环境

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

## 环境变量

后端支持以下环境变量：

| 变量名 | 说明 | 必填 |
|--------|------|------|
| REDIS_URL | Redis 连接 URL | 否（默认使用 fakeredis） |
| CORS_ORIGINS | 允许的前端域名 | 否 |
| SEMANTIC_SCHOLAR_API_KEY | Semantic Scholar API Key | 否（有速率限制） |
| OPENALEX_EMAIL | OpenAlex 邮箱 | 否 |

## 部署到 paperatlas.scansci.com

### 方案：Cloudflare Pages + Railway

#### 1. 部署后端到 Railway

1. 访问 [Railway](https://railway.app) 并登录
2. 点击 "New Project" → "Deploy from GitHub repo"
3. 选择 `paper-atlas` 仓库
4. Root Directory 设置为 `/backend`
5. 添加环境变量：
   - `CORS_ORIGINS`: `https://paperatlas.scansci.com`
   - `SEMANTIC_SCHOLAR_API_KEY`: (可选)
6. 部署后获得后端 URL，如 `https://paper-atlas-backend.up.railway.app`

#### 2. 部署前端到 Cloudflare Pages

1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 Workers & Pages → Create → Pages → Connect to Git
3. 选择 `paper-atlas` 仓库
4. 配置构建：
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: `/frontend`
5. 部署

#### 3. 配置 API 代理

在 Cloudflare Pages 设置中添加环境变量：
- `VITE_API_BASE_URL`: `https://your-backend-url.railway.app`

或者修改 `frontend/public/_redirects` 文件添加代理规则。

#### 4. 绑定自定义域名

1. 在 Cloudflare Pages 项目设置中添加自定义域名 `paperatlas.scansci.com`
2. DNS 会自动配置
