package services

import (
	"context"
	"fmt"
	"strings"

	"creativexvoting/backend/internal/models"
	"creativexvoting/backend/internal/repositories"
	"creativexvoting/backend/internal/utils"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	demoAdminUsername    = "admin"
	demoAdminPassword    = "admin123"
	demoAdminDisplayName = "CreativeEx System Admin"
	demoJudgePassword    = "judge123"
)

var demoSeedNamespace = uuid.MustParse("80d57efd-047a-4b2f-9dd9-4c7c8ca9e96a")

type demoCategoryGroup string

const (
	demoGroupCity     demoCategoryGroup = "city"
	demoGroupBusiness demoCategoryGroup = "business"
	demoGroupSocial   demoCategoryGroup = "social"
)

type demoProjectSeed struct {
	Slug             string
	Title            string
	ShortDescription string
	ConceptFocus     string
	DesignerName     string
	TeamName         string
}

type demoCategorySeed struct {
	Code                string
	Slug                string
	Name                string
	Group               demoCategoryGroup
	Description         string
	JudgeUsername       string
	JudgeDisplayName    string
	CreativeFocus       string
	ExecutionFocus      string
	ImpactFocus         string
	SustainabilityFocus string
	Projects            []demoProjectSeed
}

type demoCriterionSeed struct {
	Slug         string
	Name         string
	Description  string
	MaxScore     int
	DisplayOrder int
}

type DemoSeedService struct {
	pool     *pgxpool.Pool
	authRepo *repositories.AuthRepository
}

func NewDemoSeedService(pool *pgxpool.Pool, authRepo *repositories.AuthRepository) *DemoSeedService {
	return &DemoSeedService{
		pool:     pool,
		authRepo: authRepo,
	}
}

func (s *DemoSeedService) Seed(ctx context.Context) error {
	adminPasswordHash, err := utils.HashPassword(demoAdminPassword)
	if err != nil {
		return err
	}

	if err := s.authRepo.UpsertAdmin(ctx, models.User{
		ID:           deterministicSeedID("user:" + demoAdminUsername),
		Username:     demoAdminUsername,
		DisplayName:  demoAdminDisplayName,
		PasswordHash: adminPasswordHash,
		Role:         models.RoleAdmin,
		IsActive:     true,
	}); err != nil {
		return err
	}

	judgePasswordHash, err := utils.HashPassword(demoJudgePassword)
	if err != nil {
		return err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for _, category := range demoCategories {
		categoryID, err := upsertCategorySeed(ctx, tx, category)
		if err != nil {
			return err
		}

		for _, criterion := range criteriaForCategory(category) {
			if err := upsertCriterionSeed(ctx, tx, categoryID, category.Slug, criterion); err != nil {
				return err
			}
		}

		judgeID, err := upsertJudgeSeed(ctx, tx, category, judgePasswordHash)
		if err != nil {
			return err
		}

		if err := replaceJudgeAssignment(ctx, tx, judgeID, categoryID); err != nil {
			return err
		}

		for _, project := range category.Projects {
			if err := upsertProjectSeed(ctx, tx, category, categoryID, project); err != nil {
				return err
			}
		}
	}

	return tx.Commit(ctx)
}

func deterministicSeedID(key string) string {
	return uuid.NewSHA1(demoSeedNamespace, []byte(key)).String()
}

func criteriaForCategory(category demoCategorySeed) []demoCriterionSeed {
	switch category.Group {
	case demoGroupCity:
		return []demoCriterionSeed{
			{
				Slug:         "creative-interpretation",
				Name:         "Creative interpretation",
				Description:  scoreBandDescription(category.CreativeFocus),
				MaxScore:     25,
				DisplayOrder: 1,
			},
			{
				Slug:         "execution-in-place",
				Name:         "Execution in place",
				Description:  scoreBandDescription(category.ExecutionFocus),
				MaxScore:     25,
				DisplayOrder: 2,
			},
			{
				Slug:         "district-impact",
				Name:         "Measurable district impact",
				Description:  scoreBandDescription(category.ImpactFocus),
				MaxScore:     30,
				DisplayOrder: 3,
			},
			{
				Slug:         "continuity",
				Name:         "Partnerships and continuity",
				Description:  scoreBandDescription(category.SustainabilityFocus),
				MaxScore:     20,
				DisplayOrder: 4,
			},
		}
	case demoGroupBusiness:
		return []demoCriterionSeed{
			{
				Slug:         "creative-strategy",
				Name:         "Creative strategy",
				Description:  scoreBandDescription(category.CreativeFocus),
				MaxScore:     25,
				DisplayOrder: 1,
			},
			{
				Slug:         "execution-delivery",
				Name:         "Execution and delivery",
				Description:  scoreBandDescription(category.ExecutionFocus),
				MaxScore:     25,
				DisplayOrder: 2,
			},
			{
				Slug:         "business-impact",
				Name:         "Measurable business impact",
				Description:  scoreBandDescription(category.ImpactFocus),
				MaxScore:     30,
				DisplayOrder: 3,
			},
			{
				Slug:         "scale-sustainability",
				Name:         "Scalability and sustainability",
				Description:  scoreBandDescription(category.SustainabilityFocus),
				MaxScore:     20,
				DisplayOrder: 4,
			},
		}
	default:
		return []demoCriterionSeed{
			{
				Slug:         "creative-social-approach",
				Name:         "Creative social approach",
				Description:  scoreBandDescription(category.CreativeFocus),
				MaxScore:     25,
				DisplayOrder: 1,
			},
			{
				Slug:         "positive-impact",
				Name:         "Measurable positive impact",
				Description:  scoreBandDescription(category.ImpactFocus),
				MaxScore:     30,
				DisplayOrder: 2,
			},
			{
				Slug:         "accessible-implementation",
				Name:         "Accessible implementation",
				Description:  scoreBandDescription(category.ExecutionFocus),
				MaxScore:     25,
				DisplayOrder: 3,
			},
			{
				Slug:         "long-term-continuity",
				Name:         "Long-term continuity",
				Description:  scoreBandDescription(category.SustainabilityFocus),
				MaxScore:     20,
				DisplayOrder: 4,
			},
		}
	}
}

func scoreBandDescription(focus string) string {
	return fmt.Sprintf(
		"High scores reward work that %s. Mid scores are for work with a clear idea but uneven proof or incomplete delivery. Low scores are for work that stays generic, lightly evidenced, or weakly connected to the category intent.",
		focus,
	)
}

func upsertCategorySeed(ctx context.Context, tx pgx.Tx, category demoCategorySeed) (string, error) {
	id := deterministicSeedID("category:" + category.Slug)
	var persistedID string
	err := tx.QueryRow(ctx, `
		INSERT INTO categories (id, name, description, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, TRUE, NOW(), NOW())
		ON CONFLICT (id) DO UPDATE
		SET name = EXCLUDED.name,
			description = EXCLUDED.description,
			is_active = TRUE,
			updated_at = NOW()
		RETURNING id
	`, id, category.Name, category.Description).Scan(&persistedID)
	return persistedID, err
}

func upsertCriterionSeed(ctx context.Context, tx pgx.Tx, categoryID string, categorySlug string, criterion demoCriterionSeed) error {
	id := deterministicSeedID("criterion:" + categorySlug + ":" + criterion.Slug)
	_, err := tx.Exec(ctx, `
		INSERT INTO scoring_criteria (
			id, category_id, name, description, max_score, display_order, is_active, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW(), NOW())
		ON CONFLICT (id) DO UPDATE
		SET category_id = EXCLUDED.category_id,
			name = EXCLUDED.name,
			description = EXCLUDED.description,
			max_score = EXCLUDED.max_score,
			display_order = EXCLUDED.display_order,
			is_active = TRUE,
			updated_at = NOW()
	`, id, categoryID, criterion.Name, criterion.Description, criterion.MaxScore, criterion.DisplayOrder)
	return err
}

func upsertJudgeSeed(ctx context.Context, tx pgx.Tx, category demoCategorySeed, passwordHash string) (string, error) {
	id := deterministicSeedID("user:" + category.JudgeUsername)
	var persistedID string
	err := tx.QueryRow(ctx, `
		INSERT INTO users (id, username, password_hash, display_name, role, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, 'judge', TRUE, NOW(), NOW())
		ON CONFLICT (username) DO UPDATE
		SET password_hash = EXCLUDED.password_hash,
			display_name = EXCLUDED.display_name,
			role = 'judge',
			is_active = TRUE,
			updated_at = NOW()
		RETURNING id
	`, id, category.JudgeUsername, passwordHash, category.JudgeDisplayName).Scan(&persistedID)
	return persistedID, err
}

func replaceJudgeAssignment(ctx context.Context, tx pgx.Tx, judgeID string, categoryID string) error {
	if _, err := tx.Exec(ctx, `DELETE FROM judge_category_assignments WHERE judge_id = $1`, judgeID); err != nil {
		return err
	}

	_, err := tx.Exec(ctx, `
		INSERT INTO judge_category_assignments (id, judge_id, category_id, created_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (judge_id, category_id) DO NOTHING
	`, deterministicSeedID("assignment:"+judgeID+":"+categoryID), judgeID, categoryID)
	return err
}

func upsertProjectSeed(ctx context.Context, tx pgx.Tx, category demoCategorySeed, categoryID string, project demoProjectSeed) error {
	projectID := deterministicSeedID("project:" + category.Slug + ":" + project.Slug)
	projectPath := fmt.Sprintf("%s/%s", category.Slug, project.Slug)
	fullDescription := fmt.Sprintf(
		"%s This seeded project demonstrates how %s can be evaluated inside the %s workflow. The concept package is intentionally detailed enough for judges to review summary copy, supporting links, and rubric alignment without needing real client data.",
		project.ShortDescription,
		strings.ToLower(project.ConceptFocus),
		category.Name,
	)
	extraDetails := fmt.Sprintf(
		"Seeded demo content for %s. Judges should look for fit against the %s criteria, evidence quality, stakeholder value, and how convincingly the team could scale or sustain the idea.",
		category.Code,
		category.Name,
	)

	_, err := tx.Exec(ctx, `
		INSERT INTO projects (
			id, category_id, title, short_description, full_description, concept, designer_name, team_name,
			image_url, proposal_link, social_media_link, drive_link, attached_file_link, extra_details,
			is_active, created_at, updated_at
		)
		VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8,
			$9, $10, $11, $12, $13, $14,
			TRUE, NOW(), NOW()
		)
		ON CONFLICT (id) DO UPDATE
		SET category_id = EXCLUDED.category_id,
			title = EXCLUDED.title,
			short_description = EXCLUDED.short_description,
			full_description = EXCLUDED.full_description,
			concept = EXCLUDED.concept,
			designer_name = EXCLUDED.designer_name,
			team_name = EXCLUDED.team_name,
			image_url = EXCLUDED.image_url,
			proposal_link = EXCLUDED.proposal_link,
			social_media_link = EXCLUDED.social_media_link,
			drive_link = EXCLUDED.drive_link,
			attached_file_link = EXCLUDED.attached_file_link,
			extra_details = EXCLUDED.extra_details,
			is_active = TRUE,
			updated_at = NOW()
	`, projectID, categoryID, project.Title, project.ShortDescription, fullDescription, project.ConceptFocus,
		project.DesignerName, project.TeamName,
		fmt.Sprintf("https://picsum.photos/seed/%s/1200/800", projectPath),
		fmt.Sprintf("https://example.com/%s/proposal", projectPath),
		fmt.Sprintf("https://example.com/%s/story", projectPath),
		fmt.Sprintf("https://example.com/%s/drive", projectPath),
		fmt.Sprintf("https://example.com/%s/appendix.pdf", projectPath),
		extraDetails,
	)
	return err
}

var demoCategories = []demoCategorySeed{
	{
		Code:                "1.1",
		Slug:                "creative-city-festival",
		Name:                "Creative City Festival Award",
		Group:               demoGroupCity,
		Description:         "Honors festivals and place-based creative programs that reinterpret local culture, food, art, and everyday identity into memorable public experiences with visible district impact.",
		JudgeUsername:       "judge-city-festival",
		JudgeDisplayName:    "Judge 1.1 Festival",
		CreativeFocus:       "reinterprets local culture, food, art, or rituals into a festival experience that feels unmistakably rooted in the place",
		ExecutionFocus:      "was delivered as a coherent on-ground event with strong visitor flow, communication touchpoints, and visible activation",
		ImpactFocus:         "creates measurable value for nearby communities through footfall, local income, tourism, or renewed civic pride",
		SustainabilityFocus: "builds local partnerships and repeatable operating practices that can keep the festival alive beyond a single edition",
		Projects: []demoProjectSeed{
			{Slug: "river-stories", Title: "River Stories Festival Week", ShortDescription: "A seven-day riverfront program turning local folklore, food boats, and live craft into a nighttime cultural circuit.", ConceptFocus: "waterfront heritage into a repeatable cultural tourism engine", DesignerName: "Nara Theeranon", TeamName: "River Commons Collective"},
			{Slug: "market-after-dark", Title: "Market After Dark", ShortDescription: "A creative night market that remaps an aging municipal market into food, performance, and maker zones for younger audiences.", ConceptFocus: "traditional commerce into a cross-generational festival destination", DesignerName: "Pimrada S.", TeamName: "Lantern District Lab"},
			{Slug: "alley-of-taste", Title: "Alley of Taste Festival", ShortDescription: "A lane-scale food and sound festival designed to spotlight neighborhood recipes, street music, and walkable urban discovery.", ConceptFocus: "culinary identity into a compact, high-frequency visitor experience", DesignerName: "Chawin Kul", TeamName: "Old Quarter Activation Office"},
		},
	},
	{
		Code:                "1.2",
		Slug:                "creative-city-branding",
		Name:                "Creative City Branding Award",
		Group:               demoGroupCity,
		Description:         "Recognizes cities or districts that turn local identity into a clear, memorable, and widely adopted place brand across physical and digital touchpoints.",
		JudgeUsername:       "judge-city-branding",
		JudgeDisplayName:    "Judge 1.2 Branding",
		CreativeFocus:       "turns local identity into a distinctive and memorable positioning that feels both authentic and contemporary",
		ExecutionFocus:      "applies the brand consistently across real spaces, wayfinding, communications, and visitor touchpoints",
		ImpactFocus:         "improves recall, visitation, local participation, or market perception with evidence beyond visual polish alone",
		SustainabilityFocus: "can be maintained by public and private partners over time without losing clarity or relevance",
		Projects: []demoProjectSeed{
			{Slug: "loom-district", Title: "Loom District Identity System", ShortDescription: "A woven-material inspired identity refresh for a textile neighborhood, spanning signage, maps, and merchant kits.", ConceptFocus: "craft heritage into a modern district brand system", DesignerName: "Rinlada V.", TeamName: "Threadline Studio"},
			{Slug: "salt-town", Title: "Salt Town Wayfinding Refresh", ShortDescription: "A coastal destination branding program connecting salt farms, museums, and dining clusters through one shared citymark.", ConceptFocus: "a fragmented visitor journey into a unified coastal identity", DesignerName: "Kornpat Lee", TeamName: "Harbor Brand Office"},
			{Slug: "lantern-coast", Title: "Lantern Coast Citymark Program", ShortDescription: "A place-brand toolkit for a seaside town that brings seasonal festivals, public transport, and local businesses under one narrative.", ConceptFocus: "seasonal tourism into a year-round place identity", DesignerName: "Sirima T.", TeamName: "Blue Mile Creative"},
		},
	},
	{
		Code:                "1.3",
		Slug:                "creative-city-policy",
		Name:                "Creative City Policy Award",
		Group:               demoGroupCity,
		Description:         "Celebrates policies, plans, or public-private programs that turn creative economy strategy into practical city-level action with lasting quality-of-life benefits.",
		JudgeUsername:       "judge-city-policy",
		JudgeDisplayName:    "Judge 1.3 Policy",
		CreativeFocus:       "uses policy or planning in an original way to unlock creative-economy growth, cultural value, or better urban outcomes",
		ExecutionFocus:      "moves beyond a policy memo into funded programs, incentives, regulations, or measurable public delivery",
		ImpactFocus:         "shows meaningful benefits for jobs, access, local business growth, or neighborhood quality of life",
		SustainabilityFocus: "creates governance, ownership, and budget structures that can survive leadership or funding changes",
		Projects: []demoProjectSeed{
			{Slug: "night-economy", Title: "Night Economy Creative Zone Policy", ShortDescription: "A city policy package that pilots extended opening hours, cultural permits, and small-business grants for a nightlife district.", ConceptFocus: "regulatory reform into a safer and more creative local economy", DesignerName: "Thanakrit P.", TeamName: "City Futures Office"},
			{Slug: "maker-permit", Title: "Maker Permit Fast Track", ShortDescription: "A municipal simplification project that shortens licensing and pop-up approval for local makers, food startups, and cultural operators.", ConceptFocus: "bureaucratic friction into a pro-creator civic service", DesignerName: "Sasima R.", TeamName: "Urban Service Lab"},
			{Slug: "heritage-lease", Title: "Adaptive Heritage Lease Program", ShortDescription: "A public-private leasing framework inviting creative tenants into underused historic buildings with social-use requirements.", ConceptFocus: "heritage preservation into creative-enterprise infrastructure", DesignerName: "Pawat N.", TeamName: "Civic Design Unit"},
		},
	},
	{
		Code:                "1.4",
		Slug:                "creative-city-regeneration",
		Name:                "Creative City Regeneration Award",
		Group:               demoGroupCity,
		Description:         "Rewards regeneration projects that revive neglected places through creative reuse, stronger local identity, and renewed economic or social life.",
		JudgeUsername:       "judge-city-regeneration",
		JudgeDisplayName:    "Judge 1.4 Regeneration",
		CreativeFocus:       "reimagines a neglected or underused place through a compelling blend of heritage, design, and new urban activity",
		ExecutionFocus:      "translates the regeneration vision into visible spatial improvements, usable programming, and real public access",
		ImpactFocus:         "revives local economic activity, neighborhood use, perception, or safety in ways people can actually feel and measure",
		SustainabilityFocus: "has stewardship and operating models that protect the place from slipping back into disuse",
		Projects: []demoProjectSeed{
			{Slug: "mill-yard", Title: "Mill Yard Revival", ShortDescription: "An abandoned rice mill compound transformed into workshops, rehearsal rooms, and weekend public space for local vendors.", ConceptFocus: "industrial heritage into a flexible community creative campus", DesignerName: "Nutchanon C.", TeamName: "Mill Yard Consortium"},
			{Slug: "station-loop", Title: "Station Loop Commons", ShortDescription: "A rail-edge regeneration effort reconnecting vacant land to commuters through food kiosks, shade structures, and modular event zones.", ConceptFocus: "mobility leftovers into daily-use civic space", DesignerName: "Patcharaporn W.", TeamName: "Loop District Lab"},
			{Slug: "warehouse-garden", Title: "Warehouse Garden Exchange", ShortDescription: "A derelict storage row reopened as a creative marketplace and learning garden with after-school programming.", ConceptFocus: "dead frontage into mixed-use neighborhood activity", DesignerName: "Akarin M.", TeamName: "Common Roof Studio"},
		},
	},
	{
		Code:                "1.5",
		Slug:                "creative-city-collaboration",
		Name:                "Creative City Collaboration Award",
		Group:               demoGroupCity,
		Description:         "Highlights collaborations that align government, communities, and private partners to build stronger creative districts through shared ownership and delivery.",
		JudgeUsername:       "judge-city-collaboration",
		JudgeDisplayName:    "Judge 1.5 Collaboration",
		CreativeFocus:       "uses collaboration itself as a creative mechanism to unlock stronger district outcomes than any one actor could deliver alone",
		ExecutionFocus:      "has a clear operating model for coordinating public, private, and community roles in real delivery",
		ImpactFocus:         "creates visible benefits for the district through broader participation, stronger services, or better economic opportunity",
		SustainabilityFocus: "makes collaboration durable through shared governance, incentives, and trust-building routines",
		Projects: []demoProjectSeed{
			{Slug: "canal-pact", Title: "Canal Creative Pact", ShortDescription: "A three-sector partnership uniting residents, landlords, and city agencies to co-program a canal-side creative district.", ConceptFocus: "shared stewardship into a practical district growth engine", DesignerName: "Warisara D.", TeamName: "Canal Pact Office"},
			{Slug: "school-street", Title: "School Street Weekend Alliance", ShortDescription: "A rotating street-closure and vendor model co-run by schools, local shops, and cultural groups to test family-friendly public space.", ConceptFocus: "temporary urbanism into long-term community trust", DesignerName: "Thanat J.", TeamName: "Open Street Network"},
			{Slug: "makers-corridor", Title: "Makers Corridor Partnership", ShortDescription: "A district collaboration connecting municipal land, private sponsors, and maker groups to launch a shared fabrication corridor.", ConceptFocus: "institutional alignment into maker-economy infrastructure", DesignerName: "Maliwan K.", TeamName: "Corridor Creative Board"},
		},
	},
	{
		Code:                "2.1",
		Slug:                "creative-ip",
		Name:                "Creative IP Award",
		Group:               demoGroupBusiness,
		Description:         "Recognizes intellectual property, characters, worlds, and original ideas that are translated into distinctive products, services, or brand ecosystems.",
		JudgeUsername:       "judge-creative-ip",
		JudgeDisplayName:    "Judge 2.1 IP",
		CreativeFocus:       "builds an original character, narrative world, or creative asset with a strong point of view and strong recall",
		ExecutionFocus:      "turns the intellectual property into well-crafted products, experiences, or brand assets that people can actually engage with",
		ImpactFocus:         "demonstrates traction through audience growth, licensing, merchandise, partnerships, or repeat demand",
		SustainabilityFocus: "shows how the intellectual property can expand across formats, channels, or future revenue streams without losing clarity",
		Projects: []demoProjectSeed{
			{Slug: "forest-familiars", Title: "Forest Familiars Universe", ShortDescription: "An original cast of conservation-themed characters extended into books, toys, and location-based family workshops.", ConceptFocus: "story-led intellectual property into a multi-format audience ecosystem", DesignerName: "Yanin P.", TeamName: "Wild Ink Studio"},
			{Slug: "metro-monsters", Title: "Metro Monsters", ShortDescription: "A commuter-culture character brand that transforms transit frustrations into collectible humor and retail collaborations.", ConceptFocus: "daily urban behavior into commercially flexible character IP", DesignerName: "Kanda L.", TeamName: "Platform Friends Co."},
			{Slug: "siam-sky-archive", Title: "Siam Sky Archive", ShortDescription: "A retrofuturist storytelling world combining animation shorts, apparel, and live exhibitions inspired by Thai aviation myths.", ConceptFocus: "cultural references into ownable entertainment IP", DesignerName: "Phuripat S.", TeamName: "Archive Orbit House"},
		},
	},
	{
		Code:                "2.2",
		Slug:                "creative-transformation",
		Name:                "Creative Transformation Award",
		Group:               demoGroupBusiness,
		Description:         "Honors organizations using creativity to transform products, services, internal operations, or customer journeys in ways that unlock new value.",
		JudgeUsername:       "judge-transformation",
		JudgeDisplayName:    "Judge 2.2 Transformation",
		CreativeFocus:       "reframes a business challenge through a new creative model rather than a minor optimization or cosmetic refresh",
		ExecutionFocus:      "converts the new model into improved products, services, processes, or employee-facing systems people really use",
		ImpactFocus:         "produces measurable gains in efficiency, customer value, retention, or new revenue opportunity",
		SustainabilityFocus: "can be adopted across teams or markets with clear ownership, training, and repeatability",
		Projects: []demoProjectSeed{
			{Slug: "rural-banking", Title: "Rural Banking Service Reset", ShortDescription: "A branch and digital service redesign that turns paperwork-heavy lending into a guided visual journey for micro-entrepreneurs.", ConceptFocus: "service design into trust-building operational change", DesignerName: "Atthaya B.", TeamName: "Northbank Transformation Lab"},
			{Slug: "clinic-care-path", Title: "Clinic Care Path Redesign", ShortDescription: "A patient-experience overhaul using visual triage, calmer waiting environments, and adaptive follow-up communication.", ConceptFocus: "healthcare friction into a more humane service system", DesignerName: "Ploypailin T.", TeamName: "Care Pattern Studio"},
			{Slug: "factory-floor", Title: "Factory Floor Learning Loop", ShortDescription: "A creative upskilling program that retools factory training through storytelling, peer feedback, and visual operating boards.", ConceptFocus: "workforce transformation into daily continuous learning", DesignerName: "Jetrin O.", TeamName: "Motion Works Team"},
		},
	},
	{
		Code:                "2.3",
		Slug:                "creative-data",
		Name:                "Creative Data Award",
		Group:               demoGroupBusiness,
		Description:         "Celebrates teams that turn data into clearer strategy, smarter services, and better decisions through creative interpretation and practical application.",
		JudgeUsername:       "judge-data",
		JudgeDisplayName:    "Judge 2.3 Data",
		CreativeFocus:       "uses data in a fresh way to uncover insights, shape decisions, or create new value beyond standard reporting",
		ExecutionFocus:      "connects data collection, interpretation, and action through workflows that teams can actually use",
		ImpactFocus:         "improves decision quality, service performance, customer outcomes, or commercial results with evidence",
		SustainabilityFocus: "keeps the data practice durable through governance, literacy, and ongoing operational ownership",
		Projects: []demoProjectSeed{
			{Slug: "retail-signal", Title: "Retail Signal Studio", ShortDescription: "A visual decision room that helps a multi-branch retailer turn footfall, weather, and basket data into weekly merchandising actions.", ConceptFocus: "messy operational data into faster commercial decisions", DesignerName: "Nisakorn H.", TeamName: "Signal Room Collective"},
			{Slug: "mobility-lens", Title: "Mobility Lens Dashboard", ShortDescription: "A district transport intelligence tool combining sensor data and rider interviews to redesign drop-off and walkability patterns.", ConceptFocus: "urban data into clearer mobility interventions", DesignerName: "Rattana U.", TeamName: "Transit Clarity Lab"},
			{Slug: "student-risk-map", Title: "Student Risk Map", ShortDescription: "A cross-campus insight platform that spots disengagement patterns early and helps advisors intervene before drop-off escalates.", ConceptFocus: "education analytics into actionable human support", DesignerName: "Tarin G.", TeamName: "Pattern Insight Unit"},
		},
	},
	{
		Code:                "2.4",
		Slug:                "creative-campaign",
		Name:                "Creative Campaign Award",
		Group:               demoGroupBusiness,
		Description:         "Rewards creative campaigns that combine sharp insight, strong execution, and measurable communication or commercial outcomes.",
		JudgeUsername:       "judge-campaign",
		JudgeDisplayName:    "Judge 2.4 Campaign",
		CreativeFocus:       "builds a memorable campaign idea that truly connects with audience motivations rather than just broadcasting brand messages",
		ExecutionFocus:      "delivers the campaign coherently across channels, formats, and audience touchpoints with strong craft and relevance",
		ImpactFocus:         "drives measurable lift in attention, engagement, demand, or conversion rather than soft awareness alone",
		SustainabilityFocus: "can extend into longer-term brand equity, community participation, or future campaign systems",
		Projects: []demoProjectSeed{
			{Slug: "sleepless-city", Title: "Sleepless City Stories", ShortDescription: "A late-night hospitality campaign built around the voices of shift workers, drivers, and food vendors who keep the city moving.", ConceptFocus: "audience empathy into a culturally resonant campaign platform", DesignerName: "Krittika N.", TeamName: "Third Shift Creative"},
			{Slug: "repair-before-replace", Title: "Repair Before Replace", ShortDescription: "A consumer electronics campaign that reframes repair as aspirational through creator content, pop-up clinics, and service bundles.", ConceptFocus: "sustainability messaging into desirable mass communication", DesignerName: "Panupong F.", TeamName: "Circuit Narrative Lab"},
			{Slug: "tea-house-warmth", Title: "Tea House Warmth", ShortDescription: "A seasonal beverage campaign pairing community storytelling with localized menus, short films, and neighborhood collaborations.", ConceptFocus: "brand storytelling into high-participation local activation", DesignerName: "Mookda C.", TeamName: "Warmth House Studio"},
		},
	},
	{
		Code:                "2.5",
		Slug:                "creative-commerce",
		Name:                "Creative Commerce Award",
		Group:               demoGroupBusiness,
		Description:         "Recognizes commercial strategy that uses creativity to improve purchasing journeys, conversion, retail experience, or cross-channel sales performance.",
		JudgeUsername:       "judge-commerce",
		JudgeDisplayName:    "Judge 2.5 Commerce",
		CreativeFocus:       "reimagines how customers discover, compare, choose, or purchase in a way that feels genuinely better",
		ExecutionFocus:      "connects platforms, content, merchandising, and fulfillment into a smooth real-world buying journey",
		ImpactFocus:         "drives clear gains in conversion, basket size, repeat purchase, or customer satisfaction",
		SustainabilityFocus: "can keep growing without breaking the customer experience, operational economics, or brand coherence",
		Projects: []demoProjectSeed{
			{Slug: "farm-to-feed", Title: "Farm to Feed Checkout Flow", ShortDescription: "A grocery-commerce redesign that bundles regional produce stories, subscriptions, and faster reorder moments into one path.", ConceptFocus: "food storytelling into a stronger conversion engine", DesignerName: "Thidarat Y.", TeamName: "Fresh Basket Lab"},
			{Slug: "artisan-live-sell", Title: "Artisan Live Sell Network", ShortDescription: "A live-commerce format that equips craft sellers with scripts, modular sets, and post-show conversion journeys.", ConceptFocus: "micro-merchant sales into a more repeatable commerce system", DesignerName: "Napat S.", TeamName: "Craft Commerce Studio"},
			{Slug: "home-demo-cart", Title: "Home Demo Cart", ShortDescription: "A furniture brand commerce pilot that combines room-visualization, flexible sampling, and concierge checkout for hesitant buyers.", ConceptFocus: "high-consideration retail into a lower-friction buying experience", DesignerName: "Waranya E.", TeamName: "Living Grid Co."},
		},
	},
	{
		Code:                "3.1",
		Slug:                "creative-inclusivity",
		Name:                "Creative Inclusivity Award",
		Group:               demoGroupSocial,
		Description:         "Honors creative work that helps overlooked or excluded groups participate more fully in services, culture, work, or public life.",
		JudgeUsername:       "judge-inclusivity",
		JudgeDisplayName:    "Judge 3.1 Inclusivity",
		CreativeFocus:       "designs a new way for excluded groups to access and meaningfully participate rather than only being symbolically invited",
		ExecutionFocus:      "removes barriers in the actual service, experience, or delivery model so the intended group can really use it",
		ImpactFocus:         "improves access, participation, confidence, or life outcomes for the target group with evidence",
		SustainabilityFocus: "can keep serving people over time through community ownership, partnerships, or financially workable operations",
		Projects: []demoProjectSeed{
			{Slug: "silent-stage", Title: "Silent Stage Access Kit", ShortDescription: "A performance toolkit that makes neighborhood events more usable for Deaf audiences through captioning, vibration cues, and front-of-house training.", ConceptFocus: "event inclusion into a practical cultural access standard", DesignerName: "Sirintra B.", TeamName: "Open Signal Arts"},
			{Slug: "market-guide", Title: "Market Guide Companions", ShortDescription: "A volunteer-and-toolkit service helping older adults and first-time migrants navigate fresh markets, pricing, and digital payments.", ConceptFocus: "daily commerce barriers into a supported participation model", DesignerName: "Peerapat T.", TeamName: "Common Cart Network"},
			{Slug: "youth-open-mic", Title: "Youth Open Mic Passport", ShortDescription: "A rotating creative stage program giving underserved teens mentorship, transport stipends, and low-risk entry into public performance.", ConceptFocus: "cultural access into long-term confidence and expression", DesignerName: "Nicha A.", TeamName: "Mic For All Collective"},
		},
	},
	{
		Code:                "3.2",
		Slug:                "creative-wellbeing",
		Name:                "Creative Well-Being Award",
		Group:               demoGroupSocial,
		Description:         "Celebrates products, services, or programs that use creativity to improve physical, mental, or social well-being in meaningful ways.",
		JudgeUsername:       "judge-wellbeing",
		JudgeDisplayName:    "Judge 3.2 Well-Being",
		CreativeFocus:       "uses creativity to make healthier behavior, care access, or emotional support feel more inviting and more human",
		ExecutionFocus:      "works well in real use with thoughtful service design, accessibility, and consistent delivery",
		ImpactFocus:         "shows clear gains in well-being, participation, recovery, or quality of life for the intended audience",
		SustainabilityFocus: "can continue delivering benefits through trained partners, repeatable operations, or community adoption",
		Projects: []demoProjectSeed{
			{Slug: "park-breathing", Title: "Park Breathing Circuit", ShortDescription: "A public-space well-being program blending guided movement, ambient sound, and neighborhood facilitation for stressed urban workers.", ConceptFocus: "routine wellness into a low-barrier civic ritual", DesignerName: "Rinraya M.", TeamName: "Breath Commons"},
			{Slug: "caregiver-studio", Title: "Caregiver Recovery Studio", ShortDescription: "A creative respite service using journaling, micro-workshops, and peer care circles for unpaid family caregivers.", ConceptFocus: "caregiver burnout into supported emotional recovery", DesignerName: "Ketsara J.", TeamName: "Soft Hour Lab"},
			{Slug: "play-clinic", Title: "Play Clinic Waiting Room", ShortDescription: "A pediatric waiting-room redesign that lowers anxiety through stories, tactile play, and clearer family communication.", ConceptFocus: "clinical stress into a calmer care experience", DesignerName: "Phimnara L.", TeamName: "Little Orbit Studio"},
		},
	},
	{
		Code:                "3.3",
		Slug:                "creative-equality",
		Name:                "Creative Equality Award",
		Group:               demoGroupSocial,
		Description:         "Recognizes initiatives that reduce structural inequality and give more people fairer access to opportunity, information, and participation.",
		JudgeUsername:       "judge-equality",
		JudgeDisplayName:    "Judge 3.3 Equality",
		CreativeFocus:       "attacks root causes of inequality through creative redesign of systems, rules, or opportunity pathways",
		ExecutionFocus:      "translates the equality ambition into usable services, tools, or experiences that remove real-world barriers",
		ImpactFocus:         "narrows an opportunity gap in ways that can be measured, compared, and felt by affected groups",
		SustainabilityFocus: "can keep producing fairer outcomes through policy fit, partnerships, and ongoing resourcing",
		Projects: []demoProjectSeed{
			{Slug: "first-job-map", Title: "First Job Map", ShortDescription: "A creative employment bridge helping low-income graduates navigate informal networks, portfolio standards, and interview practice.", ConceptFocus: "hidden career barriers into a more equitable hiring path", DesignerName: "Kanokwan P.", TeamName: "Open Path Careers"},
			{Slug: "legal-language", Title: "Legal Language for All", ShortDescription: "A plain-language legal aid system that reframes complex forms and rights guidance into visual, multilingual access journeys.", ConceptFocus: "information inequality into understandable public service", DesignerName: "Tossaporn V.", TeamName: "Rights By Design"},
			{Slug: "shared-campus", Title: "Shared Campus Access", ShortDescription: "A campus access program redesigning schedules, transport, and facility use so disabled and non-disabled students can participate equally.", ConceptFocus: "institutional coordination into fairer daily participation", DesignerName: "Patsita H.", TeamName: "Equal Route Studio"},
		},
	},
	{
		Code:                "3.4",
		Slug:                "creative-education",
		Name:                "Creative Education Award",
		Group:               demoGroupSocial,
		Description:         "Rewards creative educational products, services, or programs that expand access to learning and build skills people can apply in real life.",
		JudgeUsername:       "judge-education",
		JudgeDisplayName:    "Judge 3.4 Education",
		CreativeFocus:       "turns learning into a more engaging, self-motivating, or context-aware experience than standard teaching formats",
		ExecutionFocus:      "works across real classrooms, communities, or digital environments with clear facilitation and accessibility",
		ImpactFocus:         "shows that learners gain skills, confidence, or real-world opportunities they can actually use",
		SustainabilityFocus: "can scale or continue through teacher adoption, partner support, and manageable delivery costs",
		Projects: []demoProjectSeed{
			{Slug: "maker-bus", Title: "Maker Bus Classroom", ShortDescription: "A mobile studio bringing prototyping, storytelling, and local problem-solving workshops to schools with limited facilities.", ConceptFocus: "hands-on learning into rural access to creative skills", DesignerName: "Natthawut D.", TeamName: "Rolling Classroom Co."},
			{Slug: "history-rpg", Title: "History RPG Toolkit", ShortDescription: "A curriculum add-on that turns local history lessons into collaborative roleplay and community research missions.", ConceptFocus: "passive content into active place-based learning", DesignerName: "Woranuch S.", TeamName: "Quest for Learning"},
			{Slug: "skill-ladder", Title: "Skill Ladder for Street Vendors", ShortDescription: "A modular business-literacy program using visual lessons and peer mentoring for informal workers who want to grow.", ConceptFocus: "adult education into practical income-building capability", DesignerName: "Jaturong K.", TeamName: "Everyday Learning Lab"},
		},
	},
	{
		Code:                "3.5",
		Slug:                "creative-green",
		Name:                "Creative Green Award",
		Group:               demoGroupSocial,
		Description:         "Recognizes creative environmental initiatives that reduce harm, change behavior, or build more sustainable systems in tangible ways.",
		JudgeUsername:       "judge-green",
		JudgeDisplayName:    "Judge 3.5 Green",
		CreativeFocus:       "makes environmentally responsible behavior or systems easier, more attractive, or more effective through a fresh idea",
		ExecutionFocus:      "translates the environmental idea into a working product, service, or process people can actually adopt",
		ImpactFocus:         "demonstrates measurable environmental and social gains such as waste reduction, resource savings, or behavior change",
		SustainabilityFocus: "can keep delivering environmental value through practical economics, partner support, and long-term adoption",
		Projects: []demoProjectSeed{
			{Slug: "refill-route", Title: "Refill Route Network", ShortDescription: "A neighborhood refill system combining map design, merchant incentives, and reusable container logistics for daily essentials.", ConceptFocus: "low-waste behavior into a convenient local routine", DesignerName: "Nawaporn I.", TeamName: "Loop Refill Lab"},
			{Slug: "food-scrap-commons", Title: "Food Scrap Commons", ShortDescription: "A market-to-compost service that turns vendor leftovers into soil products for nearby growers with transparent impact tracking.", ConceptFocus: "organic waste into visible local circularity", DesignerName: "Apisit R.", TeamName: "Green Cycle Works"},
			{Slug: "cool-roof-club", Title: "Cool Roof Club", ShortDescription: "A community retrofit program using creative outreach and shared financing to expand reflective roofs in heat-vulnerable neighborhoods.", ConceptFocus: "climate adaptation into a community-owned upgrade model", DesignerName: "Chanida F.", TeamName: "Heat Relief Collective"},
		},
	},
}
