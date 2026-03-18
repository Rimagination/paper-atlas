#!/bin/bash
# 启动脚本 - 同时启动后端和 nginx

echo "Starting Paper Atlas..."
echo "========================"

# 设置环境变量
export PYTHONPATH=/app
export PATH=/usr/local/bin:/usr/bin:/bin

# 检查 Python 和 uvicorn
echo "[1] Checking Python..."
python --version
echo "[2] Checking uvicorn..."
which uvicorn

# 启动后端（在后台）
echo "[3] Starting backend on port 8000..."
cd /app
python -c "from backend.startup_check import *; import asyncio; asyncio.run(test_backend())" 2>&1 || echo "Startup check failed, but continuing..."

uvicorn backend.main:app --host 0.0.0.0 --port 8000 --log-level debug &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# 等待后端启动
sleep 5

# 检查后端是否运行
if kill -0 $BACKEND_PID 2>/dev/null; then
    echo "[4] Backend is running"
else
    echo "[4] Backend failed to start!"
fi

# 启动 nginx（在前台）
echo "[5] Starting nginx..."
nginx -g 'daemon off;'
