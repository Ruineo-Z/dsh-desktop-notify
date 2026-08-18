import { spawn } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
//#region src/notify.ts
/**
* Desktop notification engine.
*
* macOS notifications themselves only support system sound names, so a
* custom uploaded audio file is played alongside via `afplay` (the system
* notification stays silent when a custom sound is configured).
*/
/** Titles per notification kind (emoji + label). */
const KIND_TITLES = {
	start: "▶️ DSH 开始执行",
	complete: "✅ DSH 执行完成",
	error: "❌ DSH 执行失败",
	interrupt: "⏹️ DSH 执行中断",
	ask: "🙋 DSH 需要你决策"
};
/** AppleScript string escaping. */
function appleEscape(value) {
	return String(value ?? "").replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}
/** Show one macOS notification (+ optional custom audio via afplay). */
function showNotification(options, warn) {
	const { title, body, systemSound, customSoundPath } = options;
	const soundClause = systemSound && !customSoundPath ? " sound name \"Glass\"" : "";
	spawn("osascript", ["-e", `display notification "${appleEscape(body)}" with title "${appleEscape(title)}"${soundClause}`], { stdio: "ignore" }).on("error", (error) => {
		warn?.(`osascript 启动失败: ${String(error)}`);
	});
	if (customSoundPath) spawn("afplay", [customSoundPath], { stdio: "ignore" }).on("error", (error) => {
		warn?.(`afplay 播放失败: ${String(error)}`);
	});
}
//#endregion
//#region src/protocol.ts
/**
* Shared wire contract between the host half and the browser half.
* This file is imported by both src/index.ts (node) and src/client/* (browser),
* so it must stay dependency-free.
*/
/** Base path of the plugin's HTTP route family. */
const API = "/api/dsh-desktop-notify";
/** HTTP route paths. */
const ROUTES = {
	config: `${API}/config`,
	sound: `${API}/sound`,
	test: `${API}/test`
};
//#endregion
//#region src/routes.ts
/**
* The /api/dsh-desktop-notify route family: config read/write, sound upload
* (raw body), sound playback (preview), sound removal, and a test
* notification. Every route carries a loopback-only trust fence — these
* endpoints write to the user's home directory, so LAN-exposed dsh web
* deployments must not serve them.
*/
/** Cap on uploaded audio bodies. */
const MAX_SOUND_BYTES = 10 * 1024 * 1024;
/** Content-type → file extension for uploaded audio. */
const SOUND_EXT_BY_TYPE = {
	"audio/mpeg": "mp3",
	"audio/mp3": "mp3",
	"audio/wav": "wav",
	"audio/x-wav": "wav",
	"audio/mp4": "m4a",
	"audio/x-m4a": "m4a",
	"audio/aac": "aac",
	"audio/ogg": "ogg",
	"audio/flac": "flac",
	"audio/webm": "webm"
};
/** Extension → content-type for serving the stored sound. */
const MIME_BY_EXT = {
	mp3: "audio/mpeg",
	wav: "audio/wav",
	m4a: "audio/mp4",
	aac: "audio/aac",
	ogg: "audio/ogg",
	flac: "audio/flac",
	webm: "audio/webm"
};
function writeJson(res, status, body) {
	const payload = JSON.stringify(body);
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"referrer-policy": "no-referrer"
	});
	res.end(payload);
}
function isLoopbackRequest(req) {
	const address = req.socket.remoteAddress?.toLowerCase() ?? "";
	if (address === "::1" || address.startsWith("::ffff:127.") || address.startsWith("127.")) return true;
	const secFetch = req.headers["sec-fetch-site"];
	return secFetch === "same-origin" || secFetch === "same-site";
}
async function readRawBody(req, limit) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		const buffer = chunk;
		size += buffer.length;
		if (size > limit) return null;
		chunks.push(buffer);
	}
	return Buffer.concat(chunks);
}
/** Build the plugin's route family. */
function buildRoutes(deps) {
	const { store, notify } = deps;
	const sendConfig = (res) => {
		writeJson(res, 200, store.get());
	};
	return [
		{
			kind: "exact",
			path: ROUTES.config,
			handler: async (req, res) => {
				if (!isLoopbackRequest(req)) return writeJson(res, 403, { error: "loopback only" });
				if (req.method === "GET") return sendConfig(res);
				if (req.method !== "POST") return writeJson(res, 405, { error: "method not allowed" });
				const body = await readRawBody(req, 64 * 1024);
				if (!body) return writeJson(res, 413, { error: "body too large" });
				let patch;
				try {
					patch = JSON.parse(body.toString("utf8"));
				} catch {
					return writeJson(res, 400, { error: "invalid json" });
				}
				if (typeof patch !== "object" || patch === null) return writeJson(res, 400, { error: "invalid body" });
				const record = patch;
				if (typeof record.enabled !== "boolean") return writeJson(res, 400, { error: "enabled must be boolean" });
				store.update({ enabled: record.enabled });
				return sendConfig(res);
			}
		},
		{
			kind: "exact",
			path: ROUTES.sound,
			handler: async (req, res) => {
				if (!isLoopbackRequest(req)) return writeJson(res, 403, { error: "loopback only" });
				if (req.method === "GET") {
					const path = store.soundPath();
					if (!path || !existsSync(path)) return writeJson(res, 404, { error: "no sound uploaded" });
					const ext = path.split(".").pop() ?? "mp3";
					res.writeHead(200, {
						"content-type": MIME_BY_EXT[ext] ?? "application/octet-stream",
						"content-length": String(store.get().soundFile ?? 0) === "" ? void 0 : void 0
					});
					createReadStream(path).pipe(res);
					return;
				}
				if (req.method === "POST") {
					const body = await readRawBody(req, MAX_SOUND_BYTES);
					if (!body || body.length === 0) return writeJson(res, 413, { error: "sound too large or empty" });
					const contentType = (req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
					const ext = SOUND_EXT_BY_TYPE[contentType] ?? "mp3";
					mkdirSync(store.soundsDir(), { recursive: true });
					const fileName = `custom.${ext}`;
					writeFileSync(join(store.soundsDir(), fileName), body);
					store.update({
						soundFile: fileName,
						soundFileName: fileName
					});
					return sendConfig(res);
				}
				if (req.method === "DELETE") {
					const path = store.soundPath();
					if (path && existsSync(path)) try {
						unlinkSync(path);
					} catch {}
					store.update({
						soundFile: null,
						soundFileName: null
					});
					return sendConfig(res);
				}
				return writeJson(res, 405, { error: "method not allowed" });
			}
		},
		{
			kind: "exact",
			path: ROUTES.test,
			handler: async (req, res) => {
				if (!isLoopbackRequest(req)) return writeJson(res, 403, { error: "loopback only" });
				if (req.method !== "POST") return writeJson(res, 405, { error: "method not allowed" });
				notify("complete", "这是一条测试通知，说明桌面通知已生效");
				return writeJson(res, 200, { ok: true });
			}
		}
	];
}
//#endregion
//#region src/store.ts
/**
* Persistent store for the plugin's configuration and uploaded sound.
* Data lives under ~/.dsh/dsh-desktop-notify/ (config.json + sounds/).
*/
const DIR = join(homedir(), ".dsh", "dsh-desktop-notify");
const CONFIG_PATH = join(DIR, "config.json");
const SOUNDS_DIR = join(DIR, "sounds");
const DEFAULTS = {
	enabled: true,
	soundFile: null,
	soundFileName: null
};
/** Persist plugin config to ~/.dsh/dsh-desktop-notify/config.json. */
var NotifyStore = class {
	value;
	constructor() {
		mkdirSync(DIR, { recursive: true });
		mkdirSync(SOUNDS_DIR, { recursive: true });
		let parsed = {};
		try {
			parsed = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
		} catch {}
		this.value = {
			...DEFAULTS,
			...parsed
		};
	}
	get() {
		return { ...this.value };
	}
	update(patch) {
		this.value = {
			...this.value,
			...patch
		};
		this.persist();
		return this.get();
	}
	/** Absolute path of the uploaded sound file, or null when absent. */
	soundPath() {
		if (!this.value.soundFile) return null;
		const path = join(SOUNDS_DIR, this.value.soundFile);
		return existsSync(path) ? path : null;
	}
	soundsDir() {
		return SOUNDS_DIR;
	}
	persist() {
		try {
			writeFileSync(CONFIG_PATH, JSON.stringify(this.value, null, 2), "utf8");
		} catch (error) {
			console.warn("[dsh-desktop-notify] 配置写入失败:", error);
		}
	}
};
//#endregion
//#region src/index.ts
const name = "desktop-notify";
/** Static event switches (plugin config, patch layer). */
const DEFAULT_SWITCHES = {
	onStart: false,
	onComplete: true,
	onError: true,
	onInterrupt: true,
	onAsk: true,
	systemSound: true,
	cooldownMs: 3e3
};
function switchKey(kind) {
	return `on${kind[0].toUpperCase()}${kind.slice(1)}`;
}
function shortId(id) {
	if (!id) return "会话";
	const text = String(id);
	return text.length > 10 ? text.slice(0, 8) : text;
}
function apply(ctx, rawConfig = {}) {
	const config = {
		...DEFAULT_SWITCHES,
		...rawConfig
	};
	const cooldownMs = Number(config.cooldownMs);
	const store = new NotifyStore();
	/** Debounce table: `${sessionId}:${kind}` → last notification timestamp. */
	const recent = /* @__PURE__ */ new Map();
	const warn = (message) => {
		ctx.logger?.warn?.(`[desktop-notify] ${message}`);
	};
	const notify = (sessionId, kind, body) => {
		if (!store.get().enabled) return;
		if (!config[switchKey(kind)]) return;
		const key = `${sessionId}:${kind}`;
		const now = Date.now();
		const last = recent.get(key);
		if (last !== void 0 && now - last < cooldownMs) return;
		recent.set(key, now);
		showNotification({
			title: `${KIND_TITLES[kind]}（${shortId(sessionId)}）`,
			body,
			systemSound: config.systemSound,
			customSoundPath: store.soundPath()
		}, warn);
	};
	ctx.on("session/event", (session, event) => {
		try {
			if (event.type === "turn/end") {
				const reason = event.data?.reason;
				const kind = reason?.kind;
				if (kind === "completed") notify(session.id, "complete", "Agent 已处理完当前任务");
				else if (kind === "error") {
					const message = reason?.error?.message ?? String(reason?.error ?? "未知错误");
					notify(session.id, "error", message.slice(0, 120));
				} else if (kind === "aborted") notify(session.id, "interrupt", "执行已被中断");
			} else if (event.type === "approval/asked") {
				const data = event.data ?? {};
				const tool = typeof data.toolName === "string" ? data.toolName : "某个工具";
				const reason = typeof data.reason === "string" ? `（${data.reason}）` : "";
				notify(session.id, "ask", `${tool} 请求批准${reason}`);
			}
		} catch (error) {
			warn(`处理 session 事件失败: ${String(error)}`);
		}
	}, { global: true });
	ctx.on("agent/status", (payload) => {
		try {
			if (payload.status === "running") notify(payload.agent?.session?.id ?? "agent", "start", "Agent 开始执行任务");
		} catch (error) {
			warn(`处理 agent 状态失败: ${String(error)}`);
		}
	}, { global: true });
	ctx.effect(() => {
		const disposers = buildRoutes({
			store,
			notify: (kind, body) => notify("settings", kind, body)
		}).map((route) => ctx.webServer.register(route));
		return () => {
			for (const dispose of disposers) dispose();
		};
	}, "dsh-desktop-notify: routes");
}
//#endregion
export { apply, name };
