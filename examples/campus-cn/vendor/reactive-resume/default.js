// Generated from Reactive Resume. Do not edit; run scripts/sync-upstream.mjs.
// Copyright (c) 2026 Amruth Pillai. MIT License; see LICENSE in this directory.
// Source: https://github.com/reactive-resume/reactive-resume/blob/19e0518eb5ea1b2c84d785bc5ea2b6d6c9d7b043/packages/schema/src/resume/default.ts
// Source SHA-256: df469f9ff6a9fcc2112ca8e370d5b6c2dc210dfc584bcce74a512f889437cc32
                                         

// ponytail: 12 identical 7-field section blocks collapsed to a helper
const section = (icon        ) => ({
	title: "",
	icon,
	columns: 1,
	hidden: false,
	showHeading: true,
	keepTogether: false,
	startOnNewPage: false,
	items: []           ,
});

export const defaultResumeData             = {
	picture: {
		hidden: false,
		fit: "cover",
		url: "",
		size: 80,
		rotation: 0,
		aspectRatio: 1,
		borderRadius: 0,
		borderColor: "rgba(0, 0, 0, 0.5)",
		borderWidth: 0,
		shadowColor: "rgba(0, 0, 0, 0.5)",
		shadowWidth: 0,
	},
	basics: {
		name: "",
		headline: "",
		email: "",
		phone: "",
		location: "",
		website: { url: "", label: "" },
		customFields: [],
	},
	summary: {
		title: "",
		icon: "article",
		columns: 1,
		hidden: false,
		showHeading: true,
		keepTogether: false,
		startOnNewPage: false,
		content: "",
	},
	sections: {
		profiles: section("messenger-logo"),
		experience: section("briefcase"),
		education: section("graduation-cap"),
		projects: section("code-simple"),
		skills: { ...section("compass-tool"), layout: "default", keywordLayout: "inline" },
		languages: section("translate"),
		interests: section("football"),
		awards: section("trophy"),
		certifications: section("certificate"),
		publications: section("books"),
		volunteer: section("hand-heart"),
		references: section("phone"),
	},
	customSections: [],
	metadata: {
		template: "onyx",
		layout: {
			sidebarWidth: 35,
			pages: [
				{
					fullWidth: false,
					main: ["profiles", "summary", "education", "experience", "projects", "volunteer", "references"],
					sidebar: ["skills", "certifications", "awards", "languages", "interests", "publications"],
				},
			],
		},
		page: {
			gapX: 4,
			gapY: 6,
			marginX: 14,
			marginY: 12,
			format: "a4",
			locale: "en-US",
			dateFormat: "short",
			hideLinkUnderline: false,
			hideIcons: false,
			hideSectionIcons: true,
		},
		design: {
			colors: {
				primary: "rgba(220, 38, 38, 1)",
				text: "rgba(0, 0, 0, 1)",
				background: "rgba(255, 255, 255, 1)",
			},
			level: {
				icon: "star",
				type: "circle",
			},
		},
		typography: {
			body: {
				fontFamily: "IBM Plex Serif",
				fontWeights: ["400", "500"],
				fontSize: 10,
				lineHeight: 1.5,
			},
			heading: {
				fontFamily: "IBM Plex Serif",
				fontWeights: ["600"],
				fontSize: 14,
				lineHeight: 1.5,
			},
		},
		notes: "",
		styleRules: [],
	},
};
