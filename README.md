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

1. 构建并推送 Docker 镜像：

```bash
docker compose -f docker-compose.prod.yml build
```

2. 在服务器上配置反向代理（如 Cloudflare Tunnel 或 nginx）

3. 配置 HTTPS 证书

4. 启动服务：

```bash
docker compose -f docker-compose.prod.yml up -d
```
