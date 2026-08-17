# dsh-desktop-notify

DSH 桌面通知插件：当 agent **执行完成 / 失败 / 中断 / 需要你决策**时，发送 macOS 原生桌面通知，无需一直盯着 Web GUI。

## 特性

| 触发时机 | 通知 | 默认 |
|---|---|---|
| Agent 开始执行 | ▶️ DSH 开始执行 | 关 |
| 任务处理完成 | ✅ DSH 执行完成 | 开 |
| 执行出错 | ❌ DSH 执行失败（含错误信息） | 开 |
| 执行被中断 | ⏹️ DSH 执行中断 | 开 |
| 工具请求批准（需要你决策） | 🙋 DSH 需要你决策 | 开 |

- 零外部依赖：只用 Node 内建 `child_process` + macOS `osascript`
- 内置防抖：同一会话同一类事件在冷却窗口内不重复提醒
- 通知内容包含会话短 id，方便区分多个会话

## 安装

```bash
dsh plugin --profile web add link:/Users/ruinow/DSH/dsh-desktop-notify
```

然后刷新 Web GUI（或重启 `dsh web`），插件即生效。

## 配置

在 `~/.dsh/profiles/web/cordis.patch.yml` 追加：

```yaml
- insert:
    - id: desktop-notify
      name: 'dsh-desktop-notify'
      config:
        onStart: false      # 开始执行时通知
        onComplete: true    # 执行完成时通知
        onError: true       # 执行失败时通知
        onInterrupt: true   # 执行中断时通知
        onAsk: true         # 需要用户批准时通知
        sound: true         # 带系统提示音
        cooldownMs: 3000    # 同会话同类事件防抖间隔（毫秒）
```

## 工作原理

插件是宿主端 Cordis 插件，订阅两类事件：

- `session/event`（`{ global: true }`）：每个会话日志事件追加时派发。
  其中 `turn/end` 的 `reason.kind`（`completed` / `error` / `aborted`）对应完成/失败/中断；
  `approval/asked` 对应需要用户批准。
- `agent/status`：agent 空闲/运行状态转换，用于「开始执行」通知。

收到事件后用 `osascript display notification` 弹出 macOS 原生通知。

## 项目结构

```
dsh-desktop-notify/
├── package.json        # 包元数据 + dsh.bundle.patch 声明
├── cordis.patch.yml    # bundle patch：把插件插入 profile 插件名单
├── lib/index.js        # 插件实现（纯 ESM，零依赖）
└── README.md
```

## 备注

- 目前适配 macOS（`osascript`）。如需 Windows/Linux 支持，可将通知层替换为
  `node-notifier` 或各平台原生命令（如 `notify-send`）。
- 「模型主动提问（ask_user_question）」走的是 Web UI 服务端通道，宿主端暂无日志事件，
  需要决策的通知目前覆盖「工具请求批准」场景。
