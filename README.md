# 像素同伴 · Pixel Link

基于 **FCEUmm WebAssembly** 的 NES 网页模拟器，支持服务器游戏库、远程双人联机、自定义按键、浏览器本地存档和手机触屏操作。

模拟器在玩家的浏览器中运行。Node.js 服务负责提供网页、扫描游戏目录、管理房间和转发联机数据；NGINX 负责域名、HTTPS 和反向代理。项目不需要数据库，也不需要在服务器安装桌面模拟器。

## 目录

- [1. 功能与运行方式](#features)
- [2. 本地开发与快速启动](#quickstart)
- [3. 部署文件与环境要求](#requirements)
- [4. 宝塔面板部署](#baota)
- [5. 普通 Linux 与 systemd 部署](#linux)
- [6. NGINX 与 HTTPS 配置](#nginx)
- [7. 环境变量](#environment)
- [8. 游戏库、子目录、搜索与分页](#library)
- [9. 联机、按键、手机与存档](#usage)
- [10. 更新、备份与迁移](#maintenance)
- [11. Docker 部署](#docker)
- [12. 开发文档](#development)
- [13. 测试、构建与发布](#testing)
- [14. 常见问题](#faq)
- [15. 兼容范围与开源许可](#license)

<a id="features"></a>
## 1. 功能与运行方式

- 加载本机 `.nes` 卡带，或选择服务器游戏库中的游戏。
- 递归扫描游戏库的多层子文件夹，无需逐个导入或维护清单。
- 按名称和文件夹路径搜索；支持首页、上一页、下一页、末页和直接跳页，每页可选 30、60、100 款。
- 创建双人房间，通过邀请链接自动加入，也可以手动输入房间码。
- P2 自动获取房主卡带：服务器游戏库直接下载；本机卡带通过房主和服务器临时中转。
- 默认从房主当前进度开始联机，也可选择从头开始。
- 每个游戏提供 3 个手动存档槽和 1 个自动存档槽，存档保存在用户浏览器。
- 自定义键盘按键；手机提供八方向摇杆、A/B 和 SELECT/START，支持多点触控。
- 支持全屏、音频及深色/浅色主题。
- 兼容读取旧版 JSNES 即时存档：读取时切换到保留的旧核心。

部署时使用独立域名的根路径，例如 `https://nes.example.com/`。当前没有适配 `https://example.com/nes/` 这样的子路径部署。

当前房间存在单个 Node 进程的内存中：**使用单实例运行**，不要直接开启 PM2 cluster 或多实例随机负载均衡。服务重启会关闭现有房间。

<a id="quickstart"></a>
## 2. 本地开发与快速启动

### 2.1 准备环境

建议使用 Node.js 24 LTS，并安装 npm。开发构建使用 Vite 7，最低要求为 Node.js 20.19+ 或 22.12+ 对应的受支持版本范围；实际部署建议统一使用 Node.js 24，减少环境差异。

```sh
node -v
npm -v
```

以下命令均在项目根目录执行：

```sh
npm ci
npm run dev
```

打开：

```text
http://localhost:4178/
```

开发服务同时运行 Vite 中间件和 Node 房间服务，不需要另外启动一套前端端口。

- 应用 HTTP/WebSocket 默认端口：`4178`。
- 开发热更新端口：`PORT + 10000`，默认 `14178`。
- 默认游戏目录：项目根目录的 `.data/library/`，启动时会自动创建。
- 无需游戏文件即可点击「原创演示」检查运行情况。

### 2.2 在本机验证生产模式

先停止占用 4178 的开发进程，再执行：

```sh
npm run build
npm start
```

`npm run build` 生成 `dist/`；`npm start` 执行 `node server/index.js`，直接提供构建后的网页。

如果需要与开发服务同时运行，可使用其他端口：

```sh
PORT=4180 npm start
```

不要使用 `npm ci --omit=dev` 后再运行开发服务或构建；Vite 和 Playwright 属于开发依赖。预构建部署包已经包含 `dist/`，生产服务器可以只安装生产依赖。

### 2.3 局域网访问

同一网络的设备使用服务电脑的局域网 IP，例如：

```text
http://192.168.1.10:4178/
```

`localhost` 始终指访问者自己的设备，不能把带 `localhost` 的邀请链接发给其他电脑或手机。局域网测试需要允许对应端口入站；正式公网部署使用 NGINX 的 80/443 入口。

普通局域网 HTTP 可能无法启用 AudioWorklet 声音，正式使用建议配置 HTTPS。

<a id="requirements"></a>
## 3. 部署文件与环境要求

### 3.1 服务器需要什么

- Node.js 和 npm；建议 Node.js 24。
- NGINX，以及已经解析到服务器的域名。
- 公网使用时配置有效的 HTTPS 证书。
- 一个有权限读取游戏目录、运行应用的系统用户。

不需要 MySQL、Redis、PHP、Emscripten 或独立的模拟器后台进程。

游戏运算主要发生在玩家设备上。服务器的流量主要来自网页/WASM 下载、游戏库卡带下载和房间数据转发；实际可承载人数取决于带宽、同时下载量、延迟和设备性能，不使用固定并发人数作保证。

### 3.2 推荐使用预构建部署包

部署包位置：

```text
releases/pixel-link-server.tar.gz
```

包内包括运行文件、源代码、开发文档、构建脚本和许可证。包内不包含你的私人卡带、用户存档、`.data/` 和 `node_modules/`。

运行时必需的文件：

```text
dist/                       构建后的网页及所有静态文件
  assets/                   页面 JS/CSS
  cores/                    FCEUmm JS、WASM、许可证及对应源码包
  demo.nes                  项目自制演示卡带
  audio-worklet.js           音频处理器
server/                     HTTP、游戏库和 WebSocket 服务
shared/                     前后端共用的协议与校验
package.json
package-lock.json
```

发布包还保留 `src/`、`public/`、`native/`、`licenses/`、`scripts/`、`tests/`、`deploy/` 等文件，便于维护、重建和提供对应源码。重新分发时应保留适用的许可证和源码材料。

**完整上传 `dist/cores/`，尤其不能漏传 `.wasm`。** 不要把 macOS/Windows 的 `node_modules/` 复制到 Linux，在目标服务器安装依赖。

如果没有预构建包，可在开发电脑安装依赖并构建：

```sh
npm ci
npm run build
```

也可以在服务器上传完整源码后执行上述两步，再运行 `npm prune --omit=dev`。普通部署无需重新编译 FCEUmm。

<a id="baota"></a>
## 4. 宝塔面板部署

以下示例使用：

- 项目目录：`/www/wwwroot/pixel-link`。
- Node 端口：`4178`。
- Node 安装目录示例：`/www/server/nodejs/v24.12.0`。
- 域名示例：`nes.example.com`，请换成自己的域名。

### 4.1 上传并解压

在宝塔文件管理中创建 `/www/wwwroot/pixel-link`，把部署包上传并解压到这里。

解压后的 `package.json`、`server/`、`shared/`、`dist/` 应直接位于项目目录，不要多套一层 `pixel-link/pixel-link/`。

首次部署可先创建：

```sh
mkdir -p /www/wwwroot/pixel-link/.data/library
```

后续更新只覆盖程序文件，保留 `.data/`。如果使用独立的 `LIBRARY_DIR`，也不要删除那个目录。

### 4.2 检查 Node 和 npm 路径

宝塔给项目选择了 Node 版本，不代表 SSH 终端也配置了 PATH。若提示 `npm: command not found`，先查看实际安装版本：

```sh
ls /www/server/nodejs/
```

假设实际存在的目录是 `v24.12.0`：

```sh
export PATH="/www/server/nodejs/v24.12.0/bin:$PATH"
node -v
npm -v
cd /www/wwwroot/pixel-link
npm ci --omit=dev
```

路径中的版本号必须与目录完全一致；例如安装了 `v24.12.0`，就不能填写不存在的 `v24.13.0`。

这里的 `export` 只作用于当前终端。宝塔守护的项目仍需在项目设置中选择正确 Node 版本。

### 4.3 添加 Node 项目

在宝塔的 Node 项目管理中添加项目，填写：

- 项目目录：`/www/wwwroot/pixel-link`。
- 项目名称：例如 `pixel_link`。
- Node 版本：选择实际安装的 Node.js 24。
- 启动选项：**`start: node server/index.js`**。
- 项目端口：`4178`。
- 运行用户：例如 `www`，确保该用户能够读取项目、进入并读取游戏目录。
- 若已在终端安装依赖，可选择不重复安装 `node_modules`。

不要选择 `dev`、`build`、`test` 或 `test:browser` 作为生产启动项。只运行一个项目实例。

### 4.4 配置环境变量

在项目设置的环境变量配置中添加以下值；不同宝塔版本的入口名称可能不同：

```text
NODE_ENV=production
PORT=4178
LIBRARY_DIR=/www/wwwroot/pixel-link/.data/library
LIBRARY_WEB_MANAGEMENT=0
```

无需管理员密钥。

如果当前面板没有环境变量编辑入口，可以选「自定义启动命令」，使用以下一行命令；Node 路径按实际版本修改：

```sh
env NODE_ENV=production PORT=4178 LIBRARY_DIR=/www/wwwroot/pixel-link/.data/library LIBRARY_WEB_MANAGEMENT=0 /www/server/nodejs/v24.12.0/bin/node server/index.js
```

本项目**不会自动读取 `.env` 文件**。只创建一个 `.env` 而不由启动工具加载，不会改变程序配置。修改环境变量后需要重启 Node 项目。

### 4.5 域名、SSL 和反向代理

1. 把自己的域名解析到服务器公网 IP。
2. 在宝塔给此项目绑定域名，申请并启用 SSL 证书。
3. 配置反向代理到 `http://127.0.0.1:4178`。
4. 按[宝塔代理片段](#nginx-baota)检查 WebSocket 和 Host 配置。
5. 对公网开放 80/443；正常不需要开放 4178。

如果面板已经生成站点的 `server { ... }` 和证书配置，保留它们，只修改其中的代理配置。不要再粘贴一整套重复的 `server` 或第二个 `location /`。

### 4.6 启动后验证

先在服务器检查 Node：

```sh
curl http://127.0.0.1:4178/health
```

然后检查公网域名：

```sh
curl https://nes.example.com/health
```

当前版本应返回：

```json
{
  "ok": true,
  "protocol": "pixel-link-7-fceumm",
  "romRelay": true,
  "core": "fceumm-ac0d00a-pl1"
}
```

后续升级可能更新版本字符串。若只返回 `{"ok":true}`，说明仍在运行早期后端，或反代指向其他进程/端口。

最后在浏览器打开域名，运行演示、创建房间，并用另一台设备通过邀请链接加入，检查自动加载卡带和联机。

<a id="linux"></a>
## 5. 普通 Linux 与 systemd 部署

以下示例针对使用 systemd 的 Ubuntu/Debian，采用独立程序目录和游戏目录：

```text
/opt/pixel-link/             程序
/srv/pixel-link/roms/        游戏与可选的 library.json
```

### 5.1 安装运行环境

使用系统已有的安装方式或 [Node.js 官方下载入口](https://nodejs.org/en/download)安装 Node.js 24，并安装 NGINX。确认：

```sh
node -v
npm -v
command -v node
```

下面的 service 示例使用 `/usr/bin/node`。如果 `command -v node` 输出其他位置，必须修改 `ExecStart`。systemd 不会自动读取交互式 shell 的 nvm 配置。

### 5.2 创建用户与目录

以下命令只需在首次部署执行；用户已存在时跳过 `useradd`：

```sh
sudo useradd --system --home /opt/pixel-link --shell /usr/sbin/nologin pixellink
sudo mkdir -p /opt/pixel-link /srv/pixel-link/roms
sudo tar -xzf /tmp/pixel-link-server.tar.gz -C /opt/pixel-link
sudo chown -R pixellink:pixellink /opt/pixel-link /srv/pixel-link
cd /opt/pixel-link
sudo -u pixellink -H npm ci --omit=dev
```

把上传包的位置 `/tmp/pixel-link-server.tar.gz` 替换为实际位置。若非 root 用户不能在其环境中找到 npm，可使用实际 Node 安装目录的 PATH 或 npm 绝对路径。

### 5.3 配置 systemd

仓库提供 [deploy/pixel-link.service](deploy/pixel-link.service)：

```ini
[Unit]
Description=Pixel Link NES server
After=network.target

[Service]
Type=simple
User=pixellink
Group=pixellink
WorkingDirectory=/opt/pixel-link
Environment=NODE_ENV=production
Environment=PORT=4178
Environment=LIBRARY_DIR=/srv/pixel-link/roms
Environment=LIBRARY_WEB_MANAGEMENT=0
ExecStart=/usr/bin/node /opt/pixel-link/server/index.js
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

检查 Node 路径和目录后启用：

```sh
sudo cp /opt/pixel-link/deploy/pixel-link.service /etc/systemd/system/pixel-link.service
sudo systemctl daemon-reload
sudo systemctl enable --now pixel-link
sudo systemctl status pixel-link --no-pager
curl http://127.0.0.1:4178/health
```

日常管理：

```sh
sudo systemctl restart pixel-link
sudo journalctl -u pixel-link -n 100 --no-pager
sudo journalctl -u pixel-link -f
```

修改 unit 中的环境变量或启动路径后，先执行 `daemon-reload`，再重启服务。

<a id="nginx"></a>
## 6. NGINX 与 HTTPS 配置

项目自带 [deploy/nginx.conf](deploy/nginx.conf)。所有页面、游戏库接口、WASM 和 WebSocket 均可由同一个 Node 端口提供，不需要为每种接口单独开放端口。

### 6.1 证书申请前：普通 HTTP 反代

还没有证书时，可以先建立 HTTP 站点，再用宝塔或自己的 ACME 工具申请证书。下面是普通 NGINX 的最小 HTTP 配置；宝塔用户保留面板生成的证书验证规则：

```nginx
server {
    listen 80;
    server_name nes.example.com;

    location / {
        proxy_pass http://127.0.0.1:4178;
        proxy_http_version 1.1;
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 90s;
        proxy_send_timeout 90s;
        proxy_buffering off;
    }
}
```

HTTP 可用于连通性检查，正式游玩使用 HTTPS。不要同时启用下面配置中另一个相同域名的 HTTP `server`，应替换或合并原配置。

### 6.2 普通 NGINX：完整 HTTPS 配置

将以下内容放入 NGINX 的 **http 上下文所包含的配置文件**，例如常见安装中的 `/etc/nginx/conf.d/pixel-link.conf`。域名和证书路径必须替换为自己的实际值：

```nginx
# map 位于 http 上下文，不能放进 server 或 location。
map $http_upgrade $pixel_link_connection {
    default upgrade;
    ''      close;
}

server {
    listen 80;
    server_name nes.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name nes.example.com;

    ssl_certificate     /etc/letsencrypt/live/nes.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nes.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://127.0.0.1:4178;
        proxy_http_version 1.1;
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $pixel_link_connection;
        proxy_read_timeout 90s;
        proxy_send_timeout 90s;
        proxy_buffering off;
    }
}
```

证书文件尚不存在时，不能直接启用这份 443 配置。保存后检查再重载：

```sh
sudo nginx -t
sudo systemctl reload nginx
```

<a id="nginx-baota"></a>
### 6.3 宝塔：合并到现有站点的代理片段

宝塔通常已经生成 SSL、80 → 443 跳转和 `/.well-known/` 证书验证配置。保留这些内容，把现有的 `location /` 代理块修改为：

```nginx
location / {
    proxy_pass http://127.0.0.1:4178;
    proxy_http_version 1.1;
    proxy_set_header Host $http_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_connect_timeout 30s;
    proxy_read_timeout 90s;
    proxy_send_timeout 90s;
    proxy_buffering off;
}
```

这一片段不使用 `map`，可以放在已有站点的 `server` 内。不要把第 6.2 节的 `map` 直接粘进宝塔单个站点的 `server`。

### 6.4 必须注意的配置

- **保留 `Host $http_host`。** 服务端检查 WebSocket 的 Origin 与 Host 是否一致。不要拼接 `$host:$server_port`，否则标准 HTTPS 端口可能变成多余的 `:443`，导致网页能打开但房间连接失败。
- 显式转发 WebSocket 的 `Upgrade`、`Connection`，并使用 HTTP/1.1，兼容常见 NGINX 版本。
- 整个站点代理给 Node 时，无需额外配置 SPA 回退、PHP 或指向源码根目录的静态 root。
- `/netplay`、`/api/library`、`/cores/`、`/assets/`、`/audio-worklet.js` 都要能访问；不要让旧站点的正则静态资源规则截获这些请求。
- WASM 应返回 `application/wasm`，不能返回 404 页面或 `index.html`。Node 已设置此类型；全部反代给 Node 即可。
- 不要缓存 `/api/library` 和 `/health` 的旧结果，否则添加游戏或更新程序后可能看到旧数据。
- 不要对整个 `/cores/` 设置禁止下载 `.gz` 的规则，其中的对应源码包需要保持可下载。
- 公网只需开放 80/443 及必要的管理端口；Node 当前监听所有网卡，正式部署应通过防火墙阻止公网直接访问 4178。局域网直连测试例外。

代理配置依据 [NGINX WebSocket 官方说明](https://nginx.org/en/docs/http/websocket.html)。

<a id="environment"></a>
## 7. 环境变量

本项目由启动工具注入环境变量，不自动加载 `.env`。

- `PORT`：应用监听端口，默认 `4178`。修改后同步调整宝塔项目端口或 NGINX 的上游地址。
- `LIBRARY_DIR`：游戏目录。默认项目根目录下 `.data/library`；建议生产使用绝对路径。自定义相对路径按进程工作目录解析。
- `LIBRARY_WEB_MANAGEMENT`：只有严格设置为 `1` 才允许启用网页管理 API；默认关闭，建议保持 `0`。
- `LIBRARY_ADMIN_TOKEN`：可选管理 API 密钥。只有管理开关为 `1` 且此值非空时，写入 API 才可用；日常手动上传游戏无需设置。
- `NODE_ENV`：生产惯例设为 `production`。应用是否进入开发模式由命令行 `--dev` 决定，不能靠该变量把 `npm run dev` 变成生产服务。
- `PLAYWRIGHT_CHROME_PATH`：仅供浏览器测试使用，指定本机 Chrome/Chromium 可执行文件。
- `NES_FCEUMM_ROMS`：仅供私有卡带回归测试使用，值为绝对文件路径组成的 JSON 数组。

典型生产配置：

```sh
NODE_ENV=production PORT=4178 LIBRARY_DIR=/srv/pixel-link/roms LIBRARY_WEB_MANAGEMENT=0 npm start
```

没有必须设置的管理员密钥。前端没有上传或密钥输入入口，即使开启 API 管理，也不会出现额外的网页管理面板。

<a id="library"></a>
## 8. 游戏库、子目录、搜索与分页

### 8.1 直接复制文件

使用宝塔文件管理、SFTP 或其他服务器文件传输方式，把游戏放进 `LIBRARY_DIR` 对应目录。例如：

```text
.data/library/
├── 魂斗罗.nes
├── 双人游戏/
│   ├── 雪人兄弟.NES
│   └── 动作/
│       └── 汉化版/
│           └── 坦克大战.nes
└── library.json             可选
```

所有层级的普通子目录都会扫描，不需要逐层登记。新增、重命名或删除文件后，刷新页面或重新打开「游戏库」即可更新，不需要重启 Node。

扫描规则：

- 接受 `.nes` 和 `.NES`，单个文件最大 8 MB，并检查 NES 文件头。
- 默认名称来自文件名，去掉扩展名；界面显示相对文件夹路径。
- 不自动扫描隐藏文件/目录和符号链接。
- `.sav`、`.zip`、`.7z` 等不会作为卡带列出；压缩包请先在服务器解压。
- 扫描发现的坏文件或尚未复制完整的卡带会跳过，避免影响其他游戏。
- SHA-256 相同的内容合并显示；不同文件名并不必然代表不同游戏。
- 进程会缓存未变化文件的摘要，列表请求仍会检查目录变化。首次扫描大量卡带需要读取并校验文件，可能比之后慢。

目录需要运行用户具有进入权限，游戏文件需要读取权限。默认关闭网页管理时，无需让玩家通过网站写入游戏目录；应用启动仍需能够创建/访问配置的目录。

### 8.2 搜索与分页

搜索支持：

- 游戏名称，例如「魂斗罗」。
- 相对文件夹路径，例如「动作/汉化版」。
- 多个空格分隔的关键词，例如「汉化 魂斗罗」，所有关键词都需匹配。
- 英文忽略大小写，并规范化全角/半角形式。

分页支持每页 30、60、100 款，以及首页、上一页、下一页、末页和页码选择。修改搜索词或每页数量后自动回到第一页。

**当前搜索和分页在前端完成**：`GET /api/library` 返回整份去重后的游戏元数据，前端筛选并只渲染当前页。分页不会下载其他卡带内容；实际选择游戏后才下载该 ROM。若将来需要数万条以上的更大规模目录，可进一步实现后端查询分页和索引，当前没有宣称提供此接口。

### 8.3 设置默认游戏与显示名称

不写配置也能列出所有游戏。需要首页自动加载某款游戏时，在游戏目录放入 `library.json`：

```json
{
  "defaultGame": "双人游戏/雪人兄弟.NES"
}
```

自动加载后可点击播放继续。通过邀请链接进入房间时，会优先处理房主卡带，不加载本站默认游戏。

自定义名称：

```json
{
  "defaultGame": "双人游戏/雪人兄弟.NES",
  "games": [
    {
      "file": "双人游戏/雪人兄弟.NES",
      "name": "雪人兄弟 · 汉化版"
    }
  ]
}
```

`games` 只覆盖所列文件的元信息，不会限制其他文件自动扫描。路径使用目录内的相对路径。取消默认游戏时，删除 `defaultGame` 以及可能存在的旧配置 `defaultId`，或使用下面的命令。

### 8.4 可选的本机管理命令

直接复制卡带不需要这些命令；它们适用于希望用终端管理默认项的情况。命令使用与服务相同的 `LIBRARY_DIR`：

```sh
LIBRARY_DIR=/srv/pixel-link/roms npm run library -- list
LIBRARY_DIR=/srv/pixel-link/roms npm run library -- default '双人游戏/雪人兄弟.NES'
LIBRARY_DIR=/srv/pixel-link/roms npm run library -- default none
LIBRARY_DIR=/srv/pixel-link/roms npm run library -- import /tmp/game.nes --name '自定义名称' --default
```

`import` 会把卡带复制为摘要文件名并登记元信息；若希望保留原来的文件名和文件夹结构，直接复制到目录即可。

<a id="usage"></a>
## 9. 联机、按键、手机与存档

### 9.1 双人联机

1. 房主选择本机卡带、游戏库游戏或原创演示，创建房间。
2. 点击复制邀请链接，朋友打开链接后自动成为 P2；也支持手动输入六位房间码。
3. 等待卡带自动同步：游戏库卡带优先直接下载，本机卡带通过房主 → 服务器 → P2 分块转发。
4. 两人就绪后，房主选择「继续房主当前进度」或「从头开始新游戏」，再开始联机。
5. 结束本局后可继续单机、保存，或再次从房主进度开始联机。

创建房间本身不会重置当前游戏。房间邀请不要求 P2 事先上传相同文件；只有接收失败时才需要检查错误或点击重试。

本机卡带中转最大 8 MB，每块 64 KB，并等待接收确认。服务端仅保存传输计数和增量摘要，不把整份卡带写到磁盘或游戏库。P2 刷新后需重新获取这份临时卡带。

房间仅支持两人。离房、断线或服务重启会关闭房间；没有账号、长期房间和自动断线续连机制。六位房间码用于朋友间邀请，不等同于账号访问控制。

### 9.2 默认按键

1P 和远程联机时的本机按键：

- 移动：W / S / A / D。
- B：J；A：K。
- SELECT：空格；START：Enter。

本地 2P：

- 移动：方向键。
- B：小键盘 1；A：小键盘 2。
- SELECT：小键盘 0；START：小键盘 Enter。

可以在按键设置中修改，设置保存在当前浏览器。

### 9.3 手机、声音与主题

手机建议横屏游玩。摇杆支持八方向和中心死区，可以同时移动并按 A/B；每根手指独立处理，松开其中一根不会释放其他手指的按键。

全屏包含画面和触控操作区；原生全屏不可用时使用页面内全屏。无法自动锁定横屏时，请手动旋转设备。切后台、旋转或退出全屏时会清理触控输入，防止持续移动。

声音需要浏览器允许 AudioContext/AudioWorklet，通常需要用户点击和 HTTPS 或 localhost 安全环境。首次静音时可以点击声音按钮或游戏画面。

右上角可以切换深色/浅色主题；主题存在浏览器，游戏像素画面不随主题改变。

### 9.4 浏览器本地存档

- 每个游戏 3 个手动槽和 1 个自动槽，存储在 IndexedDB。
- 快速存档使用手动槽 1；运行中每 30 秒尝试自动保存。
- 建房、离房、换游戏和重开前也会尝试保存；浏览器关闭前的异步写入不作保证。
- 读取后暂停，点击播放继续；联机中不能单独读档，应先结束本局，由房主读档后再继续联机。
- 可导出 `.pls` 备份，在其他设备加载同一份卡带后导入。
- 存档按 ROM SHA-256 和核心版本校验。修改版、汉化版或不同内容的 ROM 不能随意混用即时存档。
- 旧 JSNES 存档通过保留的旧核心读取，界面显示「JSNES · 旧存档」；新加载/重新开始使用 FCEUmm。两种即时存档不直接转换。
- 常见 `.sav` 通常是其他模拟器的电池存档，并非本项目 `.pls` 即时存档；当前没有通用 `.sav` 导入入口。

**服务器没有用户存档持久化接口，存档不占服务器磁盘。** 联机续玩时，房主状态会经 WebSocket 临时发送给双方，但不写数据库或磁盘。

存档按浏览器站点来源隔离。更换域名、HTTP 改 HTTPS、更换浏览器或清理网站数据，都可能使原存档不再可见；迁移前先导出 `.pls`。

<a id="maintenance"></a>
## 10. 更新、备份与迁移

### 10.1 更新部署

1. 保存当前程序版本，备份游戏目录、`library.json` 和自定义部署配置。
2. 把新的部署包解压覆盖程序文件；不要删除 `.data/` 或独立的 `LIBRARY_DIR`。
3. 依赖有变化时执行 `npm ci --omit=dev`；不确定时可执行一次。
4. 宝塔中重启 Node 项目，或执行 `sudo systemctl restart pixel-link`。
5. 检查内网和公网 `/health`，确认运行的后端协议/核心版本。
6. 房主和 P2 刷新网页，重新建房。

**前端、后端及 shared 目录必须一起更新。** 只替换 `dist/` 或仅重载 NGINX，不会让正在运行的 Node 进程加载新后端。旧后端可能造成自动传卡带失效或协议不一致。

替换 `dist/` 前确保新版目录完整，避免更新中途缺失 JS/WASM。升级会关闭内存房间，安排在无人联机时操作。

### 10.2 需要备份什么

服务端备份：

- `.data/library/` 或 `LIBRARY_DIR` 指定的完整游戏目录。
- 其中的 `library.json`。
- 宝塔项目的环境变量、启动命令，或 systemd unit。
- NGINX 自定义配置及证书管理信息。
- 当前部署包/代码版本。

用户游戏进度需要在各自浏览器导出 `.pls`；备份服务器无法代替浏览器存档备份。

### 10.3 更换服务器或域名

迁移游戏目录和部署配置，使用相同版本启动应用，更新 DNS 和证书，再验证 `/health`、游戏库与双人联机。自定义 `LIBRARY_DIR` 路径变化时同步修改环境变量。

若域名或协议改变，提醒用户提前导出本地档，再在新站点导入。仅服务器 IP 改变而站点来源保持一致，通常不需要迁移浏览器存储。

<a id="docker"></a>
## 11. Docker 部署

项目提供多阶段 [Dockerfile](Dockerfile)，构建时生成前端并安装生产依赖：

```sh
docker build -t pixel-link .
docker volume create pixel-link-data
docker run -d \
  --name pixel-link \
  --restart unless-stopped \
  -p 127.0.0.1:4178:4178 \
  -e LIBRARY_WEB_MANAGEMENT=0 \
  -v pixel-link-data:/app/.data \
  pixel-link
```

然后按前文配置宿主机 NGINX，代理到 `127.0.0.1:4178`。

如需在宿主机直接管理游戏文件，可以用绑定目录替代命名卷：

```sh
-v /srv/pixel-link/data:/app/.data
```

容器以非 root 的 `node` 用户运行；绑定目录必须给该用户对应 UID/GID 访问和所需写入权限，尤其要能在首次启动创建 `.data/library`。不要靠公开 4178 绕过 NGINX。

查看日志和健康状态：

```sh
docker logs --tail 100 pixel-link
curl http://127.0.0.1:4178/health
```

`.dockerignore` 排除了本地 `.data`，构建镜像不会自动把私人游戏库打进去。

<a id="development"></a>
## 12. 开发文档

### 12.1 项目结构

```text
src/
  main.js                   页面、游戏库搜索分页、房间与存档交互
  style.css                 桌面、手机、主题样式
  emulator.js               统一模拟器外观接口、画面与音频
  fceumm-core.js            FCEUmm WASM 实例、输入、逐帧、状态序列化
  nes-core.js               旧 JSNES 兼容入口
  mapper23.js               旧核心的 VRC2b 扩展
  ppu-compat.js             旧核心的精灵渲染兼容修复
  room-roms.js              前端卡带自动获取与分块传输
  save-store.js             IndexedDB、本地存档快照
  controls.js               键盘映射与输入合并
  mobile-controls.js        多点触控摇杆与按钮
  game-stage.js             原生/页面内全屏与横屏提示
  theme.js                  主题切换
server/
  index.js                  HTTP、静态资源、开发中间件、WebSocket 升级
  library.js                游戏库 HTTP 接口与可选管理鉴权
  library-store.js          文件扫描、摘要缓存、元信息与默认项
  rooms.js                  房间、就绪、开始、逐帧输入、心跳
  rom-relay.js              卡带分块临时转发
shared/
  session.js                联机协议版本、存档核心版本和校验
  rom-transfer.js           ROM 大小、分块编码与解码
public/
  cores/                    预编译核心及对应源码和许可
  audio-worklet.js          浏览器音频工作线程
  demo.nes                  自制测试 ROM
native/fceumm/              C/libretro 桥接、Makefile、上游源码包
scripts/                    核心构建、演示生成、游戏库命令
tests/                      Node 与浏览器测试
deploy/                     部署配置和补充说明
```

### 12.2 HTTP 接口

- `GET /health`：存活状态、当前协议版本、核心版本和卡带转发能力；应作为升级后的检查入口。
- `GET /api/library`：完整游戏元信息和 `defaultId`，返回内容不包含服务器绝对路径。搜索/分页目前由前端实现。
- `GET /api/library/:id/rom`：下载给定 SHA-256 标识的 NES 卡带。
- `/netplay`：WebSocket 入口，不是普通 HTTP 页面。
- `/cores/`：直接提供 JS/WASM、许可证和源码包；开发模式也绕过 Vite 的公共模块导入改写。
- 其他生产静态文件从 `dist/` 提供；开发模式其余页面交给 Vite。

可选写入 API 默认关闭。只有 `LIBRARY_WEB_MANAGEMENT=1` 与非空 `LIBRARY_ADMIN_TOKEN` 同时配置，且请求满足同源 Origin 与 `x-library-token` 鉴权，管理接口才可用。普通部署直接管理服务器文件即可。

### 12.3 核心运行与音视频

FCEUmm 固定上游版本：

```text
ac0d00a7fc01166f84c7bac01d1084ebfd2b865e
```

使用 Emscripten 4.0.20 编译，当前应用核心标识为 `fceumm-ac0d00a-pl1`。

`native/fceumm/bridge.c` 实现 libretro 环境、视频、音频、输入和状态接口，向 JS 暴露：加载 ROM、执行一帧、获取画面/音频、保存/恢复状态、读取调试 RAM 和帧率等函数。

- 每个实例独立使用 WASM 内存和内存文件系统。
- 每次新游戏或重开创建独立实例，避免复用历史控制器和核心全局状态。
- 核心生成 256×240 画面和 48kHz 双声道音频；前端交给 Canvas 和 AudioWorklet。
- 游戏内容写入的是 WASM 的浏览器内存文件系统，不是服务器文件系统。
- 同一页面复用已下载的核心 JS/WASM，读档和重开不重复下载整份核心二进制。
- 按核心报告的 PAL/NTSC 帧率调度，运行时不允许玩家各自更改核心参数。
- 上电 RAM 固定填充 FF，减少不同实例的初始状态差异。

普通修改页面或服务端逻辑不需要重新构建核心。

### 12.4 联机同步

客户端先通过 `hello` 协议握手确认版本，再创建/加入房间。服务器为房间维护参与者、卡带标识、运行批次 `epoch` 和按帧输入队列。

双方输入提前 6 帧提交。服务器收齐两人的同一帧输入后广播帧数据，双方各执行一帧。约 60FPS 时固定输入缓冲约 100ms，另有实际网络延迟；当前不提供运行时回滚和自动状态纠偏。

继续进度时，房主的同一份存档先恢复到双方，然后再提交输入。新开一局则双方创建新的默认核心实例。JSNES 旧档续玩时，双方都恢复到旧核心，不能把不同核心的模拟结果混在同一局。

网络慢、切后台或设备处理慢可能导致等待；服务器不替客户端执行模拟。当前没有跨进程房间共享机制。

### 12.5 存档格式与版本维护

`.pls` 是 JSON 容器，包含格式标识、版本、核心标识、ROM 摘要、显示名称、保存时间与核心状态。

- FCEUmm 状态使用 libretro 二进制序列化结果的 Base64，附摘要、画面、输入和用于诊断的 RAM 快照。
- JSNES 旧状态保留原 JSON 结构，由旧核心恢复。
- `shared/session.js` 统一校验，并限制存档最大 6 MB。
- `src/save-store.js` 使用 `pixel-link-saves` IndexedDB，按 ROM 和槽位区分。

修改核心、构建选项或状态布局时，应检查是否需要更新核心标识；修改联机消息语义或确定性行为时，应更新 `PROTOCOL`。同步更新前后端、健康检查样例、部署文档和相关测试，避免只更新网页而保留旧房间服务。

### 12.6 重建 FCEUmm

仅核心开发需要安装并激活 **Emscripten 4.0.20**。构建脚本会核对编译器版本，从仓库内对应上游源码包解压并编译：

```sh
npm run build:core
npm run build
```

构建说明见 [native/fceumm/README.md](native/fceumm/README.md)。修改桥接或构建文件后，还需更新公开的对应源码包和许可证材料；不能只发布新 WASM 而保留不匹配的旧源码包。

当前公开源码包的生成方式：

```sh
tar -czf public/cores/fceumm-source.tar.gz \
  native/fceumm/bridge.c \
  native/fceumm/Makefile \
  native/fceumm/README.md \
  native/fceumm/COPYING \
  native/fceumm/upstream-source.tar.gz
```

### 12.7 后续制作电脑版

目前没有桌面安装包。后续可用 Electron 等容器复用前端与 WASM 核心，再增加本地游戏目录管理。桌面客户端连接公网房间服务时，需要将当前同源 WebSocket 地址改为可配置地址，并明确调整服务端 Origin 策略；不能仅打包一个窗口就视为完整桌面联机版本。

<a id="testing"></a>
## 13. 测试、构建与发布

### 13.1 常用命令

```sh
npm ci
npm test
npm run test:browser
npm run build
npm run test:production
```

- `npm test`：Node 回归测试，包括核心、状态、房间、卡带转发、目录扫描和输入逻辑。
- `npm run test:browser`：开发模式的页面/联机/存档/手机/游戏库搜索分页测试。
- `npm run test:production`：基于 `dist/` 的生产服务器检查；先执行 build。
- `npm run demo`：重新生成项目自制测试 ROM。
- `npm run build:core`：重建 WASM，通常不需要执行。

浏览器测试优先使用本机 Chrome，默认检测 macOS 的常见 Chrome 路径。其他平台可设置：

```sh
PLAYWRIGHT_CHROME_PATH=/path/to/chrome npm run test:browser
```

或安装 Playwright Chromium 后使用：

```sh
npx playwright install chromium
npm run test:browser
```

测试服务使用独立目录和端口：

- 开发浏览器测试：`4181`，游戏目录 `.data/browser-test-library`，热更新端口 `14181`。
- 生产浏览器测试：`4182`，游戏目录 `.data/production-test-library`。

这些目录供测试使用，不要把自己的正式游戏库放进去，也不要提前运行占用这些端口的测试服务。测试失败上下文与截图在 `test-results/`。

### 13.2 私有卡带回归

卡带路径通过环境变量传入，不复制或提交到项目。示例：

```sh
NES_FCEUMM_ROMS='["/absolute/path/game-one.nes","/absolute/path/game-two.nes"]' node --test tests/fceumm.test.js
```

也可以在已构建后检查生产浏览器加载：

```sh
NES_FCEUMM_ROMS='["/absolute/path/game-one.nes"]' npm run test:production
```

私有回归中的按钮时序以已验证样本为基础；任意其他游戏可能需要修改开始游戏的时序，不能把一次颜色检查等同于通关或所有关卡验证。

### 13.3 创建发布包

先构建、验证，再打包。以下命令适用于当前项目目录：

```sh
npm run build
mkdir -p releases
COPYFILE_DISABLE=1 tar \
  --exclude='*.pl.o' \
  --exclude='*.o' \
  --exclude='.DS_Store' \
  -czf releases/pixel-link-server.tar.gz \
  dist server shared src public native licenses scripts tests \
  package.json package-lock.json \
  playwright.config.js playwright.production.config.js \
  index.html README.md COPYING THIRD_PARTY_NOTICES.md \
  deploy Dockerfile .dockerignore .gitignore
```

发布包显式列出程序目录，因此不包含 `.data/`、用户卡带和 `node_modules/`。`dist/demo.nes` 与 `public/demo.nes` 是项目自制演示，可以随包发布。

更新 README 或部署文档后，也应重新打包，避免服务器包里仍是旧说明。

<a id="faq"></a>
## 14. 常见问题

### npm / node: command not found

先检查 `ls /www/server/nodejs/`，使用真实存在版本目录的 `bin` 更新当前终端 PATH；宝塔项目再单独选择该版本。详见第 4.2 节。

### 端口占用或 EADDRINUSE

检查是否同时运行了开发服务、终端 `npm start` 和宝塔守护进程。一个端口只能由一个服务监听；停止多余实例，或同时修改 `PORT` 与 NGINX 上游地址。

### NGINX 502 Bad Gateway

先在服务器执行：

```sh
curl http://127.0.0.1:4178/health
```

若失败，先查 Node 项目状态、日志、端口、依赖和工作目录；若成功，再检查 NGINX 代理地址与配置。不要用重装前端代替检查后端进程。

### 网页能打开，但提示无法连接房间服务

检查 HTTPS 页面是否使用 `wss`，NGINX 是否转发 Upgrade/Connection，Host 是否保留 `$http_host`。浏览器网络面板中的 `/netplay` 应建立 WebSocket 连接，通常可看到 HTTP 101；若被拒绝，再检查同源 Host、WAF/CDN 的 WebSocket 支持及旧代理规则。

### P2 仍需手动加载，或提示版本不一致

检查公网 `/health` 的协议/核心标识。覆盖 `dist`、`server`、`shared` 后必须重启 Node；双方都刷新页面。只更新 HTML/JS、只重载 NGINX、重启了另一个项目或代理仍指向旧端口，都可能导致这种现象。

新版握手会明确提示后端过旧或前后端版本不一致。

### FCEUmm 加载失败、WASM 404 或返回 HTML

确认 `dist/cores/fceumm.js` 与 `dist/cores/fceumm.wasm` 存在：

```sh
curl -I https://nes.example.com/cores/fceumm.wasm
```

正常应为 200，Content-Type 为 `application/wasm`。检查漏传文件、正则静态规则、SPA 回退或 CDN 旧缓存。

### 游戏库没有文件，或新增文件没有显示

检查实际 `LIBRARY_DIR`、启动用户权限、文件扩展名和文件头；压缩包需先解压。隐藏目录和符号链接不自动扫描。相同 SHA-256 的重复 ROM 会合并显示。

清空搜索条件并回到第一页，重新打开游戏库。如果改了环境变量，先重启 Node；如果只添加普通文件，无需重启。显式配置的 `library.json` 格式/路径错误也可能导致接口报错。

### 游戏很多，打开列表第一次较慢

首次扫描会读取并校验卡带，之后未变化文件会复用摘要缓存。分页限制的是页面渲染数量，元数据仍整份返回。检查服务器磁盘、文件数量、重复打开请求以及是否启用了错误的代理缓存；当前没有后台数据库索引。

### 没声音

使用 HTTPS 或 localhost，并点击游戏画面或声音按钮解锁音频；检查浏览器站点静音权限。普通手机 HTTP 访问不保证 AudioWorklet 可用。

### 手机全屏后方向不对或切后台出现等待

手动旋转横屏；有些浏览器不允许网页锁定方向，会改用页面内全屏。切后台时浏览器可能暂停帧循环，联机另一端会等待；双方返回游戏页面，必要时结束本局后重新从房主进度继续。

### 换域名后存档不见了

存档在浏览器，并按来源隔离；旧域名、localhost、HTTP 与 HTTPS 不共享。到原站导出 `.pls`，在新站加载相同 ROM 后导入。清理网站数据或使用无痕模式也会影响持久存档。

### 仍然有某份修改版卡带无法运行

FCEUmm 扩大了硬件支持范围，但不能保证损坏文件、任意修改版或所有特殊外设。保留文件名、错误信息、复现步骤、核心版本，并在本地用私有回归验证；不要直接修改 ROM 文件头来掩盖不支持的硬件类型。

<a id="license"></a>
## 15. 兼容范围与开源许可

当前产品入口支持 NES 卡带，不支持 GBA、SNES、压缩包直接运行；没有观战、通用外接手柄映射或桌面安装包。FCEUmm 已覆盖上游广泛的 Mapper，但具体游戏和设备仍需实际验证。

项目使用 GPL-2.0-or-later，FCEUmm 及桥接的许可证和对应源码随项目保留：

- [COPYING](COPYING)
- [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
- [FCEUmm 构建说明](native/fceumm/README.md)
- 上游 FCEUmm 对应源码：`native/fceumm/upstream-source.tar.gz`
- 网页可下载源码：`/cores/fceumm-source.tar.gz`
- JSNES：Apache-2.0；ws、js-sha256、Vite 等保留各自许可。

仓库和发布包不附带商业游戏卡带。请自行准备有权使用和提供的游戏文件；重新分发程序时保留适用的许可证及对应源码。
