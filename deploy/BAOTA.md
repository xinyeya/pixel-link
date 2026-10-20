# 宝塔部署与更新简表

首次部署请按 [README：宝塔面板部署](../README.md#baota) 操作；完整代理片段见 [README：宝塔 NGINX 配置](../README.md#nginx-baota)，包含 Node 路径、环境变量和排错步骤。

本次将默认模拟核心切换为 FCEUmm WebAssembly。原有 JSNES 存档通过旧核心读取；新游戏使用 FCEUmm，存档仍只在浏览器。联机双方需刷新到同一版本。

如果 P2 仍需手动加载卡带：确保覆盖了 `server`、`shared`、`dist` 三个目录，再在宝塔 Node 项目里重启。只覆盖网页文件或重载 NGINX 不会更新正在运行的 Node 进程。打开网站 `/health` 应能看到 `protocol: "pixel-link-7-fceumm"` 和 `romRelay: true`；若只有 `ok: true`，仍在运行旧后端，或反向代理指向其他项目/端口。

1. 上传新的 `pixel-link-server.tar.gz`，解压覆盖原项目目录中的程序文件，保留 `.data/library` 和原有 NES 游戏。压缩包不包含 `.data`，也不包含用户存档。
2. 如需安装生产依赖，在项目目录执行（按你当前已安装版本）：

```sh
export PATH="/www/server/nodejs/v24.12.0/bin:$PATH"
npm ci --omit=dev
```

3. 在宝塔 Node 项目中继续选择 `start: node server/index.js`、Node v24.12.0、端口 4178，并重启项目。不要同时启动第二个实例。
4. 保留已修正的 NGINX 反代：`proxy_set_header Host $http_host;` 以及 WebSocket Upgrade/Connection。新功能仍使用 `/netplay`，无需增加路由或开放新端口。
5. 房主和同伴刷新网页。旧版页面的协议与本次更新不同，需要一起更新。

更新后：房间链接自动加入；卡带自动下载或经房主临时中转；右上角可切换浅色主题。本地卡带中转和联机状态均不写服务器磁盘，存档继续保存在各用户浏览器。

本次手机体验更新：全屏保留操作区，新增八方向摇杆和多点触控，可同时移动并按 A/B。手机建议横屏游玩，部分浏览器使用页面内全屏作为替代。更新程序文件后刷新页面即可，无需修改反向代理或新增环境变量。

FCEUmm 已编译在 `dist/cores` 中（核心约 0.9 MB，首次加载后浏览器可复用 WASM 编译缓存）。不要漏传 `.wasm`。服务器仅需现有 Node.js 环境，不需要 Emscripten、模拟器进程、额外端口或 CDN。`/health` 的 core 应为 `fceumm-ac0d00a-pl1`。若自定义了 NGINX 静态文件规则，应保证 `/cores/*.wasm` 可访问并返回 `application/wasm`，不能被 SPA 回退成 HTML；继续全部反代到 Node 时已自动处理。

站点包含 FCEUmm 的许可证和对应源码包。部署包另外包含本项目源文件与构建说明，便于备份和后续制作电脑版；不包含用户卡带、`.data` 或 node_modules。

游戏库新增搜索，可按名称或子目录路径查找；所有层级的普通子文件夹都会自动扫描。把文件夹整体放到 `.data/library`（或 LIBRARY_DIR 指定位置），重新打开游戏库即可，无需逐层配置。仅扫描 NES 文件，不扫描压缩包、隐藏文件夹或符号链接。列表支持首页/上一页/下一页/末页、直接跳页及每页 30/60/100 款，搜索查找全部游戏并自动回到第一页。
