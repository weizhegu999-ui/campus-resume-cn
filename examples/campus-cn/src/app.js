import { buildAiPrompt, buildProjectBullet, matchJob, reviewProject } from "./matching.js";
import {
	DEMO_RESUME,
	IMPORT_LIMITATIONS,
	createBlankResume,
	exportReactiveResume,
	getResumeText,
	getVisibleProjects,
	importResume,
	normalizeDraft,
} from "./model.js";

const $ = (selector) => document.querySelector(selector);
const STORAGE_KEY = "qingjian.draft.v1";
const TEMPLATES = { classic: "经典单栏", sidebar: "清爽双栏", technical: "工程简洁" };
const TABS = {
	basics: [
		"STEP 01 / ABOUT YOU",
		"从你自己开始。",
		"把基本信息写准确，让机会找到你。",
		"projects",
		"下一步：项目经历 →",
	],
	projects: [
		"STEP 02 / YOUR EXPERIENCE",
		"让经历，有据可依。",
		"按照 STAR 梳理项目，写清你做了什么。",
		"match",
		"下一步：岗位匹配 →",
	],
	match: [
		"STEP 03 / FIND YOUR FIT",
		"找到经历与岗位的交集。",
		"按本地词典核对术语，发现值得补充的真实经历。",
		"design",
		"下一步：模板排版 →",
	],
	design: [
		"STEP 04 / MAKE IT YOURS",
		"给好内容，一张好名片。",
		"选一套清晰的中文模板，留住重点和留白。",
		"basics",
		"返回：基本信息 →",
	],
};
let currentTab = "basics";
let projectIndex = 0;
let saveTimer;
let toastTimer;
let pageCount = 1;
let restored = false;
let draft;
try {
	const saved = localStorage.getItem(STORAGE_KEY);
	draft = saved ? importResume(JSON.parse(saved)) : normalizeDraft(DEMO_RESUME);
	restored = Boolean(saved);
} catch {
	draft = normalizeDraft(DEMO_RESUME);
}

function escape(value) {
	return String(value ?? "").replace(
		/[&<>"']/g,
		(char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
	);
}

function field(label, path, value, options = {}) {
	const attributes = `data-bind="${path}" maxlength="${options.max ?? 6000}"`;
	const input = options.rows
		? `<textarea ${attributes} rows="${options.rows}" placeholder="${escape(options.placeholder ?? "")}">${escape(value)}</textarea>`
		: `<input ${attributes} type="${options.type ?? "text"}" value="${escape(value)}" placeholder="${escape(options.placeholder ?? "")}" />`;
	return `<label class="field">${label}${input}</label>`;
}

function sectionTitle(title, caption = "") {
	return `<div class="form-section-title"><h2>${title}</h2><span class="section-caption">${caption}</span></div>`;
}

function entryHeader(label, array, index) {
	return `<div class="entry-heading"><strong>${label} ${String(index + 1).padStart(2, "0")}</strong><button class="remove-entry" data-remove="${array}" data-index="${index}">移除此项</button></div>`;
}

function renderBasics() {
	return `<section class="form-section">${sectionTitle("个人信息", "填写你希望公开的内容")}
		${field("姓名", "basics.name", draft.basics.name, { max: 200, placeholder: "你的姓名" })}
		${field("求职意向", "basics.headline", draft.basics.headline, { max: 500, placeholder: "例如：继电保护 / 电气设计实习生" })}
		<div class="fields-grid">${field("联系邮箱", "basics.email", draft.basics.email, { max: 320 })}${field("联系电话", "basics.phone", draft.basics.phone, { max: 100 })}</div>
		<div class="fields-grid">${field("所在城市", "basics.location", draft.basics.location, { max: 500 })}${field("个人主页 <span class='optional'>选填</span>", "basics.website", draft.basics.website, { max: 2000 })}</div>
	</section><section class="form-section">${sectionTitle("教育背景", "从最近的一段开始")}
		${draft.education.map((item, index) => `<div class="entry-card">${entryHeader("教育经历", "education", index)}${field("学校", `education.${index}.school`, item.school)}<div class="fields-grid">${field("专业", `education.${index}.major`, item.major)}${field("学历 / 学位", `education.${index}.degree`, item.degree)}</div>${field("时间", `education.${index}.period`, item.period, { placeholder: "2023.09 — 2027.06" })}${field("课程 / 成绩 / 其他", `education.${index}.details`, item.details, { rows: 2 })}</div>`).join("")}
		<button class="add-button" data-add="education">＋ 添加教育经历</button></section>
	<section class="form-section">${sectionTitle("专业技能", "每行一组，写明能做什么")}${field("技能与工具", "skills", draft.skills, { rows: 5, placeholder: "工具名称：你实际使用过的功能或场景" })}</section>
	<section class="form-section">${sectionTitle("个人简介", "选填，避免空泛自评")}${field("简介", "summary", draft.summary, { rows: 3 })}</section>
	<section class="form-section">${sectionTitle("实习 / 实践经历", "没有也可以留空")}${draft.experience.map((item, index) => `<div class="entry-card">${entryHeader("实践经历", "experience", index)}${field("单位 / 组织", `experience.${index}.company`, item.company)}<div class="fields-grid">${field("岗位 / 角色", `experience.${index}.role`, item.role)}${field("时间", `experience.${index}.period`, item.period)}</div>${field("实际工作与结果", `experience.${index}.description`, item.description, { rows: 3 })}</div>`).join("")}<button class="add-button" data-add="experience">＋ 添加实践经历</button></section>
	<section class="form-section">${sectionTitle("荣誉与证书", "只保留与岗位有关的内容")}${field("每行一项", "awards", draft.awards, { rows: 3 })}</section>`;
}

function renderProjectReview() {
	const target = $("#project-review");
	if (!target || !draft.projects.length) return;
	const project = draft.projects[projectIndex];
	const notes = reviewProject(project);
	target.innerHTML = `<div class="review-title"><strong>项目描述检查</strong><span>本地规则建议</span></div>${notes.length ? notes.map((note) => `<div class="review-note ${escape(note.severity)}"><strong>${escape(note.title)}</strong>${escape(note.detail)}</div>`).join("") : '<div class="review-note"><strong>结构信息已齐全</strong>请继续核对描述是否准确、是否能在面试中解释。</div>'}<div class="review-title"><strong>只按现有事实整理</strong></div><div class="generated-bullet">${escape(buildProjectBullet(project) || "填写上面的事实后，这里会整理出一段项目描述。")}</div>`;
}

function renderProjects() {
	if (!draft.projects.length)
		return '<div class="hint-box">从一个你能解释清楚的项目开始。课程设计、实验和个人作品都可以。</div><button class="add-button" data-add="projects">＋ 添加第一个项目</button>';
	projectIndex = Math.min(projectIndex, draft.projects.length - 1);
	const project = draft.projects[projectIndex];
	const root = `projects.${projectIndex}`;
	return `<div class="hint-box"><strong>先有事实，再有表达。</strong><br />示例内容是虚构演示，请替换成你的实际工作。缺少的数据可以留空。</div>
		<div class="project-tabs">${draft.projects.map((item, index) => `<button class="project-tab ${index === projectIndex ? "active" : ""}" data-project="${index}">${escape(item.name || `项目 ${index + 1}`)}</button>`).join("")}<button class="project-tab" data-add="projects">＋</button></div>
		${field("项目名称", `${root}.name`, project.name)}<div class="fields-grid">${field("你的角色", `${root}.role`, project.role)}${field("项目时间", `${root}.period`, project.period)}</div>
		${field('<span class="star-label"><span class="star-letter">S</span>背景：项目为什么开展？</span>', `${root}.context`, project.context, { rows: 2, placeholder: "原有问题、应用场景或实验背景" })}
		${field('<span class="star-label"><span class="star-letter">T</span>任务：你负责哪一部分？</span>', `${root}.task`, project.task, { rows: 2, placeholder: "具体职责和边界，而不是整个团队的成果" })}
		${field('<span class="star-label"><span class="star-letter">A</span>行动：你具体做了什么？</span>', `${root}.action`, project.action, { rows: 4, placeholder: "使用什么方法或工具，怎样解决问题" })}
		${field('<span class="star-label"><span class="star-letter">R</span>结果：留下了什么证据？</span>', `${root}.result`, project.result, { rows: 3, placeholder: "图纸、报告、测试结果等；有真实数字再填写" })}
		${field("技术 / 工具", `${root}.tech`, project.tech)}
		<div class="project-options"><label><input type="checkbox" data-bind="${root}.hidden" ${project.hidden ? "" : "checked"} data-invert="true" />在简历中显示</label><button class="remove-entry" data-remove="projects" data-index="${projectIndex}">移除此项目</button></div><div id="project-review"></div>`;
}

function renderMatchResult() {
	const target = $("#match-result");
	if (!target) return;
	let result;
	try {
		result = matchJob(getResumeText(draft), draft.jd);
	} catch (failure) {
		target.textContent = failure.message;
		return;
	}
	const tags = (items, matched = false) =>
		items
			.map(
				(item) =>
					`<span class="keyword-tag ${matched ? "matched" : ""}" title="${escape(item.aliases.join(" / "))}">${matched ? "✓ " : ""}${escape(item.label)}</span>`,
			)
			.join("");
	target.innerHTML = `<div class="match-score-card"><div class="score-ring" style="--score-deg:${(result.score ?? 0) * 3.6}deg"><strong>${result.score ?? "—"}${result.score === null ? "" : "%"}</strong></div><div><h2>岗位术语覆盖率</h2><p>${result.requirements.length ? `${result.matched.length} / ${result.requirements.length} 组术语在简历中提及` : "还没有识别到可比较的岗位术语"}</p></div></div><div class="keyword-group"><h3>简历已覆盖 · ${result.matched.length}</h3><div class="keyword-tags">${tags(result.matched, true) || '<span class="match-method">暂无匹配术语</span>'}</div></div><div class="keyword-group"><h3>待核对的经历 · ${result.missing.length}</h3><div class="keyword-tags">${tags(result.missing) || '<span class="match-method">暂无缺失术语</span>'}</div></div><p class="match-method">${escape(result.method)}</p><div class="hint-box">分数只表示本地词典术语覆盖程度，不是招聘概率或 ATS 结论。缺失术语不代表应该补写这些能力，只有实际做过才写。</div>`;
}

function renderMatch() {
	return `<section class="form-section">${sectionTitle("目标岗位 JD", '<button class="text-button" id="load-jd">载入电气岗位示例</button>')}${field("粘贴岗位职责与任职要求", "jd", draft.jd, { rows: 9, max: 20000, placeholder: "粘贴岗位说明。文本只在当前浏览器处理。" })}</section><div id="match-result"></div>`;
}

function renderDesign() {
	return `<section class="form-section">${sectionTitle("中文校招模板", "内容不变，表达有序")}<div class="template-options">${Object.entries(
		TEMPLATES,
	)
		.map(
			([key, label]) =>
				`<button class="template-choice ${draft.design.template === key ? "active" : ""}" data-template="${key}"><span class="template-mini ${key}-mini"></span><span><strong>${label}</strong><small>${key === "classic" ? "清晰单栏，优先呈现经历与技能" : key === "sidebar" ? "技能与简介放侧栏，信息层次鲜明" : "分区标题突出，适合工程与技术岗位"}</small></span></button>`,
		)
		.join("")}</div></section>
	<section class="form-section">${sectionTitle("主题颜色", "选择克制、清晰的配色")}<div class="color-options">${["#2563eb", "#1e3a5f", "#0f766e", "#7c3aed", "#414b5a"].map((color) => `<button class="color-option ${draft.design.accent === color ? "active" : ""}" data-color="${color}" style="--swatch:${color}" aria-label="主题色 ${color}"></button>`).join("")}</div>
	<label class="field">正文字号 <span id="font-size-label">${draft.design.fontSize}</span> pt<input data-bind="design.fontSize" type="range" min="8" max="14" step="0.5" value="${draft.design.fontSize}" /></label><label class="field">行距密度 <span id="density-label">${draft.design.density.toFixed(2)}</span><input data-bind="design.density" type="range" min="0.75" max="1.4" step="0.05" value="${draft.design.density}" /></label></section><div class="hint-box"><strong>先精简内容，再压缩字号。</strong><br />预览会检查内容是否超过一页。导出时会保留全部正文，不会为了“一页”悄悄裁掉内容。单栏模板通常更便于机器读取。</div>`;
}

function renderEditor() {
	const meta = TABS[currentTab];
	$("#editor-step").textContent = meta[0];
	$("#editor-title").textContent = meta[1];
	$("#editor-description").textContent = meta[2];
	$("#next-step").textContent = meta[4];
	$("#editor-content").innerHTML = {
		basics: renderBasics,
		projects: renderProjects,
		match: renderMatch,
		design: renderDesign,
	}[currentTab]();
	renderProjectReview();
	renderMatchResult();
}

function switchTab(tab, focus = false) {
	if (!Object.hasOwn(TABS, tab)) return;
	currentTab = tab;
	document.querySelectorAll("[data-tab]").forEach((button) => {
		const selected = button.dataset.tab === tab;
		button.classList.toggle("active", selected);
		if (selected) button.setAttribute("aria-current", "page");
		else button.removeAttribute("aria-current");
	});
	history.replaceState(null, "", `#${tab}`);
	renderEditor();
	if (focus) $("#editor-title").focus({ preventScroll: true });
}

function lines(value) {
	return value
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
}
function bulletList(value) {
	return `<ul class="resume-bullets">${lines(value)
		.map((line) => `<li>${escape(line)}</li>`)
		.join("")}</ul>`;
}
function resumeSection(title, body) {
	return body ? `<section class="resume-section"><h2>${title}</h2>${body}</section>` : "";
}
function itemHeading(title, period) {
	return `<div class="resume-item-heading"><strong>${escape(title)}</strong><time>${escape(period)}</time></div>`;
}

function renderPreview() {
	const basics = draft.basics;
	const contacts = [basics.location, basics.phone, basics.email, basics.website]
		.filter((value) => value.trim())
		.map((value) => `<span>${escape(value)}</span>`)
		.join("");
	const header = `<header class="resume-header"><h1 class="resume-name">${escape(basics.name || "你的姓名")}</h1>${basics.headline ? `<p class="resume-headline">${escape(basics.headline)}</p>` : ""}${contacts ? `<div class="resume-contacts">${contacts}</div>` : ""}</header>`;
	const education = resumeSection(
		"教育背景",
		draft.education
			.filter((item) => item.school.trim())
			.map(
				(item) =>
					`<div class="resume-item">${itemHeading(item.school, item.period)}<div class="resume-item-subtitle">${escape([item.major, item.degree].filter(Boolean).join(" · "))}</div>${item.details.trim() ? bulletList(item.details) : ""}</div>`,
			)
			.join(""),
	);
	const projects = resumeSection(
		"项目经历",
		getVisibleProjects(draft)
			.map((item) => {
				const facts = [
					item.context ? `项目背景：${item.context}` : "",
					item.task ? `承担任务：${item.task}` : "",
					item.action,
					item.result ? `项目结果：${item.result}` : "",
				]
					.filter(Boolean)
					.join("\n");
				return `<div class="resume-item">${itemHeading(item.name, item.period)}${item.role ? `<div class="resume-item-subtitle">${escape(item.role)}</div>` : ""}${facts ? bulletList(facts) : ""}${item.tech ? `<p class="resume-tech">技术与工具：${escape(item.tech)}</p>` : ""}</div>`;
			})
			.join(""),
	);
	const experience = resumeSection(
		"实践经历",
		draft.experience
			.filter((item) => item.company.trim())
			.map(
				(item) =>
					`<div class="resume-item">${itemHeading(item.company, item.period)}${item.role ? `<div class="resume-item-subtitle">${escape(item.role)}</div>` : ""}${item.description.trim() ? bulletList(item.description) : ""}</div>`,
			)
			.join(""),
	);
	const summary = resumeSection(
		"个人简介",
		draft.summary.trim() ? `<p class="summary-text">${escape(draft.summary).replace(/\n/g, "<br />")}</p>` : "",
	);
	const skills = resumeSection(
		"专业技能",
		draft.skills.trim() ? `<p class="resume-skills">${escape(draft.skills)}</p>` : "",
	);
	const awards = resumeSection("荣誉与证书", draft.awards.trim() ? bulletList(draft.awards) : "");
	const main = education + projects + experience;
	const side = summary + skills + awards;
	$("#resume-content").innerHTML =
		header +
		(draft.design.template === "sidebar"
			? `<div class="resume-layout"><aside class="resume-side">${side}</aside><div class="resume-main">${main}</div></div>`
			: main + skills + awards + summary);
	const paper = $("#resume-paper");
	paper.className = `resume-paper template-${draft.design.template}`;
	paper.style.setProperty("--accent", draft.design.accent);
	paper.style.setProperty("--resume-size", `${draft.design.fontSize}pt`);
	paper.style.setProperty("--resume-line", String(1.55 * draft.design.density));
	$("#template-label").textContent = TEMPLATES[draft.design.template];
	requestAnimationFrame(fitPreview);
}

function fitPreview() {
	const paper = $("#resume-paper");
	const frame = $("#paper-frame");
	const available = $(".paper-scroll").clientWidth;
	const scale = Math.min(1, available / paper.offsetWidth);
	paper.style.transform = `scale(${scale})`;
	frame.style.width = `${paper.offsetWidth * scale}px`;
	frame.style.height = `${paper.offsetHeight * scale}px`;
	pageCount = Math.max(1, Math.ceil((paper.offsetHeight - 2) / ((297 * 96) / 25.4)));
	$("#page-status").textContent = pageCount > 1 ? `A4 · 内容约 ${pageCount} 页` : "A4 · 一页内容";
	$("#page-status").classList.toggle("overflow-warning", pageCount > 1);
}

function showToast(message) {
	$("#toast").textContent = message;
	$("#toast").hidden = false;
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => {
		$("#toast").hidden = true;
	}, 4500);
}

function saveDraft() {
	clearTimeout(saveTimer);
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
		$("#save-status").innerHTML = '<i class="save-dot"></i>本地已保存';
	} catch {
		$("#save-status").textContent = "仅本次会话保存";
	}
}

function changed() {
	renderPreview();
	renderProjectReview();
	renderMatchResult();
	$("#save-status").textContent = "正在保存…";
	clearTimeout(saveTimer);
	saveTimer = setTimeout(saveDraft, 350);
}

function download(value, name, type = "application/json;charset=utf-8") {
	const url = URL.createObjectURL(
		new Blob([typeof value === "string" ? value : JSON.stringify(value, null, 2)], { type }),
	);
	const link = document.createElement("a");
	link.href = url;
	link.download = name;
	link.click();
	setTimeout(() => URL.revokeObjectURL(url), 5000);
}

$("#editor-content").addEventListener("input", (event) => {
	const input = event.target;
	if (!input.dataset.bind) return;
	const path = input.dataset.bind.split(".");
	let target = draft;
	for (const segment of path.slice(0, -1)) target = target[segment];
	const key = path.at(-1);
	target[key] = input.type === "checkbox" ? !input.checked : input.type === "range" ? Number(input.value) : input.value;
	if (input.dataset.bind === "design.fontSize") $("#font-size-label").textContent = input.value;
	if (input.dataset.bind === "design.density") $("#density-label").textContent = Number(input.value).toFixed(2);
	try {
		changed();
	} catch (failure) {
		showToast(failure.message);
	}
});

$("#editor-content").addEventListener("click", (event) => {
	const button = event.target.closest("button");
	if (!button) return;
	if (button.dataset.add) {
		const array = button.dataset.add;
		if (draft[array].length >= 100) {
			showToast("每类最多保存 100 项，请先精简内容。");
			return;
		}
		const id = crypto.randomUUID();
		const blank =
			array === "education"
				? { id, school: "", degree: "", major: "", period: "", details: "" }
				: array === "experience"
					? { id, company: "", role: "", period: "", description: "" }
					: {
							id,
							name: "",
							role: "",
							period: "",
							context: "",
							task: "",
							action: "",
							result: "",
							tech: "",
							hidden: false,
						};
		draft[array].push(blank);
		if (array === "projects") projectIndex = draft.projects.length - 1;
		renderEditor();
		changed();
	} else if (button.dataset.remove) {
		if (!confirm("移除这一项？建议先导出草稿备份。")) return;
		draft[button.dataset.remove].splice(Number(button.dataset.index), 1);
		projectIndex = Math.max(0, Math.min(projectIndex, draft.projects.length - 1));
		renderEditor();
		changed();
	} else if (button.dataset.project !== undefined) {
		projectIndex = Number(button.dataset.project);
		renderEditor();
	} else if (button.dataset.template) {
		draft.design.template = button.dataset.template;
		renderEditor();
		changed();
	} else if (button.dataset.color) {
		draft.design.accent = button.dataset.color;
		renderEditor();
		changed();
	} else if (button.id === "load-jd") {
		draft.jd =
			"【虚构岗位示例】电气工程实习生：电气工程及其自动化等相关专业；了解电力系统与继电保护基础，能够使用 MATLAB / Simulink 开展仿真；接触过 AutoCAD 电气制图，能用 Excel 整理实验数据。请仅对照自己的真实经历。";
		renderEditor();
		changed();
	}
});

document
	.querySelectorAll("[data-tab]")
	.forEach((button) => button.addEventListener("click", () => switchTab(button.dataset.tab)));
window.addEventListener("hashchange", () => {
	const tab = location.hash.slice(1);
	if (Object.hasOwn(TABS, tab)) switchTab(tab);
});
$("#next-step").addEventListener("click", () => switchTab(TABS[currentTab][3], true));
$("#fit-page").addEventListener("click", fitPreview);
window.addEventListener("resize", fitPreview);
if (typeof ResizeObserver !== "undefined") new ResizeObserver(fitPreview).observe($(".paper-scroll"));
window.addEventListener("beforeunload", saveDraft);

$("#import-button").addEventListener("click", () => {
	$("#import-limitations").innerHTML = IMPORT_LIMITATIONS.map((item) => `<p>${escape(item)}</p>`).join("");
	$("#import-dialog").showModal();
});
$("#choose-import-file").addEventListener("click", () => {
	$("#import-dialog").close();
	$("#import-file").click();
});
$("#import-file").addEventListener("change", async (event) => {
	const file = event.target.files[0];
	if (!file) return;
	try {
		if (file.size > 2 * 1024 * 1024) throw new RangeError("JSON 文件不能超过 2 MB。");
		const candidate = importResume(JSON.parse(await file.text()));
		draft = candidate;
		projectIndex = 0;
		renderEditor();
		renderPreview();
		saveDraft();
		showToast("导入完成。请检查各分区；不支持的上游字段不会被保留。");
	} catch (failure) {
		showToast(`导入未完成：${failure.message}`);
	} finally {
		event.target.value = "";
	}
});

function replaceDraft(next, message) {
	if (!confirm("这会替换当前草稿。需要保留时，请先导出数据备份。继续？")) return;
	draft = normalizeDraft(next);
	projectIndex = 0;
	switchTab("basics");
	renderPreview();
	saveDraft();
	showToast(message);
}
$("#load-demo").addEventListener("click", () =>
	replaceDraft(DEMO_RESUME, "已载入虚构演示，请不要直接当作个人经历投递。"),
);
$("#new-draft").addEventListener("click", () =>
	replaceDraft(createBlankResume(), "已新建空白简历，本地旧草稿已替换。"),
);
$("#export-data").addEventListener("click", () => $("#export-dialog").showModal());
$("#download-draft").addEventListener("click", () => {
	try {
		download(normalizeDraft(draft), "qingjian-draft.json");
		showToast("校招草稿已生成，请妥善保管。");
	} catch (failure) {
		showToast(failure.message);
	}
});
$("#download-reactive").addEventListener("click", () => {
	try {
		download(exportReactiveResume(draft), "reactive-resume-v6.json");
		showToast("已导出 Reactive Resume 数据结构，模板外观以目标编辑器为准。");
	} catch (failure) {
		showToast(failure.message);
	}
});
$("#prompt-button").addEventListener("click", () => {
	try {
		$("#ai-prompt").value = buildAiPrompt(draft);
		$("#prompt-dialog").showModal();
	} catch (failure) {
		showToast(failure.message);
	}
});
$("#copy-prompt").addEventListener("click", async () => {
	try {
		await navigator.clipboard.writeText($("#ai-prompt").value);
		showToast("提示词已复制。粘贴到外部服务前请再次检查隐私。");
	} catch {
		$("#ai-prompt").select();
		showToast("请使用 Ctrl+C 或长按复制选中的提示词。");
	}
});
$("#download-prompt").addEventListener("click", () =>
	download($("#ai-prompt").value, "qingjian-ai-prompt.txt", "text/plain;charset=utf-8"),
);
document
	.querySelectorAll("[data-close]")
	.forEach((button) => button.addEventListener("click", () => document.getElementById(button.dataset.close).close()));
$("#print-button").addEventListener("click", () => {
	fitPreview();
	$("#print-warning").textContent =
		pageCount > 1
			? `目前内容约 ${pageCount} 页。建议先精简内容或调整排版；打印时不会裁掉溢出正文。`
			: "当前预览内容在一页 A4 范围内；请以打印预览的实际分页为准。";
	$("#print-dialog").showModal();
});
$("#confirm-print").addEventListener("click", () => {
	$("#print-dialog").close();
	saveDraft();
	window.print();
});
renderEditor();
renderPreview();
switchTab(Object.hasOwn(TABS, location.hash.slice(1)) ? location.hash.slice(1) : "basics");
saveDraft();
if (!restored) showToast("当前为虚构演示内容。开始使用前，请替换为自己的真实经历。");
