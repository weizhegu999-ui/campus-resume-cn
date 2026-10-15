# Third-party notices

This example is a Chinese campus-recruitment extension developed inside a source checkout of [Reactive Resume](https://github.com/reactive-resume/reactive-resume). It is not an official Reactive Resume release.

## Reactive Resume code actually reused

Upstream commit: `19e0518eb5ea1b2c84d785bc5ea2b6d6c9d7b043`.

Copyright (c) 2026 Amruth Pillai. Licensed under the MIT License. The complete upstream license is retained at [`vendor/reactive-resume/LICENSE`](vendor/reactive-resume/LICENSE) and the repository root.

| Upstream source                                                                                                                                                                                     | Browser module                        | Runtime use                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------- |
| [`packages/schema/src/resume/default.ts`](https://github.com/reactive-resume/reactive-resume/blob/19e0518eb5ea1b2c84d785bc5ea2b6d6c9d7b043/packages/schema/src/resume/default.ts)                   | `vendor/reactive-resume/default.js`   | Complete default data used as the base of Reactive Resume JSON exports.     |
| [`packages/pdf/src/templates/shared/filtering.ts`](https://github.com/reactive-resume/reactive-resume/blob/19e0518eb5ea1b2c84d785bc5ea2b6d6c9d7b043/packages/pdf/src/templates/shared/filtering.ts) | `vendor/reactive-resume/filtering.js` | `filterItems` filters hidden projects and projects without a primary title. |

`scripts/sync-upstream.mjs` reads these exact Git blobs and uses Node.js `stripTypeScriptTypes` in strip mode. It removes TypeScript-only syntax, retains source comments, and adds source/attribution headers. No application logic is rewritten. `provenance.json` records the fixed upstream commit, source SHA-256 values, generated SHA-256 values, and license SHA-256. Run `node scripts/sync-upstream.mjs --check` to verify the snapshot without modifying files. Node.js 24 is recommended.

## Added implementation and compatibility scope

The campus draft model, Chinese templates, browser HTML preview, print styling, editing flows, job-description matching, and writing suggestions are extension code. They do not use the original React/Forme renderer or its PDF pagination. Browser printing may differ from the original application.

Reactive Resume v6 JSON export starts from the complete upstream default object. It fills supported contact, education, project, experience, skill, and award fields, while retaining required defaults. Three campus preview templates map to an upstream-supported `onyx` template plus compatible layout metadata; their appearance is not reproduced in the original editor.

Import is a documented subset, not a lossless editor for arbitrary upstream documents. Unsupported picture, custom fields, custom sections, profile links, languages, interests, certifications, publications, volunteer, reference, cover-letter content, advanced formatting, and source layout settings are not retained in campus drafts. Hidden projects remain hidden. Hidden entries in sections without a campus visibility field are omitted to avoid revealing them on import. Rich descriptions become plain text; generated structured project descriptions are recognized when imported again. Original JSON should be kept separately when these fields matter. The code exports `IMPORT_LIMITATIONS` for the interface to display.

Campus JSON contains only its declared draft fields. It does not embed an original resume, private sidecar, or `upstreamBase` payload. The included electrical-engineering resume is explicitly fictional and contains no personal phone number.
