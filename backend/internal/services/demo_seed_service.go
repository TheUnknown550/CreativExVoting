package services

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"creativexvoting/backend/internal/models"
	"creativexvoting/backend/internal/repositories"
	"creativexvoting/backend/internal/utils"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// criteriaTranslationFiles are re-applied after the demo seed so the Thai
// scoring-criteria copy wins over the English values the seed upserts. They are
// idempotent (UPDATE ... WHERE id = ...) and live alongside the schema migrations.
var criteriaTranslationFiles = []string{
	"002_translate_scoring_criteria_to_thai.sql",
	"003_translate_scoring_criteria_full_rubric.sql",
}

const (
	demoAdminUsername       = "admin"
	demoAdminPassword       = "admin123"
	demoAdminDisplayName    = "CreativeEx System Admin"
	demoJudgePassword       = "judge123"
	demoProjectsPerCategory = 3
)

var demoSeedNamespace = uuid.MustParse("80d57efd-047a-4b2f-9dd9-4c7c8ca9e96a")

type demoCategoryGroup string

const (
	demoGroupCity       demoCategoryGroup = "city"
	demoGroupBusiness   demoCategoryGroup = "business"
	demoGroupSocial     demoCategoryGroup = "social"
	demoGroupHallOfFame demoCategoryGroup = "halloffame"
)

// demoGroupSeed defines a superset award group (หมวด). Each group owns several
// sub-category awards (สาขา) and is judged by a single seeded judge account who
// can score every project across the group's sub-categories.
type demoGroupSeed struct {
	Group            demoCategoryGroup
	Code             string
	Slug             string
	Name             string
	NameTh           string
	Description      string
	DescriptionTh    string
	DisplayOrder     int
	JudgeUsername    string
	JudgeDisplayName string
}

var demoGroups = []demoGroupSeed{
	{
		Group:            demoGroupCity,
		Code:             "1",
		Slug:             "creative-city-awards",
		Name:             "Creative City Awards",
		NameTh:           "รางวัลเมืองสร้างสรรค์",
		Description:      "The Creative City Awards celebrate the development, revitalization, and elevation of places by combining local cultural assets and identity — traditions, culture, food, architecture and more — with creative thinking and innovation to add economic value, stimulate employment, and sustainably improve the quality of life of local communities.",
		DescriptionTh:    "รางวัลเมืองสร้างสรรค์ มุ่งเชิดชูการพัฒนา ฟื้นฟู และต่อยอดพื้นที่ ผ่านการนำสินทรัพย์ทางวัฒนธรรมและอัตลักษณ์ท้องถิ่น เช่น ประเพณี วัฒนธรรม อาหาร สถาปัตยกรรม ฯลฯ มาผสานเข้ากับกระบวนการคิดเชิงสร้างสรรค์และนวัตกรรม เพื่อสร้างมูลค่าเพิ่มทางเศรษฐกิจ กระตุ้นการจ้างงาน และยกระดับคุณภาพชีวิตของคนในพื้นที่อย่างยั่งยืน",
		DisplayOrder:     1,
		JudgeUsername:    "judge-city",
		JudgeDisplayName: "กรรมการ – รางวัลเมืองสร้างสรรค์",
	},
	{
		Group:            demoGroupBusiness,
		Code:             "2",
		Slug:             "creative-business-awards",
		Name:             "Creative Business Awards",
		NameTh:           "รางวัลธุรกิจสร้างสรรค์",
		Description:      "The Creative Business Awards honor businesses driven by creativity across every dimension — from design and production through to business-model development — with a focus on sustainability, environmental responsibility, and added value through products, services, or projects that can compete on an international level.",
		DescriptionTh:    "รางวัลธุรกิจสร้างสรรค์ มุ่งยกย่องธุรกิจที่ขับเคลื่อนด้วยความคิดสร้างสรรค์ในทุกมิติ ตั้งแต่การออกแบบ กระบวนการผลิต ไปจนถึงการพัฒนาโมเดลธุรกิจ โดยให้ความสำคัญกับความยั่งยืน การคำนึงถึงผลกระทบต่อสิ่งแวดล้อม และการสร้างมูลค่าเพิ่มผ่านผลิตภัณฑ์ บริการ หรือโครงการ ที่สามารถแข่งขันได้ในระดับสากล",
		DisplayOrder:     2,
		JudgeUsername:    "judge-business",
		JudgeDisplayName: "กรรมการ – รางวัลธุรกิจสร้างสรรค์",
	},
	{
		Group:            demoGroupSocial,
		Code:             "3",
		Slug:             "creative-social-impact-awards",
		Name:             "Creative Social Impact Awards",
		NameTh:           "รางวัลพลังสร้างสรรค์เพื่อสังคม",
		Description:      "The Creative Social Impact Awards recognize work that uses creativity as an effective tool to solve social problems, generating sustainable positive impact with concrete, measurable results at the community, provincial, or national level.",
		DescriptionTh:    "รางวัลพลังสร้างสรรค์เพื่อสังคม มุ่งยกย่องผลงานที่ใช้ความคิดสร้างสรรค์เป็นเครื่องมือในการแก้ไขปัญหาสังคมอย่างมีประสิทธิภาพ โดยสร้างผลกระทบเชิงบวกที่ยั่งยืน และสามารถเห็นผลได้อย่างเป็นรูปธรรมในระดับชุมชน จังหวัด หรือประเทศ",
		DisplayOrder:     3,
		JudgeUsername:    "judge-social",
		JudgeDisplayName: "กรรมการ – รางวัลพลังสร้างสรรค์เพื่อสังคม",
	},
	{
		Group:            demoGroupHallOfFame,
		Code:             "4",
		Slug:             "creative-hall-of-fame-awards",
		Name:             "Creative Hall of Fame Awards",
		NameTh:           "รางวัลเชิดชูเกียรติพิเศษ",
		Description:      "Special honors for organizations and brands that play an outstanding role in setting new directions for Thai creativity, demonstrating the use of creativity as a key mechanism to drive organizations, create change, and make a broad impact on society.",
		DescriptionTh:    "รางวัลเพื่อเชิดชูองค์กรและแบรนด์ที่มีบทบาทโดดเด่นด้านการกำหนดทิศทางใหม่ของความคิดสร้างสรรค์ไทย และแสดงให้เห็นถึงการใช้ความคิดสร้างสรรค์เป็นกลไกสำคัญในการขับเคลื่อนองค์กร สร้างการเปลี่ยนแปลง และสร้างผลกระทบในวงกว้างต่อสังคม",
		DisplayOrder:     4,
		JudgeUsername:    "judge-halloffame",
		JudgeDisplayName: "กรรมการ – รางวัลเชิดชูเกียรติพิเศษ",
	},
}

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
	NameTh              string
	Group               demoCategoryGroup
	Description         string
	DescriptionTh       string
	JudgeUsername       string
	JudgeDisplayName    string
	CreativeFocus       string
	ExecutionFocus      string
	ImpactFocus         string
	SustainabilityFocus string
	Projects            []demoProjectSeed
}

type demoCriterionSeed struct {
	Slug          string
	Name          string
	NameTh        string
	Description   string
	DescriptionTh string
	MaxScore      int
	DisplayOrder  int
}

type DemoSeedService struct {
	pool          *pgxpool.Pool
	authRepo      *repositories.AuthRepository
	migrationsDir string
}

func NewDemoSeedService(pool *pgxpool.Pool, authRepo *repositories.AuthRepository, migrationsDir string) *DemoSeedService {
	return &DemoSeedService{
		pool:          pool,
		authRepo:      authRepo,
		migrationsDir: migrationsDir,
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

	// 1. Upsert the superset award groups (หมวด) and remember their IDs.
	groupIDByGroup := map[demoCategoryGroup]string{}
	for _, group := range demoGroups {
		groupID, err := upsertGroupSeed(ctx, tx, group)
		if err != nil {
			return err
		}
		groupIDByGroup[group.Group] = groupID
	}

	// 2. Upsert sub-categories (สาขา) linked to their group, plus criteria and projects.
	for _, category := range demoCategories {
		groupID := groupIDByGroup[category.Group]
		categoryID, err := upsertCategorySeed(ctx, tx, category, groupID)
		if err != nil {
			return err
		}

		for _, criterion := range criteriaForCategory(category) {
			if err := upsertCriterionSeed(ctx, tx, categoryID, category.Slug, criterion); err != nil {
				return err
			}
		}

		for _, project := range expandedProjectsForCategory(category) {
			if err := upsertProjectSeed(ctx, tx, category, categoryID, project); err != nil {
				return err
			}
		}

		if err := removeStaleSeedProjects(ctx, tx, category); err != nil {
			return err
		}
	}

	// 3. One judge per group, assigned to the whole group so they can score every
	//    project across the group's sub-categories.
	for _, group := range demoGroups {
		judgeID, err := upsertGroupJudgeSeed(ctx, tx, group, judgePasswordHash)
		if err != nil {
			return err
		}
		if err := replaceJudgeGroupAssignment(ctx, tx, judgeID, groupIDByGroup[group.Group]); err != nil {
			return err
		}
	}

	// 4. Retire the legacy per-sub-category demo judge accounts from earlier seeds.
	if err := deactivateLegacySeedJudges(ctx, tx); err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	// 5. Re-apply the Thai scoring-criteria translations last, so they win over
	//    the English copy this seed just upserted.
	return s.applyCriteriaTranslations(ctx)
}

func (s *DemoSeedService) applyCriteriaTranslations(ctx context.Context) error {
	if s.migrationsDir == "" {
		return nil
	}

	for _, name := range criteriaTranslationFiles {
		content, err := os.ReadFile(filepath.Join(s.migrationsDir, name))
		if err != nil {
			if os.IsNotExist(err) {
				continue
			}
			return fmt.Errorf("read criteria translation %s: %w", name, err)
		}
		// The translation files were written to overwrite the English name/description
		// columns. Redirect them to the Thai columns so English (from the seed) is kept
		// and Thai lives alongside it for locale switching.
		sql := strings.ReplaceAll(string(content), "SET name = ", "SET name_th = ")
		sql = strings.ReplaceAll(sql, ", description = ", ", description_th = ")
		if _, err := s.pool.Exec(ctx, sql); err != nil {
			return fmt.Errorf("apply criteria translation %s: %w", name, err)
		}
	}

	return nil
}

func deterministicSeedID(key string) string {
	return uuid.NewSHA1(demoSeedNamespace, []byte(key)).String()
}

func expandedProjectsForCategory(category demoCategorySeed) []demoProjectSeed {
	projects := append([]demoProjectSeed{}, category.Projects...)
	if len(projects) >= demoProjectsPerCategory {
		return projects[:demoProjectsPerCategory]
	}

	extraIndex := 1
	for len(projects) < demoProjectsPerCategory {
		suffix := len(projects) + 1
		projects = append(projects, demoProjectSeed{
			Slug:             fmt.Sprintf("%s-seed-%d", category.Slug, suffix),
			Title:            fmt.Sprintf("%s Seed Concept %d", category.Code, suffix),
			ShortDescription: fmt.Sprintf("Additional seeded concept for %s that broadens the demo leaderboard and gives the admin ranking page a fuller top 5 view.", category.Name),
			ConceptFocus:     fmt.Sprintf("%s with a secondary scenario variation %d", category.CreativeFocus, extraIndex),
			DesignerName:     fmt.Sprintf("Demo Designer %d", suffix),
			TeamName:         fmt.Sprintf("%s Demo Team %d", category.Code, suffix),
		})
		extraIndex++
	}

	return projects
}

func criteriaForCategory(category demoCategorySeed) []demoCriterionSeed {
	switch category.Group {
	case demoGroupCity:
		return []demoCriterionSeed{
			{
				Slug:         "creative-interpretation",
				Name:         "Creative interpretation",
				Description:  scoreBandDescription(category.CreativeFocus, 25),
				MaxScore:     25,
				DisplayOrder: 1,
			},
			{
				Slug:         "execution-in-place",
				Name:         "Execution in place",
				Description:  scoreBandDescription(category.ExecutionFocus, 25),
				MaxScore:     25,
				DisplayOrder: 2,
			},
			{
				Slug:         "district-impact",
				Name:         "Measurable district impact",
				Description:  scoreBandDescription(category.ImpactFocus, 30),
				MaxScore:     30,
				DisplayOrder: 3,
			},
			{
				Slug:         "continuity",
				Name:         "Partnerships and continuity",
				Description:  scoreBandDescription(category.SustainabilityFocus, 20),
				MaxScore:     20,
				DisplayOrder: 4,
			},
		}
	case demoGroupBusiness:
		return []demoCriterionSeed{
			{
				Slug:         "creative-strategy",
				Name:         "Creative strategy",
				Description:  scoreBandDescription(category.CreativeFocus, 25),
				MaxScore:     25,
				DisplayOrder: 1,
			},
			{
				Slug:         "execution-delivery",
				Name:         "Execution and delivery",
				Description:  scoreBandDescription(category.ExecutionFocus, 25),
				MaxScore:     25,
				DisplayOrder: 2,
			},
			{
				Slug:         "business-impact",
				Name:         "Measurable business impact",
				Description:  scoreBandDescription(category.ImpactFocus, 30),
				MaxScore:     30,
				DisplayOrder: 3,
			},
			{
				Slug:         "scale-sustainability",
				Name:         "Scalability and sustainability",
				Description:  scoreBandDescription(category.SustainabilityFocus, 20),
				MaxScore:     20,
				DisplayOrder: 4,
			},
		}
	case demoGroupHallOfFame:
		if category.Slug == "creative-brand-of-the-year" {
			return creativeBrandCriteria()
		}
		return creativeOrganizationCriteria()
	default:
		return []demoCriterionSeed{
			{
				Slug:         "creative-social-approach",
				Name:         "Creative social approach",
				Description:  scoreBandDescription(category.CreativeFocus, 25),
				MaxScore:     25,
				DisplayOrder: 1,
			},
			{
				Slug:         "positive-impact",
				Name:         "Measurable positive impact",
				Description:  scoreBandDescription(category.ImpactFocus, 30),
				MaxScore:     30,
				DisplayOrder: 2,
			},
			{
				Slug:         "accessible-implementation",
				Name:         "Accessible implementation",
				Description:  scoreBandDescription(category.ExecutionFocus, 25),
				MaxScore:     25,
				DisplayOrder: 3,
			},
			{
				Slug:         "long-term-continuity",
				Name:         "Long-term continuity",
				Description:  scoreBandDescription(category.SustainabilityFocus, 20),
				MaxScore:     20,
				DisplayOrder: 4,
			},
		}
	}
}

func scoreBandDescription(focus string, maxScore int) string {
	intro := fmt.Sprintf(
		"This criterion looks at whether the work %s. (%d pts)",
		focus,
		maxScore,
	)

	switch maxScore {
	case 30:
		return strings.Join([]string{
			intro,
			"25-30 = Strongly fulfills the criterion with clear evidence, meaningful results, and a compelling level of quality or effectiveness.",
			"15-24 = Shows a solid idea and some real progress, but the evidence, consistency, or depth of results is still uneven.",
			"0-14 = Only weakly fulfills the criterion, with limited proof, limited delivery, or a loose connection to the intended outcome.",
		}, "\n\n")
	case 25:
		return strings.Join([]string{
			intro,
			"20-25 = Strongly fulfills the criterion with clear evidence, meaningful results, and a compelling level of quality or effectiveness.",
			"11-19 = Shows a solid idea and some real progress, but the evidence, consistency, or depth of results is still uneven.",
			"0-10 = Only weakly fulfills the criterion, with limited proof, limited delivery, or a loose connection to the intended outcome.",
		}, "\n\n")
	case 20:
		return strings.Join([]string{
			intro,
			"15-20 = Strongly fulfills the criterion with clear evidence, meaningful results, and a compelling level of quality or effectiveness.",
			"5-14 = Shows a solid idea and some real progress, but the evidence, consistency, or depth of results is still uneven.",
			"0-4 = Only weakly fulfills the criterion, with limited proof, limited delivery, or a loose connection to the intended outcome.",
		}, "\n\n")
	case 15:
		return strings.Join([]string{
			intro,
			"12-15 = Strongly fulfills the criterion with clear evidence, meaningful results, and a compelling level of quality or effectiveness.",
			"7-11 = Shows a solid idea and some real progress, but the evidence, consistency, or depth of results is still uneven.",
			"0-6 = Only weakly fulfills the criterion, with limited proof, limited delivery, or a loose connection to the intended outcome.",
		}, "\n\n")
	default:
		return strings.Join([]string{
			intro,
			fmt.Sprintf("%d-%d = Strongly fulfills the criterion with clear evidence, meaningful results, and a compelling level of quality or effectiveness.", max(0, maxScore-4), maxScore),
			fmt.Sprintf("%d-%d = Shows a solid idea and some real progress, but the evidence, consistency, or depth of results is still uneven.", max(0, maxScore-9), max(0, maxScore-5)),
			fmt.Sprintf("0-%d = Only weakly fulfills the criterion, with limited proof, limited delivery, or a loose connection to the intended outcome.", max(0, maxScore-10)),
		}, "\n\n")
	}
}

// hofDescription assembles a Hall of Fame rubric: an intro question followed by
// the scoring bands ("24-30 = ...") separated by blank lines, matching how the
// judge UI parses rubric bands.
func hofDescription(intro string, bands ...string) string {
	return intro + "\n\n" + strings.Join(bands, "\n\n")
}

// creativeBrandCriteria is the official rubric for 4.2 Most Creative Brand (total 100).
func creativeBrandCriteria() []demoCriterionSeed {
	return []demoCriterionSeed{
		{
			Slug:         "brand-creative-resilience",
			Name:         "Creativity in overcoming obstacles",
			NameTh:       "ความคิดสร้างสรรค์ในการฝ่าอุปสรรค",
			MaxScore:     25,
			DisplayOrder: 1,
			Description: hofDescription(
				"Does the brand use creativity to overcome obstacles while keeping its identity clear? (25 pts)",
				"20-25 = Turns the brand's limits or crises into fresh creative campaigns or ideas that not only solve the problem but make the Brand Identity stand out more clearly.",
				"11-19 = Solves the problem and gets through the obstacle, but the brand's identity stays the same, with no new perspective or sharpened identity.",
				"0-10 = Loses its sense of identity under the pressure, or uses a generic fix that does not reflect the brand at all.",
			),
			DescriptionTh: hofDescription(
				"แบรนด์ใช้ความคิดสร้างสรรค์ฝ่าอุปสรรคโดยควบคุมตัวตนได้ชัดเจนไหม? (25 คะแนน)",
				"20-25 = พลิกข้อจำกัดหรือวิกฤตที่แบรนด์เผชิญ ให้กลายเป็นแคมเปญหรือแนวคิดสร้างสรรค์ที่แปลกใหม่ ซึ่งไม่เพียงแต่แก้ปัญหาได้ แต่ยังต่อยอดทำให้ตัวตนของแบรนด์ (Brand Identity) โดดเด่นและชัดเจนยิ่งขึ้น",
				"11-19 = แก้ไขปัญหาและฝ่าฟันอุปสรรคไปได้ แต่ตัวตนของแบรนด์ยังคงเดิม ไม่ได้เกิดมุมมองใหม่หรือสร้างอัตลักษณ์ที่ทำให้แบรนด์ชัดเจนยิ่งขึ้น",
				"0-10 = ได้รับผลกระทบจากอุปสรรคจนสูญเสียความเป็นตัวตน หรือใช้วิธีแก้ปัญหาแบบทั่วไปที่ไม่สะท้อนตัวตนของแบรนด์เลย",
			),
		},
		{
			Slug:         "brand-tech-storytelling",
			Name:         "Expanding creativity with technology",
			NameTh:       "ขยายขอบเขตความคิดสร้างสรรค์ด้วยเทคโนโลยี",
			MaxScore:     15,
			DisplayOrder: 2,
			Description: hofDescription(
				"Does the brand use technology creatively to tell stories differently? (15 pts)",
				"12-15 = Blends technology with storytelling so creatively that it becomes a new form of communication, campaign, or experience unlike the usual.",
				"7-11 = Uses technology to support storytelling or campaigns well, but in commonly seen forms (e.g. just a filter or an event), without creating a new perception.",
				"0-6 = Tells the story in the same old way, with almost no technology used to extend creativity.",
			),
			DescriptionTh: hofDescription(
				"แบรนด์ใช้ความคิดสร้างสรรค์ผ่านเทคโนโลยีเล่าเรื่องที่ต่างจากเดิมได้ไหม? (15 คะแนน)",
				"12-15 = ผสมผสานเทคโนโลยีเข้ากับศิลปะการเล่าเรื่อง (Storytelling) ได้อย่างสร้างสรรค์ จนเกิดเป็นรูปแบบการสื่อสาร แคมเปญ หรือประสบการณ์ใหม่ (New Experience) ที่ต่างไปจากวิธีเดิม ๆ",
				"7-11 = นำเทคโนโลยีมาใช้ช่วยเสริมในการเล่าเรื่องหรือทำแคมเปญได้ดี แต่ยังเป็นรูปแบบที่พบเห็นได้ทั่วไป (เช่น แค่ทำฟิลเตอร์ หรือจัดอีเวนต์) ยังไม่สร้างความแปลกใหม่ในการรับรู้",
				"0-6 = เล่าเรื่องด้วยวิธีแบบเดิม ๆ แทบไม่มีการนำเทคโนโลยีเข้ามาช่วยต่อยอดความคิดสร้างสรรค์",
			),
		},
		{
			Slug:         "brand-transparency",
			Name:         "Creativity on tangible transparency",
			NameTh:       "ความคิดสร้างสรรค์บนความโปร่งใสที่จับต้องได้",
			MaxScore:     30,
			DisplayOrder: 3,
			Description: hofDescription(
				"Does the brand communicate creatively so it is verifiable without being asked? (30 pts)",
				"24-30 = Designs how it reveals information (e.g. material sources, production process, or revenue) with creativity that is easy to understand, appealing, credible, and immediately accessible without consumers asking, setting a new transparency standard for the brand.",
				"13-23 = Is transparent and discloses information to the expected standard, but communicates it plainly, lacking the creativity to make it easy for consumers to understand and access.",
				"0-12 = Hides information, is hard to access, or has no communication that shows the brand's transparency.",
			),
			DescriptionTh: hofDescription(
				"แบรนด์ใช้ความคิดสร้างสรรค์สื่อสารจนตรวจสอบได้โดยไม่ต้องร้องขอใช่ไหม? (30 คะแนน)",
				"24-30 = ออกแบบวิธีการเปิดเผยข้อมูล (เช่น แหล่งที่มาของวัตถุดิบ กระบวนการผลิต หรือรายได้) ด้วยความคิดสร้างสรรค์ที่น่าเข้าใจง่าย ดึงดูด น่าเชื่อถือ และเข้าถึงได้ทันทีโดยผู้บริโภคไม่ต้องร้องขอ สร้างมาตรฐานใหม่ด้านความโปร่งใสให้กับแบรนด์",
				"13-23 = มีความโปร่งใสและเปิดเผยข้อมูลตามมาตรฐานที่ควรทำ แต่รูปแบบการสื่อสารยังเป็นการทำตรงไปตรงมา ขาดความคิดสร้างสรรค์ที่จะทำให้ผู้บริโภคเข้าใจและเข้าถึงได้ง่าย",
				"0-12 = ปกปิดข้อมูล เข้าถึงยาก หรือไม่มีการสื่อสารใด ๆ ที่แสดงให้เห็นถึงความโปร่งใสของแบรนด์",
			),
		},
		{
			Slug:         "brand-opportunity",
			Name:         "Creativity that opens opportunities for others",
			NameTh:       "ความคิดสร้างสรรค์เพื่อเปิดโอกาสให้คนอื่น",
			MaxScore:     15,
			DisplayOrder: 4,
			Description: hofDescription(
				"Does the brand use creativity to genuinely open opportunities for others? (15 pts)",
				"12-15 = Designs business models, campaigns, or creative spaces that embrace, uplift, or create new opportunities for people, society, or small partners (e.g. local suppliers, communities) to grow together with the brand in a tangible way.",
				"7-11 = Gives some opportunity or help to others, but as short CSR activities or occasional donations, without using creativity to build long-term opportunity.",
				"0-6 = Focuses mainly on its own benefit, with no space or sharing of opportunity for others.",
			),
			DescriptionTh: hofDescription(
				"แบรนด์ใช้ความคิดสร้างสรรค์เปิดโอกาสให้ผู้คนได้โอกาสจริงไหม? (15 คะแนน)",
				"12-15 = ออกแบบโมเดลธุรกิจ แคมเปญ หรือพื้นที่สร้างสรรค์ที่เข้าไปโอบอุ้ม ยกระดับศักยภาพ หรือสร้างโอกาสใหม่ให้กับผู้คน สังคม หรือพันธมิตรตัวเล็ก ๆ (เช่น ซัพพลายเออร์ท้องถิ่น ชุมชน) ให้เติบโตไปพร้อมกับแบรนด์ได้อย่างเป็นรูปธรรม",
				"7-11 = มีการให้โอกาสหรือช่วยเหลือคนอื่นบ้าง แต่ยังเป็นในลักษณะกิจกรรม CSR สั้น ๆ หรือการบริจาคครั้งคราว ไม่ได้ใช้ความคิดสร้างสรรค์เพื่อสร้างโอกาสในระยะยาว",
				"0-6 = มุ่งเน้นแต่ผลประโยชน์ของตัวเองเป็นหลัก ไม่มีพื้นที่หรือการแบ่งปันโอกาสให้ผู้อื่น",
			),
		},
		{
			Slug:         "brand-ownership",
			Name:         "Creativity that builds a sense of ownership",
			NameTh:       "ความคิดสร้างสรรค์ที่สร้างความเป็นเจ้าของ",
			MaxScore:     15,
			DisplayOrder: 5,
			Description: hofDescription(
				"Does the brand use creativity so consumers feel a sense of ownership? (15 pts)",
				"12-15 = Creates campaigns, experiences, brand culture, or identity that draw consumers in until they feel a deep bond, a Sense of Ownership, and are ready to defend and recommend the brand with pride.",
				"7-11 = Consumers like and recognize the identity and have good Brand Loyalty, but not to the point of feeling ownership or personally defending the brand.",
				"0-6 = Consumers see the brand as just another buy-sell option, with no emotional bond.",
			),
			DescriptionTh: hofDescription(
				"แบรนด์ใช้ความคิดสร้างสรรค์จนผู้บริโภครู้สึกเป็นเจ้าของไหม? (15 คะแนน)",
				"12-15 = สร้างแคมเปญ ประสบการณ์ วัฒนธรรมแบรนด์ หรือเอกลักษณ์ที่ทำให้ผู้บริโภคเข้ามามีส่วนร่วม จนเกิดความรู้สึกผูกพันลึกซึ้ง เกิดความรู้สึกเจ้าของร่วม (Sense of Ownership) และพร้อมจะปกป้องรวมถึงบอกต่อแบรนด์ด้วยความภูมิใจ",
				"7-11 = ผู้บริโภคชื่นชอบและรับรู้ถึงเอกลักษณ์ มีความผูกพันต่อแบรนด์ (Brand Loyalty) ในระดับที่ดี แต่ยังไม่ถึงขั้นรู้สึกเป็นเจ้าของหรือผูกพันจนถึงขั้นปกป้องแบรนด์เป็นการส่วนตัว",
				"0-6 = ผู้บริโภคมองแบรนด์เป็นเพียงตัวเลือกซื้อ-ขายทั่วไป ไม่มีความผูกพันทางอารมณ์กับแบรนด์",
			),
		},
	}
}

// creativeOrganizationCriteria is the official rubric for 4.1 Most Creative Organization (total 100).
func creativeOrganizationCriteria() []demoCriterionSeed {
	return []demoCriterionSeed{
		{
			Slug:         "org-creative-resilience",
			Name:         "Creativity in overcoming obstacles",
			NameTh:       "ความคิดสร้างสรรค์ในการฝ่าอุปสรรค",
			MaxScore:     15,
			DisplayOrder: 1,
			Description: hofDescription(
				"Does the organization use creativity to turn limits into opportunities? (15 pts)",
				"12-15 = Turns severe crises or limits into new business or operational opportunities beyond expectation, with clearly positive results.",
				"7-11 = Handles obstacles and solves problems well, but uses familiar methods, not quite turning limits into opportunity.",
				"0-6 = Lets obstacles become a setback, or solves problems the same old way that does not improve the situation.",
			),
			DescriptionTh: hofDescription(
				"องค์กรใช้ความคิดสร้างสรรค์เปลี่ยนข้อจำกัดเป็นโอกาสได้ไหม? (15 คะแนน)",
				"12-15 = พลิกวิกฤตหรือข้อจำกัดที่รุนแรงให้กลายเป็นโอกาสใหม่ทางธุรกิจหรือการทำงานได้อย่างเหนือความคาดหมาย และสร้างผลลัพธ์เชิงบวกได้อย่างชัดเจน",
				"7-11 = รับมือกับอุปสรรคและแก้ปัญหาได้ดี แต่ยังใช้วิธีการหรือรูปแบบที่คุ้นเคยในการจัดการ ยังไม่ถึงขั้นเปลี่ยนข้อจำกัดเป็นโอกาส",
				"0-6 = ปล่อยให้อุปสรรคหรือข้อจำกัดเป็นจุดถดถอยของการทำงาน หรือใช้วิธีแก้ปัญหาแบบเดิม ๆ ที่ไม่ช่วยให้สถานการณ์ดีขึ้น",
			),
		},
		{
			Slug:         "org-tech-creativity",
			Name:         "Expanding creativity with technology",
			NameTh:       "ขยายขอบเขตความคิดสร้างสรรค์ด้วยเทคโนโลยี",
			MaxScore:     20,
			DisplayOrder: 2,
			Description: hofDescription(
				"Does the organization use technology creatively to produce different work? (20 pts)",
				"16-20 = Applies technology with creativity to produce work, service formats, or innovations that are completely different and create a new user experience.",
				"9-15 = Uses technology well in its processes, but mainly to improve efficiency or do standard work, without truly new perspectives or output.",
				"0-8 = Uses very little technology, or only as a basic tool, without blending creativity to build on it.",
			),
			DescriptionTh: hofDescription(
				"องค์กรใช้ความคิดสร้างสรรค์ผ่านเทคโนโลยีสร้างงานที่ต่างจากเดิมได้ไหม? (20 คะแนน)",
				"16-20 = ประยุกต์ใช้เทคโนโลยีร่วมกับความคิดสร้างสรรค์จนเกิดเป็นผลงาน รูปแบบบริการ หรือนวัตกรรมใหม่ที่ต่างไปจากเดิมอย่างสิ้นเชิง และสร้างประสบการณ์ใหม่ให้ผู้ใช้งาน",
				"9-15 = นำเทคโนโลยีมาใช้ในกระบวนการทำงานได้ดี แต่เป็นการเพิ่มประสิทธิภาพหรือทำงานตามมาตรฐานทั่วไป ยังไม่สร้างมุมมองหรือผลงานที่แปลกใหม่อย่างแท้จริง",
				"0-8 = ใช้เทคโนโลยีน้อยมาก หรือใช้เพียงเป็นเครื่องมือพื้นฐาน โดยไม่ได้ผสมผสานความคิดสร้างสรรค์เพื่อต่อยอดเลย",
			),
		},
		{
			Slug:         "org-transparency",
			Name:         "Creativity on tangible transparency",
			NameTh:       "ความคิดสร้างสรรค์บนความโปร่งใสที่จับต้องได้",
			MaxScore:     20,
			DisplayOrder: 3,
			Description: hofDescription(
				"Does the organization communicate creatively so it is verifiable without being asked? (20 pts)",
				"16-20 = Designs communication and access to in-depth information creatively (interesting, easy to understand) and discloses it publicly without outsiders asking, reflecting transparency in every dimension.",
				"9-15 = Discloses information to standard and is verifiable, but communicates formally or hard-to-understand (e.g. only numbers or long documents), lacking creativity to help explain.",
				"0-8 = Information is hard to access, vague, or there is no communication demonstrating tangible transparency.",
			),
			DescriptionTh: hofDescription(
				"องค์กรใช้ความคิดสร้างสรรค์สื่อสารจนตรวจสอบได้โดยไม่ต้องร้องขอใช่ไหม? (20 คะแนน)",
				"16-20 = ออกแบบการสื่อสารและการเข้าถึงข้อมูลเชิงลึกได้อย่างสร้างสรรค์ น่าสนใจ เข้าใจง่าย และเปิดเผยสู่สาธารณะโดยที่คนนอกไม่ต้องร้องขอ สะท้อนความโปร่งใสในทุกมิติ",
				"9-15 = มีการเปิดเผยข้อมูลตามเกณฑ์มาตรฐานและตรวจสอบได้ แต่รูปแบบการสื่อสารยังเป็นทางการหรือเข้าใจยาก (เช่น มีแต่ตัวเลขหรือเอกสารยาว) ยังขาดความคิดสร้างสรรค์ในการช่วยอธิบาย",
				"0-8 = ข้อมูลเข้าถึงยาก คลุมเครือ หรือไม่มีการสื่อสารที่แสดงถึงความโปร่งใสอย่างเป็นรูปธรรม",
			),
		},
		{
			Slug:         "org-opportunity",
			Name:         "Creativity that opens opportunities for others",
			NameTh:       "ความคิดสร้างสรรค์เพื่อเปิดโอกาสให้คนอื่น",
			MaxScore:     30,
			DisplayOrder: 4,
			Description: hofDescription(
				"Does the organization use creativity to genuinely open opportunities for outsiders? (30 pts)",
				"24-30 = Designs mechanisms or platforms that let outsiders or communities genuinely co-create, share ideas, or collaborate, distributing opportunity and creating broad positive impact.",
				"13-23 = Opens some participation for outsiders, but in predefined forms or set activities, not driven at a structural level.",
				"0-12 = Works only within the internal team, with almost no mechanism or space for outsiders to participate.",
			),
			DescriptionTh: hofDescription(
				"องค์กรใช้ความคิดสร้างสรรค์เปิดโอกาสให้คนนอกได้จริงไหม? (30 คะแนน)",
				"24-30 = ออกแบบกลไกหรือแพลตฟอร์มที่เปิดให้คนภายนอกหรือชุมชนเข้ามามีส่วนร่วมสร้างสรรค์ แชร์ไอเดีย หรือร่วมงานได้อย่างแท้จริง เกิดการกระจายโอกาสและสร้างผลกระทบเชิงบวกในวงกว้าง",
				"13-23 = มีการเปิดโอกาสให้คนนอกเข้ามามีส่วนร่วมบ้าง แต่ยังเป็นในรูปแบบที่กำหนดไว้ หรือร่วมกิจกรรมตามที่จัดให้ ไม่ได้ขับเคลื่อนในระดับโครงสร้างจริง",
				"0-12 = ทำงานเฉพาะในกลุ่มคนภายในองค์กร แทบไม่มีกลไกหรือพื้นที่ที่เปิดโอกาสให้คนนอกเข้ามามีส่วนร่วมเลย",
			),
		},
		{
			Slug:         "org-ownership",
			Name:         "Creativity that builds a sense of ownership",
			NameTh:       "ความคิดสร้างสรรค์ที่สร้างความเป็นเจ้าของ",
			MaxScore:     15,
			DisplayOrder: 5,
			Description: hofDescription(
				"Does the organization use creativity so its people feel ownership? (15 pts)",
				"12-15 = Designs experiences or culture that make people inside and around feel strongly bonded and proud, creating a Sense of Ownership and readiness to protect and push the organization forward.",
				"7-11 = People cooperate according to their roles, but not to the point of pride or deep ownership.",
				"0-6 = People feel like mere order-takers or activity participants, lacking bond or pride in the work.",
			),
			DescriptionTh: hofDescription(
				"องค์กรใช้ความคิดสร้างสรรค์จนคนภายในรู้สึกเป็นเจ้าของไหม? (15 คะแนน)",
				"12-15 = ออกแบบประสบการณ์หรือวัฒนธรรมที่ทำให้คนในและคนรอบข้างรู้สึกผูกพันและภูมิใจอย่างแรงกล้า จนเกิดความรู้สึกเป็นเจ้าของร่วม (Sense of Ownership) และพร้อมช่วยปกป้องและผลักดันองค์กร",
				"7-11 = คนให้ความร่วมมือกับองค์กรตามบทบาทหน้าที่ แต่ยังไม่ถึงขั้นเกิดความภูมิใจหรือรู้สึกเป็นเจ้าของในระดับที่ลึก",
				"0-6 = คนรู้สึกเป็นเพียงผู้รับคำสั่งหรือผู้เข้าร่วมกิจกรรมตามหน้าที่ ขาดความผูกพันหรือความภูมิใจต่อผลงาน",
			),
		},
	}
}

func upsertGroupSeed(ctx context.Context, tx pgx.Tx, group demoGroupSeed) (string, error) {
	id := deterministicSeedID("group:" + group.Slug)
	var persistedID string
	err := tx.QueryRow(ctx, `
		INSERT INTO award_groups (id, code, name, name_th, description, description_th, display_order, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NOW(), NOW())
		ON CONFLICT (id) DO UPDATE
		SET code = EXCLUDED.code,
			name = EXCLUDED.name,
			name_th = EXCLUDED.name_th,
			description = EXCLUDED.description,
			description_th = EXCLUDED.description_th,
			display_order = EXCLUDED.display_order,
			is_active = TRUE,
			updated_at = NOW()
		RETURNING id
	`, id, group.Code, group.Name, group.NameTh, group.Description, group.DescriptionTh, group.DisplayOrder).Scan(&persistedID)
	return persistedID, err
}

func upsertCategorySeed(ctx context.Context, tx pgx.Tx, category demoCategorySeed, groupID string) (string, error) {
	id := deterministicSeedID("category:" + category.Slug)
	var persistedID string
	err := tx.QueryRow(ctx, `
		INSERT INTO categories (id, award_group_id, name, name_th, description, description_th, display_order, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NOW(), NOW())
		ON CONFLICT (id) DO UPDATE
		SET award_group_id = EXCLUDED.award_group_id,
			name = EXCLUDED.name,
			name_th = EXCLUDED.name_th,
			description = EXCLUDED.description,
			description_th = EXCLUDED.description_th,
			display_order = EXCLUDED.display_order,
			is_active = TRUE,
			updated_at = NOW()
		RETURNING id
	`, id, groupID, category.Name, category.NameTh, category.Description, category.DescriptionTh, categoryDisplayOrder(category.Code)).Scan(&persistedID)
	return persistedID, err
}

// categoryDisplayOrder turns a code like "1.3" into the minor number (3) so
// sub-categories sort naturally within their group.
func categoryDisplayOrder(code string) int {
	parts := strings.Split(code, ".")
	if len(parts) < 2 {
		return 0
	}
	order := 0
	for _, ch := range parts[1] {
		if ch < '0' || ch > '9' {
			break
		}
		order = order*10 + int(ch-'0')
	}
	return order
}

func upsertCriterionSeed(ctx context.Context, tx pgx.Tx, categoryID string, categorySlug string, criterion demoCriterionSeed) error {
	id := deterministicSeedID("criterion:" + categorySlug + ":" + criterion.Slug)
	_, err := tx.Exec(ctx, `
		INSERT INTO scoring_criteria (
			id, category_id, name, name_th, description, description_th, max_score, display_order, is_active, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, NOW(), NOW())
		ON CONFLICT (id) DO UPDATE
		SET category_id = EXCLUDED.category_id,
			name = EXCLUDED.name,
			name_th = EXCLUDED.name_th,
			description = EXCLUDED.description,
			description_th = EXCLUDED.description_th,
			max_score = EXCLUDED.max_score,
			display_order = EXCLUDED.display_order,
			is_active = TRUE,
			updated_at = NOW()
	`, id, categoryID, criterion.Name, criterion.NameTh, criterion.Description, criterion.DescriptionTh, criterion.MaxScore, criterion.DisplayOrder)
	return err
}

func upsertGroupJudgeSeed(ctx context.Context, tx pgx.Tx, group demoGroupSeed, passwordHash string) (string, error) {
	id := deterministicSeedID("user:" + group.JudgeUsername)
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
	`, id, group.JudgeUsername, passwordHash, group.JudgeDisplayName).Scan(&persistedID)
	return persistedID, err
}

func replaceJudgeGroupAssignment(ctx context.Context, tx pgx.Tx, judgeID string, groupID string) error {
	if _, err := tx.Exec(ctx, `DELETE FROM judge_group_assignments WHERE judge_id = $1`, judgeID); err != nil {
		return err
	}

	_, err := tx.Exec(ctx, `
		INSERT INTO judge_group_assignments (id, judge_id, group_id, created_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (judge_id, group_id) DO NOTHING
	`, deterministicSeedID("group-assignment:"+judgeID+":"+groupID), judgeID, groupID)
	return err
}

// deactivateLegacySeedJudges disables the old one-judge-per-sub-category demo
// accounts created before the group-based model so the judge list stays clean.
func deactivateLegacySeedJudges(ctx context.Context, tx pgx.Tx) error {
	usernames := make([]string, 0, len(demoCategories))
	for _, category := range demoCategories {
		if category.JudgeUsername != "" {
			usernames = append(usernames, category.JudgeUsername)
		}
	}
	if len(usernames) == 0 {
		return nil
	}

	_, err := tx.Exec(ctx, `
		UPDATE users
		SET is_active = FALSE, updated_at = NOW()
		WHERE role = 'judge' AND username = ANY($1)
	`, usernames)
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

// removeStaleSeedProjects deletes auto-generated "Seed Concept" projects left over
// from a previous run where demoProjectsPerCategory was larger than the number of
// hand-authored projects for this category.
func removeStaleSeedProjects(ctx context.Context, tx pgx.Tx, category demoCategorySeed) error {
	const maxEverSeededPerCategory = 5

	for suffix := len(category.Projects) + 1; suffix <= maxEverSeededPerCategory; suffix++ {
		slug := fmt.Sprintf("%s-seed-%d", category.Slug, suffix)
		projectID := deterministicSeedID("project:" + category.Slug + ":" + slug)
		if _, err := tx.Exec(ctx, `DELETE FROM projects WHERE id = $1`, projectID); err != nil {
			return err
		}
	}

	return nil
}

var demoCategories = []demoCategorySeed{
	{
		Code:                "1.1",
		Slug:                "creative-city-festival",
		Name:                "Creative City Festival Award",
		Group:               demoGroupCity,
		Description:         "Honors festivals and place-based creative programs that reinterpret local culture, food, art, and everyday identity into memorable public experiences with visible district impact.",
		DescriptionTh:       "รางวัลสำหรับกิจกรรมหรือเทศกาลสร้างสรรค์ ที่นำทุนทางวัฒนธรรม ศิลปะ ประเพณี อาหาร ฯลฯ ภายในพื้นที่มาประยุกต์ใช้ เพื่อสร้างประสบการณ์ใหม่และก่อให้เกิดผลกระทบเชิงบวกต่อย่าน ชุมชน หรือพื้นที่",
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
		DescriptionTh:       "รางวัลสำหรับเมืองหรือพื้นที่ที่สามารถพัฒนาอัตลักษณ์ให้โดดเด่นและมีจุดยืน (Positioning) ที่ชัดเจนจนเกิดการจดจำและการรับรู้ในวงกว้าง",
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
		DescriptionTh:       "รางวัลสำหรับนโยบายหรือมาตรการภาครัฐที่ออกแบบอย่างสร้างสรรค์ เพื่อขับเคลื่อนเศรษฐกิจสร้างสรรค์ในระดับเมืองหรือพื้นที่ โดยต้องแสดงให้เห็นถึงการนำไปปฏิบัติได้จริง การบูรณาการความร่วมมือระหว่างภาคส่วน และการสร้างผลลัพธ์ที่เป็นรูปธรรมในมิติทางเศรษฐกิจ สังคม หรือการพัฒนาเมือง รวมถึงการใช้ทุนทางวัฒนธรรมและอัตลักษณ์ท้องถิ่นอย่างมีคุณค่า",
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
		DescriptionTh:       "รางวัลสำหรับโครงการหรือกิจกรรมที่มีความโดดเด่นในการฟื้นฟู ปรับปรุง และพัฒนาพื้นที่ ให้กลับมามีชีวิตชีวา สร้างบรรยากาศใหม่ และต่อยอดสู่การเป็นพื้นที่เศรษฐกิจสร้างสรรค์",
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
		DescriptionTh:       "รางวัลสำหรับความร่วมมือระหว่างภาครัฐ ภาคเอกชน ชุมชน และภาคสร้างสรรค์ ในการพัฒนาเมืองหรือพื้นที่ผ่านแนวคิดสร้างสรรค์ โดยแสดงให้เห็นถึงการผสานศักยภาพของหลายภาคส่วนเพื่อสร้างคุณค่าใหม่ ขับเคลื่อนกิจกรรมทางเศรษฐกิจสร้างสรรค์ และก่อให้เกิดผลลัพธ์ที่เป็นรูปธรรมในระดับพื้นที่",
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
		DescriptionTh:       "รางวัลสำหรับผลงานที่พัฒนาทรัพย์สินทางปัญญา (Intellectual Property: IP) อย่างเป็นระบบ จนสามารถสร้างมูลค่าเชิงเศรษฐกิจ และมีศักยภาพในการต่อยอดสู่แพลตฟอร์ม อุตสาหกรรม หรือบริบทใหม่ ๆ",
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
		DescriptionTh:       "รางวัลสำหรับธุรกิจที่สามารถปรับตัวและยกระดับศักยภาพด้วยการประยุกต์ใช้ความคิดสร้างสรรค์ จนพัฒนาสินค้าหรือบริการที่โดดเด่น มีความสามารถในการแข่งขัน และสร้างผลกระทบเชิงบวกในวงกว้าง",
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
		DescriptionTh:       "รางวัลสำหรับธุรกิจหรือผลงานที่ใช้ “ข้อมูล (Data)” เป็นแกนหลักในการพัฒนาแนวคิด ออกแบบประสบการณ์ หรือสร้างโซลูชันใหม่ โดยผสานการวิเคราะห์ข้อมูลเข้ากับความคิดสร้างสรรค์ เพื่อสร้างคุณค่าในเชิงธุรกิจ สังคม หรือวัฒนธรรม นำไปสู่ผลลัพธ์ที่แตกต่างและสามารถขยายผลได้",
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
		DescriptionTh:       "รางวัลสำหรับแคมเปญที่ใช้ความคิดสร้างสรรค์ในการสื่อสารและขับเคลื่อนธุรกิจ (Marketing-Driven) ผ่านการบูรณาการกลยุทธ์ เนื้อหา และความเข้าใจผู้บริโภค เพื่อสร้างการรับรู้ การมีส่วนร่วม และผลลัพธ์ทางการตลาดอย่างเป็นรูปธรรม",
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
		DescriptionTh:       "รางวัลสำหรับผลงานที่ใช้ความคิดสร้างสรรค์และนวัตกรรมในการออกแบบประสบการณ์เชิงพาณิชย์ (Commerce Experience) โดยเชื่อมโยงผู้บริโภคกับแบรนด์อย่างมีประสิทธิภาพในทุกจุดสัมผัส โดยยึดลูกค้าเป็นศูนย์กลาง (Customer-Centric) เพื่อขับเคลื่อนการตัดสินใจซื้อ และสร้างความสัมพันธ์ระยะยาวอย่างยั่งยืน",
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
	{
		Code:                "4.1",
		Slug:                "creative-company-of-the-year",
		Name:                "Thailand's Most Creative Company of the Year",
		Group:               demoGroupHallOfFame,
		Description:         "For public agencies, state enterprises, non-profits, or private organizations that use creativity as a key mechanism to shape their vision, strategy, and operations, creating outstanding value and positive impact on the economy, society, or the environment — and serving as a role model for the organization of the future.",
		DescriptionTh:       "รางวัลสำหรับองค์กรภาครัฐ รัฐวิสาหกิจ องค์กรไม่แสวงหากำไร หรือภาคเอกชน ที่ใช้ความคิดสร้างสรรค์เป็นกลไกสำคัญในการกำหนดวิสัยทัศน์ กลยุทธ์ และการดำเนินงาน จนสามารถสร้างคุณค่าและผลกระทบเชิงบวกต่อเศรษฐกิจ สังคม หรือสิ่งแวดล้อมได้อย่างโดดเด่น และเป็นต้นแบบขององค์กรแห่งอนาคต",
		CreativeFocus:       "uses creativity as a core mechanism to set its vision, strategy, and operating model rather than as a surface-level activity",
		ExecutionFocus:      "embeds creative ways of working across leadership, teams, and day-to-day delivery so the culture itself is demonstrably creative",
		ImpactFocus:         "creates standout, lasting value and positive impact across the economy, society, or the environment",
		SustainabilityFocus: "stands as a future-facing role model that other organizations can credibly learn from and follow",
		Projects: []demoProjectSeed{
			{Slug: "future-state-enterprise", Title: "Future State Enterprise", ShortDescription: "A national enterprise that rebuilt its strategy, services, and culture around creative problem-solving across every division.", ConceptFocus: "organization-wide creativity into durable competitive advantage", DesignerName: "Group Strategy Office", TeamName: "Future State Co."},
			{Slug: "open-innovation-house", Title: "Open Innovation House", ShortDescription: "A public-sector body that turned rigid processes into an open innovation engine partnering with startups, students, and communities.", ConceptFocus: "institutional reform into a model creative organization", DesignerName: "Transformation Unit", TeamName: "Open Innovation House"},
		},
	},
	{
		Code:                "4.2",
		Slug:                "creative-brand-of-the-year",
		Name:                "Thailand's Most Creative Brand of the Year",
		Group:               demoGroupHallOfFame,
		Description:         "For brands that use creativity to build value, distinctiveness, and meaningful relationships with people, generating positive social impact and serving as a model for brand-building in a new era.",
		DescriptionTh:       "รางวัลสำหรับแบรนด์ที่ใช้ความคิดสร้างสรรค์ในการสร้างคุณค่า ความแตกต่าง ความสัมพันธ์ที่มีความหมายกับผู้คน จนสามารถสร้างผลกระทบเชิงบวกต่อสังคม และเป็นต้นแบบของการสร้างแบรนด์ในยุคใหม่",
		CreativeFocus:       "uses creativity to build distinctive value, meaning, and a genuine relationship with people",
		ExecutionFocus:      "expresses that creativity consistently across products, communication, and customer experience",
		ImpactFocus:         "generates positive social impact and cultural relevance beyond commercial performance alone",
		SustainabilityFocus: "sets the template for how brands should be built in a new era and can sustain that leadership over time",
		Projects: []demoProjectSeed{
			{Slug: "brand-with-meaning", Title: "Brand With Meaning", ShortDescription: "A consumer brand that grew by standing for a clear creative idea and turning every touchpoint into a shared cultural moment.", ConceptFocus: "brand creativity into meaningful customer relationships", DesignerName: "Brand Studio", TeamName: "Meaning Brand Co."},
			{Slug: "everyday-icon", Title: "Everyday Icon", ShortDescription: "A homegrown brand that reinvented an ordinary category through bold design language and socially conscious storytelling.", ConceptFocus: "design-led branding into nationwide cultural recognition", DesignerName: "Creative Direction Team", TeamName: "Everyday Icon"},
		},
	},
}
