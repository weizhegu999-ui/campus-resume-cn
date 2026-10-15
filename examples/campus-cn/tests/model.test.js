import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	DEMO_RESUME,
	IMPORT_LIMITATIONS,
	createBlankResume,
	normalizeDraft,
	importResume,
	exportReactiveResume,
	getResumeText,
	getVisibleProjects,
} from "../src/model.js";
import { defaultResumeData } from "../vendor/reactive-resume/default.js";

test("blank drafts are accepted, isolated and contain only declared campus fields", () => {
	const first = createBlankResume();
	const second = normalizeDraft({});
	assert.deepEqual(first, second);
	first.basics.name = "changed";
	first.design.accent = "#ffffff";
	assert.equal(second.basics.name, "");
	assert.equal(second.design.accent, "#2563eb");
	const input = { basics: { name: "林同学" }, upstreamBase: { privateNote: "not retained" } };
	const result = normalizeDraft(input);
	assert.equal(result.basics.name, "林同学");
	assert.equal(Object.hasOwn(result, "upstreamBase"), false);
	assert.deepEqual(
		Object.keys(result).sort(),
		[
			"schemaVersion",
			"basics",
			"summary",
			"education",
			"projects",
			"experience",
			"skills",
			"awards",
			"jd",
			"design",
		].sort(),
	);
});

test("sample identifies fictional education and projects and uses safe example contacts", () => {
	assert.equal(DEMO_RESUME.basics.name, "林同学");
	assert.equal(DEMO_RESUME.education[0].school, "示例大学");
	assert.equal(DEMO_RESUME.basics.phone, "");
	assert.equal(DEMO_RESUME.basics.email, "student@example.com");
	assert.match(DEMO_RESUME.summary, /虚构演示/);
});

test("normalization preserves CJK, Unicode and multiline content without mutating input", () => {
	const input = { basics: { name: "林同学⚡" }, summary: "故障分析\r\n相量复核\r波形对比" };
	const draft = normalizeDraft(input);
	assert.equal(draft.basics.name, "林同学⚡");
	assert.equal(draft.summary, "故障分析\n相量复核\n波形对比");
	assert.equal(input.summary, "故障分析\r\n相量复核\r波形对比");
});

test("upstream filterItems hides hidden and untitled projects", () => {
	const draft = normalizeDraft(DEMO_RESUME);
	draft.projects[0].hidden = true;
	draft.projects.push({ ...draft.projects[1], id: "untitled", name: "   ", action: "not visible" });
	const visible = getVisibleProjects(draft);
	assert.deepEqual(
		visible.map((item) => item.id),
		["demo-project-2"],
	);
	assert.equal(draft.projects.length, 3);
	visible[0].name = "changed copy";
	assert.notEqual(draft.projects[1].name, "changed copy");
});

test("searchable resume text excludes the JD, hidden projects and untitled projects", () => {
	const draft = normalizeDraft(DEMO_RESUME);
	draft.jd = "UNIQUE_JD_ONLY_KEYWORD";
	draft.projects[0].hidden = true;
	draft.projects[0].action = "UNIQUE_HIDDEN_KEYWORD";
	draft.projects.push({ ...draft.projects[1], id: "empty-name", name: "", action: "UNIQUE_UNTITLED_KEYWORD" });
	const content = getResumeText(draft);
	assert.match(content, /林同学/);
	assert.match(content, /电气工程/);
	assert.doesNotMatch(content, /UNIQUE_/);
});

test("Reactive export retains the complete default top-level, section and metadata structure", () => {
	const data = exportReactiveResume(DEMO_RESUME);
	assert.deepEqual(Object.keys(data).sort(), Object.keys(defaultResumeData).sort());
	assert.deepEqual(Object.keys(data.sections).sort(), Object.keys(defaultResumeData.sections).sort());
	for (const [sectionId, section] of Object.entries(defaultResumeData.sections)) {
		for (const key of Object.keys(section))
			assert.ok(Object.hasOwn(data.sections[sectionId], key), `${sectionId}.${key}`);
	}
	for (const [group, values] of Object.entries(defaultResumeData.metadata)) {
		assert.ok(Object.hasOwn(data.metadata, group), group);
		if (values && typeof values === "object" && !Array.isArray(values)) {
			for (const key of Object.keys(values)) assert.ok(Object.hasOwn(data.metadata[group], key), `${group}.${key}`);
		}
	}
	assert.equal(data.metadata.template, "onyx");
	assert.equal(data.metadata.page.locale, "zh-CN");
	assert.equal(data.picture.hidden, true);
	assert.equal(data.basics.website.url, "");
	assert.deepEqual(data.customSections, []);
	assert.equal(Object.hasOwn(data, "upstreamBase"), false);
	assert.equal(defaultResumeData.basics.name, "");
});

test("exported supported items have required v6 data fields, types and dates", () => {
	const draft = normalizeDraft(DEMO_RESUME);
	draft.experience.push({
		id: "practice",
		company: "示例单位",
		role: "课程实践",
		period: "2025.06—2025.07",
		description: "虚构实践",
	});
	const data = exportReactiveResume(draft);
	const required = {
		education: ["id", "hidden", "school", "degree", "area", "grade", "location", "period", "website", "description"],
		projects: ["id", "hidden", "name", "period", "website", "description"],
		experience: ["id", "hidden", "company", "position", "location", "period", "website", "description", "roles"],
		skills: ["id", "hidden", "icon", "iconColor", "name", "proficiency", "level", "keywords"],
		awards: ["id", "hidden", "title", "awarder", "date", "website", "description"],
	};
	for (const [sectionId, fields] of Object.entries(required)) {
		assert.ok(data.sections[sectionId].items.length > 0);
		for (const item of data.sections[sectionId].items) {
			for (const field of fields) assert.ok(Object.hasOwn(item, field), `${sectionId}.${field}`);
			if (item.website) assert.deepEqual(Object.keys(item.website).sort(), ["inlineLink", "label", "url"]);
			if (item.dates) {
				assert.equal(item.dates.start, null);
				assert.equal(item.dates.end, null);
				assert.equal(item.dates.present, false);
			}
		}
	}
});

test("supported campus content round-trips through Reactive JSON, including CJK and project newlines", () => {
	const draft = normalizeDraft(DEMO_RESUME);
	draft.projects[1].hidden = true;
	draft.projects[0].context = "输入 <220V> & 输出\n相量：Î = 10∠30°";
	const imported = importResume(JSON.parse(JSON.stringify(exportReactiveResume(draft))));
	for (const field of ["basics", "summary", "education", "projects", "experience", "skills", "awards"]) {
		assert.deepEqual(imported[field], draft[field], field);
	}
	assert.equal(imported.jd, "");
	assert.deepEqual(imported.design, createBlankResume().design);
});

test("draft JSON import returns a detached normalized draft", () => {
	const copy = importResume(JSON.parse(JSON.stringify(DEMO_RESUME)));
	assert.deepEqual(copy, DEMO_RESUME);
	copy.projects[0].action = "edited";
	assert.notEqual(copy.projects[0].action, DEMO_RESUME.projects[0].action);
});

test("foreign descriptions are converted to text; external hidden facts stay hidden or omitted", () => {
	const data = exportReactiveResume(DEMO_RESUME);
	data.summary.hidden = true;
	data.sections.education.items[0].hidden = true;
	data.sections.projects.hidden = true;
	data.sections.projects.items[0].description = "<p>保护动作<br>结果验证 &amp; 复核</p>";
	const imported = importResume(data);
	assert.equal(imported.summary, "");
	assert.deepEqual(imported.education, []);
	assert.ok(imported.projects.every((item) => item.hidden));
	assert.equal(imported.projects[0].action, "保护动作\n结果验证 & 复核");
	assert.deepEqual(getVisibleProjects(imported), []);
	assert.ok(IMPORT_LIMITATIONS.some((message) => message.includes("隐藏")));
});

test("untrusted text stays pure data and is escaped on rich-text export", () => {
	const payload =
		'<img src=x onerror="globalThis.__campusInjected = 1"><script>globalThis.__campusInjected = 2</script>';
	const draft = normalizeDraft({ summary: payload, projects: [{ id: "x", name: "测试", action: payload }] });
	assert.equal(draft.summary, payload);
	assert.equal(globalThis.__campusInjected, undefined);
	const data = exportReactiveResume(draft);
	assert.doesNotMatch(data.summary.content, /<img|<script/);
	assert.match(data.summary.content, /&lt;img/);
	assert.equal(importResume(data).summary, payload);
	data.summary.content = "<p>可信文字</p><script>globalThis.__campusInjected = 3</script><img src=x onerror=alert(1)>";
	assert.equal(importResume(data).summary, "可信文字");
	assert.equal(globalThis.__campusInjected, undefined);
});

test("invalid roots, excessive strings/arrays and illegal item types throw RangeError", () => {
	for (const input of [
		null,
		[],
		"resume",
		1,
		true,
		new Date(),
		{ schemaVersion: 2 },
		{ basics: [] },
		{ summary: "x".repeat(20_001) },
		{ summary: "x".repeat(6_001) },
		{ projects: Array.from({ length: 101 }, () => ({})) },
		{ projects: [null] },
		{ projects: [{ hidden: "false" }] },
		{ skills: "line\n".repeat(101) },
		{ education: [{ id: "same" }, { id: "same" }] },
	]) {
		assert.throws(() => normalizeDraft(input), RangeError);
	}
});

test("invalid design values throw instead of becoming CSS or silently falling back", () => {
	for (const design of [
		null,
		[],
		{ template: "<script>" },
		{ template: null },
		{ accent: "red" },
		{ accent: "#fff; background:url(x)" },
		{ accent: null },
		{ fontSize: 99 },
		{ fontSize: "10" },
		{ fontSize: Number.NaN },
		{ fontSize: null },
		{ density: 0 },
		{ density: Infinity },
		{ density: null },
	]) {
		assert.throws(() => normalizeDraft({ design }), RangeError);
	}
});

test("prototype pollution, accessors and cyclic objects are rejected before values are read", () => {
	for (const json of [
		'{"__proto__":{"polluted":true}}',
		'{"basics":{"constructor":{"prototype":{"polluted":true}}}}',
	]) {
		assert.throws(() => importResume(JSON.parse(json)), RangeError);
	}
	let getterWasRead = false;
	const accessor = Object.defineProperty({}, "summary", {
		enumerable: true,
		get() {
			getterWasRead = true;
			return "bad";
		},
	});
	assert.throws(() => normalizeDraft(accessor), RangeError);
	assert.equal(getterWasRead, false);
	const cyclic = {};
	cyclic.self = cyclic;
	assert.throws(() => normalizeDraft(cyclic), RangeError);
	assert.equal({}.polluted, undefined);
});

test("vendor module hashes match their fixed upstream provenance", async () => {
	const root = new URL("../vendor/reactive-resume/", import.meta.url);
	const provenance = JSON.parse(await readFile(new URL("provenance.json", root), "utf8"));
	assert.equal(provenance.commit, "19e0518eb5ea1b2c84d785bc5ea2b6d6c9d7b043");
	assert.equal(provenance.files.length, 2);
	for (const file of provenance.files) {
		const content = await readFile(new URL(file.output, root));
		assert.equal(createHash("sha256").update(content).digest("hex"), file.outputSha256);
		assert.match(content.toString("utf8"), /Copyright \(c\) 2026 Amruth Pillai/);
	}
	const license = await readFile(new URL("LICENSE", root));
	assert.equal(createHash("sha256").update(license).digest("hex"), provenance.licenseSha256);
});
