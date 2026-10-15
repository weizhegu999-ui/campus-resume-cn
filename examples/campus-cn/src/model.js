import { defaultResumeData } from "../vendor/reactive-resume/default.js";
import { filterItems } from "../vendor/reactive-resume/filtering.js";

export const IMPORT_LIMITATIONS = Object.freeze([
	"仅导入联系信息、个人简介、教育、项目、实习经历、技能和荣誉字段；照片、自定义分区及其他上游内容不保留，请另存原始 JSON。",
	"富文本转为纯文本；上游模板、布局和高级格式不保留。本站模板与原版视图、分页和 PDF 外观可能不同。",
	"项目隐藏状态会保留；本编辑器没有隐藏选项的其他分区，其隐藏条目不导入，避免显示原本隐藏的内容。",
	"本编辑器生成的结构化项目描述可再次导入；其他项目描述放入“具体行动”，不会猜测职责或结果。",
]);

const MAX_ITEMS = 100;
const MAX_TEXT = 20_000;
const UNSAFE_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const TEMPLATES = new Set(["classic", "sidebar", "technical"]);
const DEFAULT_DESIGN = { template: "classic", accent: "#2563eb", fontSize: 10.5, density: 1 };

function isRecord(value) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function fail(message) {
	throw new RangeError(message);
}

// Parsed JSON still needs bounds and a key allowlist before values reach rendering code.
function preflight(input) {
	if (!isRecord(input)) fail("简历必须是 JSON 对象。");
	let nodes = 0;
	const ancestors = new Set();
	function visit(value, depth) {
		if (++nodes > 15_000 || depth > 15) fail("简历结构过大或层级过深。");
		if (typeof value === "string" && value.length > MAX_TEXT) fail("单个文本字段不能超过 20000 字符。");
		if (typeof value === "number" && !Number.isFinite(value)) fail("数值必须为有限数。");
		if (value === null || typeof value !== "object") {
			if (!["string", "number", "boolean", "undefined"].includes(typeof value) && value !== null) {
				fail("简历仅支持 JSON 数据。");
			}
			return;
		}
		if (ancestors.has(value)) fail("简历不能包含循环引用。");
		if (!Array.isArray(value) && !isRecord(value)) fail("简历中包含非法对象。");
		if (Array.isArray(value) && value.length > MAX_ITEMS) fail("每个数组最多包含 100 项。");
		const keys = Object.keys(value);
		if (!Array.isArray(value) && keys.length > 100) fail("对象字段过多。");
		ancestors.add(value);
		for (const key of keys) {
			if (UNSAFE_KEYS.has(key)) fail("简历包含不安全字段名。");
			const descriptor = Object.getOwnPropertyDescriptor(value, key);
			if (descriptor?.get || descriptor?.set) fail("简历字段必须是纯数据。");
			visit(value[key], depth + 1);
		}
		ancestors.delete(value);
	}
	visit(input, 0);
}

function record(value, label) {
	if (value === undefined) return {};
	if (!isRecord(value)) fail(`${label}必须是对象。`);
	return value;
}

function text(value, label, max = 6_000, fallback = "") {
	if (value === undefined) return fallback;
	if (typeof value !== "string" || value.length > max) fail(`${label}必须是最多 ${max} 字符的文本。`);
	return value.replace(/\r\n?/g, "\n");
}

function boolean(value, label, fallback = false) {
	if (value === undefined) return fallback;
	if (typeof value !== "boolean") fail(`${label}必须为布尔值。`);
	return value;
}

function list(value, label) {
	if (value === undefined) return [];
	if (!Array.isArray(value) || value.length > MAX_ITEMS) fail(`${label}必须为最多 100 项的数组。`);
	return value;
}

function normalizeItems(items, label, fields, extras = {}) {
	const ids = new Set();
	return list(items, label).map((value, index) => {
		const item = record(value, `${label}条目`);
		const id = text(item.id, `${label}ID`, 100, `${label}-${index + 1}`);
		if (!id.trim() || ids.has(id)) fail(`${label}ID 不能为空或重复。`);
		ids.add(id);
		return {
			id,
			...Object.fromEntries(fields.map((field) => [field, text(item[field], `${label}.${field}`)])),
			...Object.fromEntries(Object.entries(extras).map(([key, read]) => [key, read(item[key], `${label}.${key}`)])),
		};
	});
}

export function createBlankResume() {
	return {
		schemaVersion: 1,
		basics: { name: "", headline: "", email: "", phone: "", location: "", website: "" },
		summary: "",
		education: [],
		projects: [],
		experience: [],
		skills: "",
		awards: "",
		jd: "",
		design: { ...DEFAULT_DESIGN },
	};
}

export function normalizeDraft(input) {
	preflight(input);
	if (input.schemaVersion !== undefined && input.schemaVersion !== 1) fail("仅支持 schemaVersion 1。");
	const basics = record(input.basics, "联系信息");
	const design = record(input.design, "设计设置");
	const template = design.template === undefined ? DEFAULT_DESIGN.template : design.template;
	const accent = design.accent === undefined ? DEFAULT_DESIGN.accent : design.accent;
	const fontSize = design.fontSize === undefined ? DEFAULT_DESIGN.fontSize : design.fontSize;
	const density = design.density === undefined ? DEFAULT_DESIGN.density : design.density;
	if (!TEMPLATES.has(template)) fail("模板必须为 classic、sidebar 或 technical。");
	if (typeof accent !== "string" || !/^#[0-9a-f]{6}$/i.test(accent)) fail("主题色必须是六位十六进制颜色。");
	if (typeof fontSize !== "number" || !Number.isFinite(fontSize) || fontSize < 8 || fontSize > 14) {
		fail("正文字号必须在 8 到 14 pt 之间。");
	}
	if (typeof density !== "number" || !Number.isFinite(density) || density < 0.75 || density > 1.4) {
		fail("行距密度必须在 0.75 到 1.4 之间。");
	}
	const skills = text(input.skills, "技能");
	const awards = text(input.awards, "荣誉与证书");
	if (skills.split("\n").length > MAX_ITEMS || awards.split("\n").length > MAX_ITEMS) {
		fail("技能与荣誉字段各最多 100 行。");
	}
	return {
		schemaVersion: 1,
		basics: {
			name: text(basics.name, "姓名", 200),
			headline: text(basics.headline, "求职意向", 500),
			email: text(basics.email, "邮箱", 320),
			phone: text(basics.phone, "电话", 100),
			location: text(basics.location, "城市", 300),
			website: text(basics.website, "个人链接", 2_048),
		},
		summary: text(input.summary, "个人简介"),
		education: normalizeItems(input.education, "education", ["school", "degree", "major", "period", "details"]),
		projects: normalizeItems(
			input.projects,
			"projects",
			["name", "role", "period", "context", "task", "action", "result", "tech"],
			{ hidden: boolean },
		),
		experience: normalizeItems(input.experience, "experience", ["company", "role", "period", "description"]),
		skills,
		awards,
		jd: text(input.jd, "岗位描述", MAX_TEXT),
		design: { template, accent: accent.toLowerCase(), fontSize, density },
	};
}

export const DEMO_RESUME = normalizeDraft({
	schemaVersion: 1,
	basics: {
		name: "林同学",
		headline: "电气工程及其自动化 · 校招演示",
		email: "student@example.com",
		phone: "",
		location: "示例城市",
		website: "",
	},
	summary:
		"本简历为虚构演示，学校、经历与成果均为示例。关注电力系统分析、继电保护与工程计算，希望通过清晰的技术过程展示自己的学习与验证能力。",
	education: [
		{
			id: "demo-education-1",
			school: "示例大学",
			degree: "本科（虚构示例）",
			major: "电气工程及其自动化",
			period: "2022.09—2026.06",
			details: "示例课程：电路、电机学、电力系统分析、继电保护。\n实际使用时仅保留本人修读且能够解释的内容。",
		},
	],
	projects: [
		{
			id: "demo-project-1",
			name: "继电保护暂态仿真实验（虚构示例）",
			role: "仿真与结果分析",
			period: "2025.09—2025.12",
			context: "在教学用单机无穷大系统中观察故障前后的电压、电流变化。",
			task: "搭建故障场景，比较方向元件在不同故障位置的判据。",
			action: "建立电源、变压器和线路模型，设置故障位置与持续时间。\n整理相量参考方向，复核保护动作逻辑并记录波形。",
			result: "形成场景参数表、波形对比和判据说明；所有结果仅用于教学示例。",
			tech: "MATLAB/Simulink、相量分析、继电保护",
			hidden: false,
		},
		{
			id: "demo-project-2",
			name: "电气工程计算与知识自测工具（虚构示例）",
			role: "页面与计算逻辑开发",
			period: "2026.03—2026.05",
			context: "将课堂常用公式整理为可交互的学习工具。",
			task: "完成三相功率计算、单位检查与计算过程展示。",
			action: "拆分输入校验和纯计算函数，用边界样例核对公式及单位。",
			result: "输出带适用条件的计算报告，并保留复核记录；不用于实际保护整定。",
			tech: "JavaScript、HTML、CSS、Git",
			hidden: false,
		},
	],
	experience: [],
	skills:
		"专业基础：电路分析、电力系统分析、继电保护\n工具示例：MATLAB/Simulink、AutoCAD、Git\n技能表述请根据本人实际能力修改。",
	awards: "荣誉、竞赛与证书请填写本人真实经历；本例不虚构奖项。",
	jd: "电气工程相关专业；理解电力系统与继电保护基础；能够使用 MATLAB/Simulink 进行仿真；重视文档编写、结果验证与团队沟通。",
	design: DEFAULT_DESIGN,
});

export function getVisibleProjects(input) {
	const draft = normalizeDraft(input);
	return filterItems(draft.projects, "projects");
}

export function getResumeText(input) {
	const draft = normalizeDraft(input);
	return [
		...Object.values(draft.basics),
		draft.summary,
		...draft.education.flatMap(({ school, degree, major, period, details }) => [
			school,
			degree,
			major,
			period,
			details,
		]),
		...filterItems(draft.projects, "projects").flatMap(
			({ name, role, period, context, task, action, result, tech }) => [
				name,
				role,
				period,
				context,
				task,
				action,
				result,
				tech,
			],
		),
		...draft.experience.flatMap(({ company, role, period, description }) => [company, role, period, description]),
		draft.skills,
		draft.awards,
	]
		.filter((part) => part.trim())
		.join("\n");
}

function escapeHtml(value) {
	return value.replace(
		/[&<>"']/g,
		(character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
	);
}

function htmlText(value) {
	return escapeHtml(value).replace(/\n/g, "<br>");
}

function paragraph(value) {
	return value ? `<p>${htmlText(value)}</p>` : "";
}

function plainText(value) {
	const source = text(value, "上游富文本", MAX_TEXT);
	return source
		.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
		.replace(/<!--[\s\S]*?-->/g, "")
		.replace(/<br\s*\/?\s*>/gi, "\n")
		.replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
		.replace(/<[^>]*>/g, "")
		.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, code) => {
			const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
			if (!code.startsWith("#")) return named[code.toLowerCase()] ?? entity;
			const value = code[1].toLowerCase() === "x" ? Number.parseInt(code.slice(2), 16) : Number(code.slice(1));
			return value > 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff)
				? String.fromCodePoint(value)
				: "�";
		})
		.trim();
}

const PROJECT_LABELS = {
	role: "项目角色",
	context: "项目背景",
	task: "承担任务",
	action: "具体行动",
	result: "实际结果",
	tech: "技术工具",
};

function projectDescription(project) {
	return Object.entries(PROJECT_LABELS)
		.filter(([field]) => project[field])
		.map(([field, label]) => `<p><strong>${label}：</strong>${htmlText(project[field])}</p>`)
		.join("");
}

function readProjectDescription(description) {
	const result = Object.fromEntries(Object.keys(PROJECT_LABELS).map((field) => [field, ""]));
	const labelFields = new Map(Object.entries(PROJECT_LABELS).map(([field, label]) => [label, field]));
	const blocks = [
		...description.matchAll(
			/<p><strong>(项目角色|项目背景|承担任务|具体行动|实际结果|技术工具)：<\/strong>([\s\S]*?)<\/p>/g,
		),
	];
	const recognized = blocks.length > 0 && blocks.map((match) => match[0]).join("") === description;
	if (recognized) {
		for (const match of blocks) result[labelFields.get(match[1])] = plainText(match[2]);
	} else {
		result.action = plainText(description);
	}
	return result;
}

const emptyWebsite = () => ({ url: "", label: "", inlineLink: false });
const rawDates = (period) => ({ start: null, end: null, present: false, ...(period ? { raw: period } : {}) });

export function exportReactiveResume(input) {
	const draft = normalizeDraft(input);
	const data = structuredClone(defaultResumeData);
	data.picture.hidden = true;
	data.basics = { ...draft.basics, website: { url: draft.basics.website, label: "" }, customFields: [] };
	data.summary.title = "个人简介";
	data.summary.content = paragraph(draft.summary);
	const titles = {
		education: "教育背景",
		projects: "项目经历",
		experience: "实习与实践",
		skills: "专业技能",
		awards: "荣誉与证书",
	};
	for (const [id, title] of Object.entries(titles)) data.sections[id].title = title;
	data.sections.education.items = draft.education.map((item) => ({
		id: item.id,
		hidden: false,
		school: item.school,
		degree: item.degree,
		area: item.major,
		grade: "",
		location: "",
		period: item.period,
		dates: rawDates(item.period),
		website: emptyWebsite(),
		description: paragraph(item.details),
	}));
	data.sections.projects.items = draft.projects.map((item) => ({
		id: item.id,
		hidden: item.hidden,
		name: item.name,
		period: item.period,
		dates: rawDates(item.period),
		website: emptyWebsite(),
		description: projectDescription(item),
	}));
	data.sections.experience.items = draft.experience.map((item) => ({
		id: item.id,
		hidden: false,
		company: item.company,
		position: item.role,
		location: "",
		period: item.period,
		dates: rawDates(item.period),
		website: emptyWebsite(),
		description: paragraph(item.description),
		roles: [],
	}));
	data.sections.skills.items = draft.skills
		.split("\n")
		.filter((line) => line.trim())
		.map((name, index) => ({
			id: `skill-${index + 1}`,
			hidden: false,
			icon: "",
			iconColor: "",
			name,
			proficiency: "",
			level: 0,
			keywords: [],
		}));
	data.sections.awards.items = draft.awards
		.split("\n")
		.filter((line) => line.trim())
		.map((title, index) => ({
			id: `award-${index + 1}`,
			hidden: false,
			title,
			awarder: "",
			date: "",
			dates: rawDates(""),
			website: emptyWebsite(),
			description: "",
		}));
	const isSidebar = draft.design.template === "sidebar";
	data.metadata.layout.pages = [
		{
			fullWidth: !isSidebar,
			main: ["summary", "education", "projects", "experience", ...(!isSidebar ? ["skills", "awards"] : [])],
			sidebar: isSidebar ? ["skills", "awards"] : [],
		},
	];
	data.metadata.page.locale = "zh-CN";
	data.metadata.page.format = "a4";
	data.metadata.typography.body.fontSize = draft.design.fontSize;
	data.metadata.typography.body.lineHeight = 1.4 * draft.design.density;
	const rgb = draft.design.accent
		.slice(1)
		.match(/../g)
		.map((channel) => Number.parseInt(channel, 16));
	data.metadata.design.colors.primary = `rgba(${rgb.join(", ")}, 1)`;
	return data;
}

function foreignSection(data, id) {
	const sections = record(data.sections, "上游分区");
	const section = record(sections[id], `上游 ${id}`);
	const hidden = boolean(section.hidden, `上游 ${id} 隐藏状态`);
	const items = list(section.items, `上游 ${id}`).map((item) => record(item, `上游 ${id} 条目`));
	return { hidden, items };
}

function foreignId(item, prefix, index) {
	return text(item.id, "上游条目 ID", 100, `${prefix}-${index + 1}`);
}

function foreignWebsite(value) {
	if (value === undefined) return "";
	return text(record(value, "上游链接").url, "上游链接 URL", 2_048);
}

export function importResume(input) {
	preflight(input);
	if (!Object.hasOwn(input, "sections") && !Object.hasOwn(input, "metadata")) return normalizeDraft(input);
	const draft = createBlankResume();
	const basics = record(input.basics, "上游联系信息");
	for (const field of ["name", "headline", "email", "phone", "location"])
		draft.basics[field] = text(basics[field], field);
	draft.basics.website = foreignWebsite(basics.website);
	const summary = record(input.summary, "上游简介");
	draft.summary = boolean(summary.hidden, "上游简介隐藏状态") ? "" : plainText(summary.content);
	const education = foreignSection(input, "education");
	draft.education = (education.hidden ? [] : education.items)
		.filter((item) => !boolean(item.hidden, "教育隐藏状态"))
		.map((item, index) => ({
			id: foreignId(item, "education", index),
			school: text(item.school, "学校"),
			degree: text(item.degree, "学历"),
			major: text(item.area, "专业"),
			period: text(item.period, "教育时间"),
			details: plainText(item.description),
		}));
	const projects = foreignSection(input, "projects");
	draft.projects = projects.items.map((item, index) => ({
		id: foreignId(item, "project", index),
		name: text(item.name, "项目名称"),
		period: text(item.period, "项目时间"),
		...readProjectDescription(text(item.description, "项目描述", MAX_TEXT)),
		hidden: projects.hidden || boolean(item.hidden, "项目隐藏状态"),
	}));
	const experience = foreignSection(input, "experience");
	draft.experience = (experience.hidden ? [] : experience.items)
		.filter((item) => !boolean(item.hidden, "经历隐藏状态"))
		.map((item, index) => ({
			id: foreignId(item, "experience", index),
			company: text(item.company, "公司"),
			role: text(item.position, "岗位"),
			period: text(item.period, "经历时间"),
			description: plainText(item.description),
		}));
	const skills = foreignSection(input, "skills");
	draft.skills = (skills.hidden ? [] : skills.items)
		.filter((item) => !boolean(item.hidden, "技能隐藏状态"))
		.map((item) =>
			[
				text(item.name, "技能名"),
				text(item.proficiency, "熟练度"),
				...list(item.keywords, "技能关键词").map((keyword) => text(keyword, "技能关键词")),
			]
				.filter((part) => part.trim())
				.join(" · "),
		)
		.join("\n");
	const awards = foreignSection(input, "awards");
	draft.awards = (awards.hidden ? [] : awards.items)
		.filter((item) => !boolean(item.hidden, "荣誉隐藏状态"))
		.map((item) =>
			[
				text(item.title, "荣誉名"),
				text(item.awarder, "颁发方"),
				text(item.date, "荣誉日期"),
				plainText(item.description),
			]
				.filter((part) => part.trim())
				.join(" · "),
		)
		.join("\n");
	return normalizeDraft(draft);
}
