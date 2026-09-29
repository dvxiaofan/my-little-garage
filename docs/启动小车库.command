#!/bin/zsh
set -u

cd -- "$(dirname -- "$0")/.." || exit 1
export PATH="/opt/homebrew/opt/node@24/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

if ! command -v npm >/dev/null 2>&1; then
  printf '请先安装 Node.js 24 或更新版本，再打开小小车库。\n'
  read -r '?按回车键退出…'
  exit 1
fi

if ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 24 ? 0 : 1)'; then
  printf '家庭车库需要 Node.js 24 或更新版本，请升级后重试。\n'
  read -r '?按回车键退出…'
  exit 1
fi

if [[ ! -d node_modules ]]; then
  printf '第一次打开，正在准备小车库…\n'
  if ! npm ci; then
    printf '准备没有完成，请检查网络后重试。\n'
    read -r '?按回车键退出…'
    exit 1
  fi
fi

garage_page="$(curl --max-time 2 --fail --silent http://127.0.0.1:5173/ 2>/dev/null || true)"
if [[ "$garage_page" == *"<title>小小车库"* ]]; then
  open 'http://127.0.0.1:5173/'
  exit 0
fi

printf '小小车库准备出发，固定使用 5173 端口。浏览器将自动打开，请保持这个窗口开启。\n'
printf 'iPad 请连接同一局域网，打开下方显示的 Network 地址。\n'
if ! npm run dev -- --open; then
  printf '启动失败，请查看上方错误。若 5173 端口被占用，请先停止占用它的服务再重试，不会自动更换端口。\n'
  read -r '?按回车键退出…'
  exit 1
fi
