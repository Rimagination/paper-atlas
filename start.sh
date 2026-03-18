#!/bin/bash
# 启动脚本 - 先启动后端，等待健康检查后再启动 nginx

echo "========================================"
echo "Starting Paper Atlas"
echo "========================================"

# 设置环境变量
export PYTHONPATH=/app
export PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin

echo "[1/6] Checking Python..."
python --version

echo "[2/6] Checking uvicorn..."
which uvicorn

echo "[3/6] Checking nginx..."
/usr/sbin/nginx -v

# 启动后端（在后台）
echo "[4/6] Starting backend on port 8000..."
cd /app
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --log-level info &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# 等待后端启动并健康检查
echo "[5/6] Waiting for backend to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo "Backend is ready!"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "Waiting for backend... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "Backend failed to start!"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

# 启动 nginx（在前台）
echo "[6/6] Starting nginx..."
/usr/sbin/nginx -g 'daemon off;'
