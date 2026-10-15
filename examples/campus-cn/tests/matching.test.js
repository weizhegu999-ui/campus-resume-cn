import assert from "node:assert/strict";
import test from "node:test";
import { buildAiPrompt, buildProjectBullet, matchJob, reviewProject } from "../src/matching.js";

const keys = (items) => items.map((item) => item.key);

test("aliases are normalized, deduplicated and explainable", () => {
	const result = matchJob(
		"使用 AutoCAD、JavaScript、NodeJS、可编程控制器",
		"CAD AutoCAD JS JavaScript Node.js PLC PLC",
	);
	assert.equal(result.score, 100);
	assert.deepEqual(keys(result.requirements), ["autocad", "plc", "javascript", "node"]);
	assert.ok(result.matched.find((item) => item.key === "javascript").aliases.includes("JS"));
	assert.match(result.method, /不是录用概率或 ATS 评分/u);
});

test("electrical and frontend dictionary covers specific requirements", () => {
	const jd =
		"电气工程专业，继电保护，变电所，电力系统仿真，MATLAB Simulink PSCAD ETAP Excel 通讯，前端 TS React Python SQL";
	const result = matchJob(
		"电气工程 继电保护 变电站 电力系统仿真 MATLAB Simulink PSCAD ETAP Excel 通信 前端 TypeScript React Python MySQL",
		jd,
	);
	assert.equal(result.score, 100);
	assert.ok(result.requirements.length >= 16);
});

test("English word boundaries do not confuse JavaScript, CAD or Reactive", () => {
	const result = matchJob("JavaScript CAD Reactive node_modules PostgreSQL", "Java C React Node SQL");
	assert.deepEqual(keys(result.matched), ["sql"]);
	assert.deepEqual(keys(result.missing), ["react", "node", "java", "c"]);
	assert.equal(matchJob("PSCAD", "CAD").score, 0);
	assert.equal(matchJob("C++ C#", "C").score, 0);
});

test("resume negations are not evidence of a skill", () => {
	const result = matchJob(
		"未使用 MATLAB 和 Simulink；不会Python；SQL不熟悉；没有使用过 CAD。熟悉 React",
		"MATLAB Simulink Python SQL CAD React",
	);
	assert.deepEqual(keys(result.matched), ["react"]);
	assert.equal(result.score, 17);
});

test("JD negations are excluded and contrasting positives remain", () => {
	const result = matchJob("MATLAB，React", "不要求CAD和Python；无需SQL；不会 React 但要求 MATLAB。React 不要求");
	assert.deepEqual(keys(result.requirements), ["matlab"]);
	assert.equal(result.score, 100);
	assert.equal(matchJob("Python", "不要求 Python").score, null);
});

test("English negation and later positive evidence are recognized", () => {
	assert.equal(matchJob("No Python experience; never used MATLAB; without SQL", "Python MATLAB SQL").score, 0);
	assert.equal(matchJob("Python", "Python is not required").score, null);
	assert.equal(matchJob("不会 Python 但会 MATLAB", "MATLAB").score, 100);
	assert.equal(matchJob("No Python experience but proficient in MATLAB", "MATLAB").score, 100);
	assert.equal(matchJob("not only Python but also MATLAB", "Python MATLAB").score, 100);
	assert.equal(matchJob("未使用 MATLAB；随后使用 MATLAB 完成实验", "MATLAB").score, 100);
});

test("empty and unrecognized JD do not invent a score", () => {
	const empty = matchJob("MATLAB", "  ");
	assert.equal(empty.score, null);
	assert.equal(empty.hasJobText, false);
	assert.match(empty.method, /尚未填写/u);
	const unknown = matchJob("MATLAB", "有责任心，积极认真，热爱生活");
	assert.equal(unknown.score, null);
	assert.equal(unknown.hasJobText, true);
	assert.match(unknown.method, /未识别/u);
	assert.equal(matchJob("", "MATLAB").score, 0);
});

test("inputs reject unexpected types and excessive text with useful RangeError", () => {
	for (const invalid of [null, undefined, 4, {}, []]) {
		assert.throws(() => matchJob(invalid, "MATLAB"), { name: "RangeError", message: /简历文本/u });
		assert.throws(() => matchJob("", invalid), { name: "RangeError", message: /岗位 JD/u });
	}
	assert.throws(() => matchJob("x".repeat(20001), ""), { name: "RangeError", message: /20000/u });
	assert.throws(() => matchJob("", "x".repeat(20001)), RangeError);
	assert.equal(matchJob("x".repeat(20000), "").score, null);
});

test("project composition includes only provided fact fields", () => {
	assert.equal(
		buildProjectBullet({ name: "课程设计", action: "搭建三相模型", result: "得到故障波形", tech: ["Simulink"] }),
		"实施：搭建三相模型；结果：得到故障波形；技术：Simulink",
	);
	assert.equal(buildProjectBullet({}), "");
	assert.equal(buildProjectBullet(null), "");
	const bullet = buildProjectBullet({ task: "检查电路", action: "使用示波器测量" });
	assert.doesNotMatch(bullet, /30|MATLAB|提升|准确率/u);
});

test("project review is limited, actionable and does not demand invented numbers", () => {
	const missing = reviewProject({});
	assert.ok(missing.length <= 4);
	assert.ok(missing.some((item) => /具体任务/u.test(item.detail)));
	assert.ok(missing.some((item) => /不必强行量化/u.test(item.detail)));
	const vague = reviewProject({ context: "课程设计", task: "验证保护", action: "精通保护技术", result: "性能提升30%" });
	assert.ok(vague.some((item) => /能力描述/u.test(item.title)));
	assert.ok(vague.some((item) => /量化结论/u.test(item.title)));
	assert.ok(vague.every((item) => ["tip", "warning"].includes(item.severity)));
	const complete = reviewProject({
		context: "课程设计",
		task: "验证保护",
		action: "搭建模型并观察波形",
		result: "完成报告并解释动作现象",
	});
	assert.deepEqual(complete, []);
});

test("AI prompt is a factual prompt with explicit missing-information and privacy guidance", () => {
	const prompt = buildAiPrompt({
		basics: { name: "PRIVATE_NAME", email: "secret@example.test", phone: "PRIVATE_PHONE" },
		projects: [
			{ name: "继电保护课程设计", action: "搭建保护模型", tech: ["Simulink"], secret: "PRIVATE_EXTRA_FIELD" },
			{ name: "PRIVATE_HIDDEN_PROJECT", hidden: true },
		],
		skills: [{ name: "MATLAB", private: "PRIVATE_SKILL_FIELD" }, "AutoCAD"],
		jd: "电气工程，熟悉 CAD",
	});
	assert.match(prompt, /不得编造/u);
	assert.match(prompt, /缺失信息先列出具体问题/u);
	assert.match(prompt, /发送到外部 AI 前，请自行检查/u);
	assert.match(prompt, /搭建保护模型/u);
	assert.match(prompt, /MATLAB/u);
	assert.match(prompt, /电气工程/u);
	assert.doesNotMatch(prompt, /PRIVATE_|secret@example/u);
	assert.throws(() => buildAiPrompt({ jd: "x".repeat(20001) }), RangeError);
});
