package models

import "strings"

const (
	HallOfFameCompanyCategoryName    = "Thailand's Most Creative Company of the Year"
	HallOfFameCompanyImportAliasName = "Thailand's Leading Creative Company of the Year"
	HallOfFameBrandCategoryName      = "Thailand's Most Creative Brand of the Year"
	HallOfFameBrandImportAliasName   = "Thailand's Leading Creative Brand of the Year"
	HallOfFameCompanyVariant         = "hall_of_fame_company"
	HallOfFameBrandVariant           = "hall_of_fame_brand"
	HallOfFameResilienceSectionKey   = "resilience"
	HallOfFameTechnologySectionKey   = "technology"
	HallOfFameTransparencySectionKey = "transparency"
	HallOfFameOpportunitySectionKey  = "opportunity"
	HallOfFameOwnershipSectionKey    = "ownership"
)

type HallOfFameDetails struct {
	Variant            string              `json:"variant"`
	EntityLabelTh      string              `json:"entity_label_th"`
	EntityLabelEn      string              `json:"entity_label_en"`
	DescriptionLabelTh string              `json:"description_label_th"`
	DescriptionLabelEn string              `json:"description_label_en"`
	Description        string              `json:"description"`
	Sections           []HallOfFameSection `json:"sections"`
	Notes              string              `json:"notes,omitempty"`
}

type HallOfFameSection struct {
	Key     string `json:"key"`
	TitleTh string `json:"title_th"`
	TitleEn string `json:"title_en,omitempty"`
	Content string `json:"content"`
	Link    string `json:"link,omitempty"`
}

func IsHallOfFameCategoryName(name string) bool {
	switch normalizeCategoryAlias(name) {
	case normalizeCategoryAlias(HallOfFameCompanyCategoryName),
		normalizeCategoryAlias(HallOfFameCompanyImportAliasName),
		normalizeCategoryAlias(HallOfFameBrandCategoryName),
		normalizeCategoryAlias(HallOfFameBrandImportAliasName):
		return true
	default:
		return false
	}
}

func HallOfFameVariantForCategoryName(name string) string {
	switch normalizeCategoryAlias(name) {
	case normalizeCategoryAlias(HallOfFameCompanyCategoryName),
		normalizeCategoryAlias(HallOfFameCompanyImportAliasName):
		return HallOfFameCompanyVariant
	case normalizeCategoryAlias(HallOfFameBrandCategoryName),
		normalizeCategoryAlias(HallOfFameBrandImportAliasName):
		return HallOfFameBrandVariant
	default:
		return ""
	}
}

func normalizeCategoryAlias(name string) string {
	name = strings.TrimSpace(name)
	name = strings.ReplaceAll(name, "\u2019", "'")
	name = strings.ReplaceAll(name, "\u2018", "'")
	return strings.ToLower(strings.Join(strings.Fields(name), " "))
}
