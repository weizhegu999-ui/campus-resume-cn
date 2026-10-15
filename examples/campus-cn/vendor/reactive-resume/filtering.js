// Generated from Reactive Resume. Do not edit; run scripts/sync-upstream.mjs.
// Copyright (c) 2026 Amruth Pillai. MIT License; see LICENSE in this directory.
// Source: https://github.com/reactive-resume/reactive-resume/blob/19e0518eb5ea1b2c84d785bc5ea2b6d6c9d7b043/packages/pdf/src/templates/shared/filtering.ts
// Source SHA-256: a44e1c21f528893fca7ba49ff60999cb99b65842cf98bcff49f46d4d5e634226
                                                                                      

                   
	                
	                       
  

                                                                                     

                                                           
	                
	           
  

                                            
	           
	              
  

                       
	                                             
	                                                   
	                                    
  

const primaryTitleFields = {
	profiles: "network",
	experience: "company",
	education: "school",
	projects: "name",
	skills: "name",
	languages: "language",
	interests: "name",
	awards: "title",
	certifications: "title",
	publications: "title",
	volunteer: "organization",
	references: "name",
}                                                 ;

const isItemSection = (section         )                             => {
	return typeof section === "object" && section !== null && "items" in section;
};

const isSummarySection = (section         )                     => {
	return typeof section === "object" && section !== null && "content" in section;
};

const hasText = (value         )                  => {
	return typeof value === "string" && value.trim().length > 0;
};

const getPrimaryTitleField = (sectionType         )                     => {
	return primaryTitleFields[sectionType                          ];
};

const hasValidPrimaryTitle = (item            , sectionType         )          => {
	const titleField = getPrimaryTitleField(sectionType);

	if (!titleField) return true;

	return hasText((item                           )[titleField]);
};

const hasVisibleExperienceRole = (role         )          => {
	return typeof role === "object" && role !== null && hasText((role                          ).position);
};

const filterExperienceRoles =                       (item   , sectionType         )    => {
	if (sectionType !== "experience") return item;

	const roles = (item                       ).roles;

	if (!Array.isArray(roles)) return item;

	const visibleRoles = roles.filter(hasVisibleExperienceRole);
	const position = (item                          ).position;
	const repeatsRole = hasText(position) && visibleRoles.some((role) => role.position.trim() === position.trim());

	if (visibleRoles.length === roles.length && !repeatsRole) return item;

	return { ...item, roles: visibleRoles, ...(repeatsRole ? { position: "" } : {}) }     ;
};

export const filterItems =                       (items     , sectionType         )      => {
	const visibleItems      = [];

	for (const item of items) {
		if (item.hidden || !hasValidPrimaryTitle(item, sectionType)) continue;
		visibleItems.push(filterExperienceRoles(item, sectionType));
	}

	return visibleItems;
};

export const hasVisibleItems = (section                 , sectionType         )          => {
	return !section.hidden && filterItems(section.items, sectionType).length > 0;
};

export const isVisibleSummary = (summary                                     )          => {
	return !summary.hidden && summary.content.trim().length > 0;
};

const getSectionForFiltering = (sectionId        , data                ) => {
	if (sectionId === "summary") return data.summary;

	return data.sections[sectionId] ?? data.customSections.find((section) => section.id === sectionId);
};

const getSectionTypeForFiltering = (sectionId        , section         )                     => {
	if (sectionId === "summary") return "summary";

	if (typeof section === "object" && section !== null && "type" in section) {
		const type = (section                      ).type;

		if (typeof type === "string") return type;
	}

	return sectionId;
};

export const isSectionVisible = (sectionId        , data                )          => {
	const section = getSectionForFiltering(sectionId, data);
	const sectionType = getSectionTypeForFiltering(sectionId, section);

	if (!section) return false;
	if (isSummarySection(section)) return isVisibleSummary(section);
	if (isItemSection(section)) return hasVisibleItems(section, sectionType);

	return false;
};

export const filterSections = (sectionIds          , data                )           => {
	return sectionIds.filter((sectionId) => isSectionVisible(sectionId, data));
};
