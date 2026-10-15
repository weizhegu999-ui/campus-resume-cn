import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const exampleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(exampleRoot, "../..");
const upstreamCommit = "19e0518eb5ea1b2c84d785bc5ea2b6d6c9d7b043";
const destinationRoot = path.join(exampleRoot, "vendor/reactive-resume");
const sources = [
	["packages/schema/src/resume/default.ts", "default.js"],
	["packages/pdf/src/templates/shared/filtering.ts", "filtering.js"],
];

// Read committed blobs, not a possibly edited working tree. No network is used.
function readUpstream(sourcePath) {
	return execFileSync("git", ["show", `${upstreamCommit}:${sourcePath}`], {
		cwd: repositoryRoot,
		maxBuffer: 2 * 1024 * 1024,
	});
}

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const entries = [];
const pendingFiles = [];
for (const [sourcePath, outputName] of sources) {
	const source = readUpstream(sourcePath);
	const header = [
		"// Generated from Reactive Resume. Do not edit; run scripts/sync-upstream.mjs.",
		"// Copyright (c) 2026 Amruth Pillai. MIT License; see LICENSE in this directory.",
		`// Source: https://github.com/reactive-resume/reactive-resume/blob/${upstreamCommit}/${sourcePath}`,
		`// Source SHA-256: ${sha256(source)}`,
	].join("\n");
	const stripped = stripTypeScriptTypes(source.toString("utf8"), { mode: "strip" });
	if (/\bimport\s/.test(stripped)) throw new Error(`Unexpected runtime import in ${sourcePath}`);
	const output = `${header}\n${stripped}`;
	pendingFiles.push([outputName, output]);
	entries.push({ source: sourcePath, output: outputName, sourceSha256: sha256(source), outputSha256: sha256(output) });
}

const license = readUpstream("LICENSE");
const provenance = `${JSON.stringify(
	{
		repository: "https://github.com/reactive-resume/reactive-resume",
		commit: upstreamCommit,
		transformation: "node:module stripTypeScriptTypes, mode strip; source comments retained; attribution header added",
		license: "MIT",
		licenseSha256: sha256(license),
		files: entries,
	},
	null,
	2,
)}\n`;
pendingFiles.push(["LICENSE", license], ["provenance.json", provenance]);

if (process.argv.includes("--check")) {
	for (const [outputName, content] of pendingFiles) {
		const existing = await readFile(path.join(destinationRoot, outputName));
		if (!existing.equals(Buffer.from(content))) throw new Error(`Vendor snapshot differs: ${outputName}`);
	}
	console.log(`Verified ${entries.length} vendor modules at ${upstreamCommit}.`);
} else {
	await mkdir(destinationRoot, { recursive: true });
	for (const [outputName, content] of pendingFiles) await writeFile(path.join(destinationRoot, outputName), content);
	console.log(`Generated ${entries.length} vendor modules from ${upstreamCommit}.`);
}
