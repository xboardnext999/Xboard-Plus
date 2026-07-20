# Xboard Forwarding Core

本目录保存 Plus 流量转发节点的 Go 源码、构建流程与安装脚本。

## 构建

推送节点版本标签后，GitHub Actions 会构建 `gost-amd64`、`gost-arm64`，并将二进制和 `install.sh` 附加到对应 Release。

## 安装

```bash
curl -L https://github.com/xboardnext999/Xboard-Plus/releases/download/2.0.7-beta/install.sh -o ./install.sh && chmod +x ./install.sh && ./install.sh -a PANEL_HOST:PORT -s NODE_SECRET
```

安装脚本及 `gost-amd64`、`gost-arm64` 二进制只从 `xboardnext999/Xboard-Plus` 获取。

## 来源与许可

节点核心基于 `bqlpfy/flux-panel` 中的 `go-gost` 源码，按 Apache License 2.0 使用和修改。完整许可见 [LICENSE](LICENSE)。
