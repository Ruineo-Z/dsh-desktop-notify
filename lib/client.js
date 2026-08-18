window.__ModuleLoader__.load({
	id: "dsh-desktop-notify",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
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
		//#region src/client/NotifySettings.tsx
		/**
		* "桌面通知" settings page: master switch, custom sound upload / preview /
		* removal, and a test notification button.
		*/
		const row = {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: "12px",
			padding: "12px 0",
			borderBottom: "1px solid rgba(127,127,127,0.18)"
		};
		const labelStyle = { fontWeight: 600 };
		const hintStyle = {
			fontSize: "12px",
			opacity: .65,
			marginTop: "4px"
		};
		const buttonStyle = {
			padding: "6px 14px",
			borderRadius: "6px",
			border: "1px solid rgba(127,127,127,0.35)",
			background: "transparent",
			cursor: "pointer",
			fontSize: "13px"
		};
		const primaryButton = {
			...buttonStyle,
			background: "rgba(80,140,255,0.15)",
			borderColor: "rgba(80,140,255,0.45)"
		};
		const messageStyle = {
			marginTop: "10px",
			fontSize: "13px",
			color: "rgba(60,160,90,1)"
		};
		const errorStyle = {
			marginTop: "10px",
			fontSize: "13px",
			color: "rgba(220,80,80,1)"
		};
		async function readJson(response) {
			if (!response.ok) {
				let detail = "";
				try {
					detail = (await response.json()).error ?? "";
				} catch {}
				throw new Error(`请求失败 (${response.status})${detail ? `：${detail}` : ""}`);
			}
			return await response.json();
		}
		function NotifySettings() {
			const [config, setConfig] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(false);
			const [message, setMessage] = (0, react.useState)("");
			const [error, setError] = (0, react.useState)("");
			const [preview, setPreview] = (0, react.useState)("");
			const load = async () => {
				try {
					const value = await readJson(await fetch(ROUTES.config));
					setConfig(value);
					setPreview(`${ROUTES.sound}?t=${Date.now()}`);
				} catch (err) {
					setError(String(err));
				}
			};
			(0, react.useEffect)(() => {
				load();
			}, []);
			const toggleEnabled = async () => {
				if (!config) return;
				setBusy(true);
				setError("");
				setMessage("");
				try {
					await fetch(ROUTES.config, {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ enabled: !config.enabled })
					});
					await load();
					setMessage(config.enabled ? "通知已关闭" : "通知已开启");
				} catch (err) {
					setError(String(err));
				} finally {
					setBusy(false);
				}
			};
			const uploadSound = async (file) => {
				setBusy(true);
				setError("");
				setMessage("");
				try {
					await fetch(ROUTES.sound, {
						method: "POST",
						headers: { "content-type": file.type || "audio/mpeg" },
						body: file
					});
					await load();
					setMessage(`已上传提示音：${file.name}`);
				} catch (err) {
					setError(String(err));
				} finally {
					setBusy(false);
				}
			};
			const removeSound = async () => {
				setBusy(true);
				setError("");
				setMessage("");
				try {
					await fetch(ROUTES.sound, { method: "DELETE" });
					await load();
					setMessage("已移除自定义提示音");
				} catch (err) {
					setError(String(err));
				} finally {
					setBusy(false);
				}
			};
			const sendTest = async () => {
				setBusy(true);
				setError("");
				setMessage("");
				try {
					await fetch(ROUTES.test, { method: "POST" });
					setMessage("测试通知已发送，请查看屏幕右上角");
				} catch (err) {
					setError(String(err));
				} finally {
					setBusy(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: { maxWidth: 560 },
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: hintStyle,
						children: "Agent 执行完成 / 失败 / 中断或需要你批准时，发送 macOS 桌面通知。可上传自定义提示音（通知时自动播放）。"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: row,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: labelStyle,
							children: "启用桌面通知"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: hintStyle,
							children: "总开关，关闭后所有事件都不再弹通知"
						})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							role: "switch",
							"aria-checked": config?.enabled ?? true,
							onClick: () => void toggleEnabled(),
							disabled: busy || !config,
							style: {
								...buttonStyle,
								minWidth: 96,
								background: config?.enabled ? "rgba(80,140,255,0.18)" : void 0
							},
							children: config?.enabled ? "已开启" : "已关闭"
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: row,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: labelStyle,
								children: "自定义提示音"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: hintStyle,
								children: config?.soundFileName ? `当前：${config.soundFileName}` : "未设置（使用系统默认提示音）"
							}),
							config?.soundFileName && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("audio", {
								controls: true,
								src: preview,
								style: {
									marginTop: 8,
									maxWidth: 320,
									height: 32
								}
							})
						] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								gap: 8,
								alignItems: "center"
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								style: {
									...buttonStyle,
									display: "inline-block"
								},
								children: ["选择音频文件", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "file",
									accept: "audio/*",
									style: { display: "none" },
									disabled: busy,
									onChange: (event) => {
										const file = event.target.files?.[0];
										if (file) uploadSound(file);
										event.target.value = "";
									}
								})]
							}), config?.soundFileName && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: buttonStyle,
								disabled: busy,
								onClick: () => void removeSound(),
								children: "移除"
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: row,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: labelStyle,
							children: "测试通知"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: hintStyle,
							children: "立即发送一条测试通知，确认效果"
						})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: primaryButton,
							disabled: busy,
							onClick: () => void sendTest(),
							children: "发送测试"
						})]
					}),
					message && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: messageStyle,
						children: message
					}),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: errorStyle,
						children: error
					})
				]
			});
		}
		//#endregion
		//#region src/client/index.ts
		/** Required services (fiber inject waiting — the runtime must be up first). */
		const inject = ["slots"];
		/** Register the settings section once the `settings.section` declaration is on the ledger. */
		function apply(ctx) {
			try {
				ctx.slots.inject("settings.section", () => ctx.slots.register({
					name: "settings.section",
					id: "desktop-notify",
					order: 80,
					label: () => "桌面通知",
					inject: () => ({})
				}, NotifySettings));
			} catch (error) {
				console.warn("[dsh-desktop-notify] 设置页注册失败:", error);
			}
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map