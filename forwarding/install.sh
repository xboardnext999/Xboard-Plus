#!/usr/bin/env bash
set -euo pipefail

REPOSITORY="xboardnext999/Xboard-Plus"
RELEASE_TAG="1.0.0"
INSTALL_DIR="/etc/xboard-forwarding"
SERVICE_NAME="xboard-forwarding"
PANEL_ADDR=""
NODE_SECRET=""
ACTION="install"

usage() {
  echo "用法: $0 [-a 面板地址] [-s 节点密钥] [-u|-r]"
  echo "  -a  面板通信地址，例如 plus.example.com:80"
  echo "  -s  后台生成的节点密钥"
  echo "  -u  卸载节点"
  echo "  -r  仅更新节点核心"
}

while getopts "a:s:urh" option; do
  case "$option" in
    a) PANEL_ADDR="$OPTARG" ;;
    s) NODE_SECRET="$OPTARG" ;;
    u) ACTION="uninstall" ;;
    r) ACTION="update" ;;
    h) usage; exit 0 ;;
    *) usage; exit 1 ;;
  esac
done

if [[ "${EUID}" -ne 0 ]]; then
  echo "请使用 root 权限运行安装脚本。" >&2
  exit 1
fi

case "$(uname -m)" in
  x86_64|amd64) ARCH="amd64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) echo "暂不支持当前架构: $(uname -m)" >&2; exit 1 ;;
esac

DOWNLOAD_URL="https://github.com/${REPOSITORY}/releases/download/${RELEASE_TAG}/gost-${ARCH}"

download_core() {
  local target="$1"
  local checksum_file expected
  checksum_file="$(mktemp)"
  curl --fail --location --retry 3 --connect-timeout 15 \
    "https://github.com/${REPOSITORY}/releases/download/${RELEASE_TAG}/checksums.txt" \
    --output "$checksum_file"
  curl --fail --location --retry 3 --connect-timeout 15 "$DOWNLOAD_URL" --output "$target"
  test -s "$target"
  expected="$(awk -v name="gost-${ARCH}" '$2 == name { print $1 }' "$checksum_file")"
  if [[ ! "$expected" =~ ^[0-9a-fA-F]{64}$ ]]; then
    rm -f "$checksum_file"
    echo "无法获取节点核心校验值。" >&2
    return 1
  fi
  echo "${expected}  ${target}" | sha256sum --check --status
  rm -f "$checksum_file"
  chmod 0755 "$target"
}

json_escape() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/\\n}"
  value="${value//$'\r'/\\r}"
  printf '%s' "$value"
}

uninstall_core() {
  systemctl disable --now "${SERVICE_NAME}.service" 2>/dev/null || true
  rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
  systemctl daemon-reload
  rm -rf "$INSTALL_DIR"
  echo "节点程序已卸载。"
}

update_core() {
  mkdir -p "$INSTALL_DIR"
  download_core "${INSTALL_DIR}/agent.new"
  systemctl stop "${SERVICE_NAME}.service" 2>/dev/null || true
  mv "${INSTALL_DIR}/agent.new" "${INSTALL_DIR}/agent"
  systemctl start "${SERVICE_NAME}.service"
  echo "节点核心已更新: $(${INSTALL_DIR}/agent -V)"
}

install_core() {
  if [[ -z "$PANEL_ADDR" ]]; then read -r -p "面板通信地址: " PANEL_ADDR; fi
  if [[ -z "$NODE_SECRET" ]]; then read -r -s -p "节点密钥: " NODE_SECRET; echo; fi
  if [[ -z "$PANEL_ADDR" || -z "$NODE_SECRET" ]]; then
    echo "面板通信地址和节点密钥不能为空。" >&2
    exit 1
  fi

  local escaped_addr escaped_secret
  escaped_addr="$(json_escape "$PANEL_ADDR")"
  escaped_secret="$(json_escape "$NODE_SECRET")"

  mkdir -p "$INSTALL_DIR"
  download_core "${INSTALL_DIR}/agent"
  cat > "${INSTALL_DIR}/config.json" <<EOF
{
  "addr": "${escaped_addr}",
  "secret": "${escaped_secret}",
  "http": 0,
  "tls": 1,
  "socks": 0
}
EOF
  printf '{}\n' > "${INSTALL_DIR}/gost.json"
  chmod 0600 "${INSTALL_DIR}/config.json" "${INSTALL_DIR}/gost.json"

  cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=Xboard Forwarding Node
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}
ExecStart=${INSTALL_DIR}/agent
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=${INSTALL_DIR}
UMask=0077
LimitNOFILE=1048576

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable --now "${SERVICE_NAME}.service"
  echo "节点安装完成: $(${INSTALL_DIR}/agent -V)"
  echo "服务状态: systemctl status ${SERVICE_NAME}"
}

case "$ACTION" in
  install) install_core ;;
  update) update_core ;;
  uninstall) uninstall_core ;;
esac
