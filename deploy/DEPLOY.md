# 部署到 Linux 服务器

完整部署与开发手册见 [README.md](../README.md)，尤其是 [Linux/systemd](../README.md#linux)、[NGINX](../README.md#nginx) 和 [常见问题](../README.md#faq)。本文件保留简版部署流程。

示例使用 Ubuntu/Debian、systemd、Node.js 24 LTS、NGINX，项目位于 `/opt/pixel-link`，NES 游戏单独放 `/srv/pixel-link/roms`。请把 `nes.example.com` 和证书路径替换为你的真实配置。

## 上传文件

在本机先运行 `npm ci` 和 `npm run build`，然后上传：

- `dist/`（完整目录，含 assets、cores/*.js、cores/*.wasm、核心源码与许可证、demo.nes、audio-worklet.js）
- `server/`、`shared/`
- `package.json`、`package-lock.json`
- `scripts/library.js`（可选，保留服务器命令行管理功能）
- `deploy/`（部署模板和本文）

运行时不依赖 src、tests，但完整发布包保留它们及对应许可/源码以便维护和重新分发。不要上传本机 node_modules、.data、test-results，也不要把 macOS 的 node_modules 搬到 Linux。

本项目提供的 `releases/pixel-link-server.tar.gz` 已包含上述生产文件，不包含你的私人卡带或任何用户存档。游戏文件应另行放入游戏目录。

## 准备服务器

安装 Node.js 24 LTS 和 NGINX。用 `node -v`、`npm -v` 检查安装；用 `command -v node` 确定绝对路径。如果不是 `/usr/bin/node`，修改 service 文件的 ExecStart。systemd 不会自动加载 nvm 的交互式 shell 环境。

以下命令在服务器执行，假设压缩包上传到了 `/tmp/pixel-link-server.tar.gz`：

```sh
sudo useradd --system --home /opt/pixel-link --shell /usr/sbin/nologin pixellink
sudo mkdir -p /opt/pixel-link /srv/pixel-link/roms
sudo tar -xzf /tmp/pixel-link-server.tar.gz -C /opt/pixel-link
sudo chown -R pixellink:pixellink /opt/pixel-link /srv/pixel-link
cd /opt/pixel-link
sudo -u pixellink -H npm ci --omit=dev
```

如果账号已创建，不用再次执行 useradd。使用默认预构建包时不用在服务器 build；如上传完整源码，则先安装全部依赖、build，再 `npm prune --omit=dev`。

## 环境与进程守护

`deploy/pixel-link.service` 已配置：

```text
NODE_ENV=production
PORT=4178
LIBRARY_DIR=/srv/pixel-link/roms
LIBRARY_WEB_MANAGEMENT=0
```

无需设置管理员密钥，也无需数据库。应用不会自行加载 `.env` 文件，使用 systemd Environment 配置即可。手动修改 service 后需 daemon-reload 并重启。

```sh
sudo cp /opt/pixel-link/deploy/pixel-link.service /etc/systemd/system/pixel-link.service
sudo systemctl daemon-reload
sudo systemctl enable --now pixel-link
sudo systemctl status pixel-link
curl http://127.0.0.1:4178/health
```

健康接口应返回 `ok: true`、`romRelay: true`、`protocol: "pixel-link-7-fceumm"`、`core: "fceumm-ac0d00a-pl1"`。如果仅返回早期的 `{"ok":true}`，应检查是否重启了正确的 Node 进程。查看日志：`sudo journalctl -u pixel-link -n 100 --no-pager`。

## NGINX 与 HTTPS

先配置域名 DNS 指向服务器，并通过现有服务器面板或 ACME 工具获得证书。编辑 `deploy/nginx.conf` 的域名和证书路径后：

```sh
sudo cp /opt/pixel-link/deploy/nginx.conf /etc/nginx/conf.d/pixel-link.conf
sudo nginx -t
sudo systemctl reload nginx
```

模板含 HTTP → HTTPS 跳转与 WebSocket 转发。没有证书时不能直接启用其中的 443 配置；可先建普通 HTTP 反代站点，再用现有证书工具开启 HTTPS。

如果已有 HTTPS 站点，只把模板里的代理配置合并到现有站点，避免重复 server 或 location。`map` 必须位于 http 上下文中，不能塞进 server/location。NGINX 默认通常在 http 中 include `/etc/nginx/conf.d/*.conf`，请以你的 nginx.conf 为准。

必须保留 Host 和 WebSocket Upgrade/Connection。全部请求都代理给 Node，路径包括 `/`、`/assets/`、`/api/library`、`/netplay`、`/audio-worklet.js`。建议使用独立域名根路径，当前应用未适配 `/nes/` 等子路径。

云安全组和系统防火墙只对外开放 80/443（以及你所需的 SSH 端口）。当前 Node 监听所有网卡，不要对外放行 4178；NGINX 使用 127.0.0.1:4178 访问它。

## 上传游戏

用 SFTP、面板文件管理器等把 `.nes` 文件直接放入 `/srv/pixel-link/roms/`，支持子目录。确保 pixellink 用户有目录读取/进入权限和文件读取权限。刷新网页 → 游戏库即可显示，无需导入或重启。

可选地在该目录创建 `library.json` 来设置首页默认游戏：

```json
{ "defaultGame": "雪人兄弟.nes" }
```

## 更新、存档和容量

后续更新替换 dist、server、shared 等程序文件，必要时执行 `npm ci --omit=dev`，然后 `sudo systemctl restart pixel-link`。前端与后端要作为同一版本一起更新；旧页面可能需要刷新。重启会关闭内存房间。

游戏目录独立于程序，更新代码时不要删除它。存档存在用户浏览器，不占服务器磁盘；联机接续状态仅临时转发。浏览器存档按站点来源隔离，旧 localhost 或 HTTP 的本地存档不会自动出现在新的 HTTPS 域名，迁移前可导出 .pls，再在新站导入。

当前运行单实例，不要开启 PM2 cluster 或多进程负载均衡。房间保存在单进程内存中；未来多实例需要额外房间路由。模拟器运行在玩家设备，服务器负责静态资源、卡带下载和联机转发。

默认核心为本地 FCEUmm WASM，无需服务器安装模拟器或编译器。升级后务必重启 Node 项目，并让双方刷新网页。旧 JSNES 存档会切换旧核心继续读取。完整发布包还附带 src、public、native、licenses 和构建说明，便于备份和满足源码分发要求。
