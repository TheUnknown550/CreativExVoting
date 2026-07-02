package services

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"path"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"time"

	"creativexvoting/backend/internal/models"
)

const (
	csvHeaderNumber    = "NO."
	csvHeaderAward     = "Award"
	csvHeaderTitle     = "ชื่อผลงาน"
	csvHeaderOwner     = "เจ้าของผลงาน"
	csvHeaderDesigner  = "ผู้ออกแบบผลงาน"
	csvHeaderSocial    = "Social media channels"
	csvHeaderObjective = "วัตถุประสงค์หรือกรอบความร่วมมือ"
	csvHeaderProcess   = "กระบวนการออกแบบ/แนวทางการสร้างสรรค์ผลงาน"
	csvHeaderImpact    = "ผลกระทบต่อเศรษฐกิจ สังคม และความยั่งยืน"
	csvHeaderDrive     = "ผลงาน"
	csvHeaderImage     = "รูปภาพ"

	hofHeaderCompanyName     = "ชื่อองค์กร"
	hofHeaderBrandName       = "ชื่อแบรนด์"
	hofHeaderDescription     = "รายละเอียด"
	hofHeaderDescriptionTypo = "รายละเอียก"
	hofHeaderLogo            = "โลโก้"
	hofHeaderNotes           = "หมายเหตุ"
	hofHeaderLink1           = "Link 1"
	hofHeaderLink2           = "Link 2"
	hofHeaderLink3           = "Link 3"
	hofHeaderLink4           = "Link 4"
	hofHeaderLink5           = "Link 5"
)

var csvRequiredHeaders = []string{
	csvHeaderAward,
	csvHeaderTitle,
	csvHeaderOwner,
	csvHeaderDesigner,
	csvHeaderObjective,
	csvHeaderProcess,
	csvHeaderImpact,
	csvHeaderDrive,
	csvHeaderImage,
}

var googleDriveFilePattern = regexp.MustCompile(`/file/d/([^/]+)`)

const maxParallelImageImports = 6

type hallOfFameSectionSpec struct {
	Key     string
	TitleTh string
	TitleEn string
}

var hallOfFameCompanySections = []hallOfFameSectionSpec{
	{Key: models.HallOfFameResilienceSectionKey, TitleTh: "ความคิดสร้างสรรค์ในการฝ่าอุปสรรค", TitleEn: "Creativity in overcoming obstacles"},
	{Key: models.HallOfFameTechnologySectionKey, TitleTh: "ขยายขอบเขตความคิดสร้างสรรค์ด้วยเทคโนโลยี", TitleEn: "Expanding creativity with technology"},
	{Key: models.HallOfFameTransparencySectionKey, TitleTh: "ความคิดสร้างสรรค์บนความโปร่งใสที่จับต้องได้", TitleEn: "Creativity through tangible transparency"},
	{Key: models.HallOfFameOpportunitySectionKey, TitleTh: "ความคิดสร้างสรรค์เพื่อเปิดโอกาสให้คนอื่น", TitleEn: "Creativity that opens opportunities for others"},
	{Key: models.HallOfFameOwnershipSectionKey, TitleTh: "ความคิดสร้างสรรค์ที่สร้างความเป็นเจ้าของ", TitleEn: "Creativity that builds ownership"},
}

var hallOfFameBrandSections = []hallOfFameSectionSpec{
	{Key: models.HallOfFameResilienceSectionKey, TitleTh: "ความคิดสร้างสรรค์ในการฝ่าอุปสรรค", TitleEn: "Creativity in overcoming obstacles"},
	{Key: models.HallOfFameTechnologySectionKey, TitleTh: "ขยายขอบเขตความคิดสร้างสรรค์ด้วยเทคโนโลยี", TitleEn: "Expanding creativity with technology"},
	{Key: models.HallOfFameTransparencySectionKey, TitleTh: "ความคิดสร้างสรรค์บนความโปร่งใสที่จับต้องได้", TitleEn: "Creativity through tangible transparency"},
	{Key: models.HallOfFameOpportunitySectionKey, TitleTh: "ความคิดสร้างสรรค์เพื่อเปิดโอกาสให้คนอื่น", TitleEn: "Creativity that opens opportunities for others"},
	{Key: models.HallOfFameOwnershipSectionKey, TitleTh: "ความคิดสร้างสรรค์ที่สร้างความเป็นเจ้าของ", TitleEn: "Creativity that builds ownership"},
}

type pendingImportRow struct {
	payload      models.ProjectPayload
	hasExisting  bool
	existingProj models.Project
}

func (s *AdminService) ImportProjectsCSV(ctx context.Context, awardGroupID string, file io.Reader) (int, error) {
	if awardGroupID == "" {
		return 0, errors.New("award group is required")
	}

	categories, err := s.repo.ListCategories(ctx)
	if err != nil {
		return 0, err
	}
	existingProjects, err := s.repo.ListProjects(ctx, "", "")
	if err != nil {
		return 0, err
	}

	categoryByName, categoryCount := buildGroupedCategoryMap(categories, awardGroupID)
	existingByKey := buildExistingProjectMap(existingProjects)

	if categoryCount == 0 {
		return 0, errors.New("no active categories found for the selected award group")
	}

	reader := csv.NewReader(file)
	reader.FieldsPerRecord = -1
	rows, err := reader.ReadAll()
	if err != nil {
		return 0, fmt.Errorf("invalid csv: %w", err)
	}
	if len(rows) < 2 {
		return 0, errors.New("csv must include a header row and at least one project row")
	}

	headers := sanitizeHeaders(rows[0])
	if detectHallOfFameCSV(headers) {
		return s.importHallOfFameCSV(ctx, headers, rows[1:], categoryByName, existingByKey)
	}

	for _, required := range csvRequiredHeaders {
		if !hasHeader(headers, required) {
			return 0, fmt.Errorf("csv is missing required column %q", required)
		}
	}

	pendingRows := make([]pendingImportRow, 0, len(rows)-1)
	for rowIndex, rawRow := range rows[1:] {
		record := rowValuesByHeader(headers, rawRow)
		if rowIsEmpty(record) {
			continue
		}

		awardName := record[csvHeaderAward]
		if awardName == "" {
			continue
		}

		categoryID, exists := categoryByName[normalizeLookup(awardName)]
		if !exists {
			return 0, fmt.Errorf("row %d: category %q does not belong to the selected award group", rowIndex+2, awardName)
		}

		payload := models.ProjectPayload{
			CategoryID:       categoryID,
			Title:            normalizeText(record[csvHeaderTitle]),
			ShortDescription: normalizeText(record[csvHeaderObjective]),
			FullDescription:  normalizeText(record[csvHeaderProcess]),
			Concept:          normalizeText(record[csvHeaderImpact]),
			DesignerName:     normalizeText(record[csvHeaderDesigner]),
			TeamName:         normalizeText(record[csvHeaderOwner]),
			ImageURL:         normalizeText(record[csvHeaderImage]),
			SocialMediaLink:  normalizeText(record[csvHeaderSocial]),
			DriveLink:        normalizeText(record[csvHeaderDrive]),
			ExtraDetails:     buildExtraDetails(headers, record),
			SpecialDetails:   "",
			IsActive:         true,
		}

		if payload.Title == "" {
			return 0, fmt.Errorf("row %d: project title is required", rowIndex+2)
		}
		if err := validateProjectPayload(payload); err != nil {
			return 0, fmt.Errorf("row %d: %w", rowIndex+2, err)
		}

		existingProject, hasExisting := existingByKey[projectLookupKey(payload.CategoryID, payload.Title)]
		pendingRows = append(pendingRows, pendingImportRow{
			payload:      payload,
			hasExisting:  hasExisting,
			existingProj: existingProject,
		})
	}

	return s.importPendingRows(ctx, pendingRows, "csv does not contain any importable project rows")
}

func (s *AdminService) importHallOfFameCSV(
	ctx context.Context,
	headers []string,
	rows [][]string,
	categoryByName map[string]string,
	existingByKey map[string]models.Project,
) (int, error) {
	variant, categoryName, sectionSpecs, entityHeader, entityLabelTh, entityLabelEn := detectHallOfFameVariant(headers)
	if variant == "" {
		return 0, errors.New("unable to determine hall of fame csv variant")
	}

	categoryID, exists := categoryByName[normalizeLookup(categoryName)]
	if !exists {
		return 0, fmt.Errorf("no active category found for hall of fame variant %q", variant)
	}

	pendingRows := make([]pendingImportRow, 0, len(rows))
	for rowIndex, rawRow := range rows {
		record := rowValuesByHeader(headers, rawRow)
		if rowIsEmpty(record) {
			continue
		}

		title := normalizeText(record[entityHeader])
		if title == "" {
			continue
		}

		description := headerValue(record, hofHeaderDescription, hofHeaderDescriptionTypo)
		if description == "" {
			return 0, fmt.Errorf("row %d: hall of fame description is required", rowIndex+2)
		}

		links := []string{
			normalizeOptionalLink(record[hofHeaderLink1]),
			normalizeOptionalLink(record[hofHeaderLink2]),
			normalizeOptionalLink(record[hofHeaderLink3]),
			normalizeOptionalLink(record[hofHeaderLink4]),
			normalizeOptionalLink(record[hofHeaderLink5]),
		}

		sections := make([]models.HallOfFameSection, 0, len(sectionSpecs))
		for index, spec := range sectionSpecs {
			content := normalizeText(record[spec.TitleTh])
			if content == "" {
				return 0, fmt.Errorf("row %d: hall of fame section %q is required", rowIndex+2, spec.TitleTh)
			}

			link := ""
			if index < len(links) {
				link = links[index]
			}

			sections = append(sections, models.HallOfFameSection{
				Key:     spec.Key,
				TitleTh: spec.TitleTh,
				TitleEn: spec.TitleEn,
				Content: content,
				Link:    link,
			})
		}

		details := models.HallOfFameDetails{
			Variant:            variant,
			EntityLabelTh:      entityLabelTh,
			EntityLabelEn:      entityLabelEn,
			DescriptionLabelTh: "คำอธิบาย",
			DescriptionLabelEn: "Description",
			Description:        description,
			Sections:           sections,
			Notes:              normalizeText(record[hofHeaderNotes]),
		}
		detailsJSON, err := json.Marshal(details)
		if err != nil {
			return 0, fmt.Errorf("row %d: unable to encode hall of fame details", rowIndex+2)
		}

		payload := models.ProjectPayload{
			CategoryID:       categoryID,
			Title:            title,
			ShortDescription: description,
			FullDescription:  "",
			Concept:          "",
			DesignerName:     "",
			TeamName:         "",
			ImageURL:         normalizeText(record[hofHeaderLogo]),
			SocialMediaLink:  "",
			DriveLink:        "",
			ExtraDetails:     normalizeText(record[hofHeaderNotes]),
			SpecialDetails:   string(detailsJSON),
			IsActive:         true,
		}

		if err := validateProjectPayload(payload); err != nil {
			return 0, fmt.Errorf("row %d: %w", rowIndex+2, err)
		}

		existingProject, hasExisting := existingByKey[projectLookupKey(payload.CategoryID, payload.Title)]
		pendingRows = append(pendingRows, pendingImportRow{
			payload:      payload,
			hasExisting:  hasExisting,
			existingProj: existingProject,
		})
	}

	return s.importPendingRows(ctx, pendingRows, "csv does not contain any importable hall of fame rows")
}

// imageImportJob is a unit of deferred work: a project that was already
// created/updated in the database but whose image still needs to be fetched.
type imageImportJob struct {
	projectID string
	sourceURL string
}

// importPendingRows creates/updates all rows immediately (fast, DB only) and
// returns as soon as that's done. Any row whose image can't be resolved from
// cache is left with a blank image_url and handed off to a background
// goroutine, so a CSV with many Google-Drive-hosted images can't cause the
// request to time out.
func (s *AdminService) importPendingRows(ctx context.Context, pendingRows []pendingImportRow, emptyMessage string) (int, error) {
	if len(pendingRows) == 0 {
		return 0, errors.New(emptyMessage)
	}

	payloads := make([]models.ProjectPayload, len(pendingRows))
	pendingImageRows := make([]int, 0)

	for i, row := range pendingRows {
		payload := row.payload
		imageURL, imageSourceURL, resolved := cachedImportedImage(payload.ImageURL, row.hasExisting, row.existingProj)
		payload.ImageURL = imageURL
		payload.ImageSourceURL = imageSourceURL
		payloads[i] = payload
		if !resolved {
			pendingImageRows = append(pendingImageRows, i)
		}
	}

	ids, err := s.repo.CreateProjectsBatch(ctx, payloads)
	if err != nil {
		return 0, err
	}

	if len(pendingImageRows) > 0 {
		jobs := make([]imageImportJob, 0, len(pendingImageRows))
		for _, i := range pendingImageRows {
			jobs = append(jobs, imageImportJob{projectID: ids[i], sourceURL: payloads[i].ImageSourceURL})
		}
		go s.resolveImportedImagesAsync(jobs)
	}

	return len(ids), nil
}

// cachedImportedImage resolves a CSV row's image without any network calls.
// resolved is true when nothing further needs to happen: there's no image,
// or an existing project already has a real stored image for this exact
// source URL. The ImageURL != "" check matters because it lets a re-import
// retry a row whose previous background download failed or was interrupted,
// instead of "caching" a permanently blank image.
func cachedImportedImage(rawURL string, hasExisting bool, existing models.Project) (imageURL string, imageSourceURL string, resolved bool) {
	sourceURL := normalizeText(rawURL)
	if sourceURL == "" {
		return "", "", true
	}

	if hasExisting && existing.ImageURL != "" && normalizeText(existing.ImageSourceURL) == sourceURL {
		return existing.ImageURL, existing.ImageSourceURL, true
	}

	return "", sourceURL, false
}

// resolveImportedImagesAsync downloads/validates images for freshly
// imported/updated projects after the import request has already responded.
// It deliberately runs against context.Background(), not the request
// context, so it isn't cut short by the request timeout middleware.
// Failures are logged, not surfaced anywhere, since there's no request left
// to report them to; the affected project simply keeps a blank image until
// a later re-import retries it.
func (s *AdminService) resolveImportedImagesAsync(jobs []imageImportJob) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("csv import: recovered from panic while resolving images: %v", r)
		}
	}()

	ctx := context.Background()

	workerCount := min(maxParallelImageImports, len(jobs))
	workerCount = min(workerCount, runtime.NumCPU())
	if workerCount < 1 {
		workerCount = 1
	}

	jobCh := make(chan imageImportJob)
	var wg sync.WaitGroup

	for i := 0; i < workerCount; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for job := range jobCh {
				imageURL, imageSourceURL := s.prepareImportedImage(ctx, job.sourceURL)
				if imageURL == "" {
					log.Printf("csv import: failed to fetch image for project %s from %q", job.projectID, job.sourceURL)
				}
				if err := s.repo.UpdateProjectImage(ctx, job.projectID, imageURL, imageSourceURL); err != nil {
					log.Printf("csv import: failed to save image for project %s: %v", job.projectID, err)
				}
			}
		}()
	}

	for _, job := range jobs {
		jobCh <- job
	}
	close(jobCh)
	wg.Wait()
}

// prepareImportedImage resolves a single image source URL: it downloads and
// re-encodes Google Drive links, passes direct image URLs through as-is, and
// probes anything else with a HEAD request to check it's actually an image.
func (s *AdminService) prepareImportedImage(ctx context.Context, sourceURL string) (string, string) {
	if isGoogleDriveURL(sourceURL) {
		imageURL, err := s.downloadAndStoreImportedImage(ctx, sourceURL)
		if err != nil {
			return "", sourceURL
		}
		return imageURL, sourceURL
	}

	if isDirectImageURL(sourceURL) {
		return sourceURL, sourceURL
	}

	isImage, err := remoteURLLooksLikeImage(ctx, sourceURL)
	if err != nil {
		return sourceURL, sourceURL
	}
	if isImage {
		return sourceURL, sourceURL
	}

	return "", sourceURL
}

func (s *AdminService) downloadAndStoreImportedImage(ctx context.Context, rawURL string) (string, error) {
	downloadURL, err := toGoogleDriveDownloadURL(rawURL)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, downloadURL, nil)
	if err != nil {
		return "", err
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("download returned status %d", resp.StatusCode)
	}

	savedURL, err := s.imageService.Save(resp.Body)
	if err != nil {
		return "", err
	}

	return savedURL, nil
}

func isGoogleDriveURL(rawURL string) bool {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return false
	}

	host := strings.ToLower(parsed.Host)
	return strings.Contains(host, "drive.google.com")
}

func isDirectImageURL(rawURL string) bool {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return false
	}

	ext := strings.ToLower(path.Ext(parsed.Path))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".avif":
		return true
	default:
		return false
	}
}

func remoteURLLooksLikeImage(ctx context.Context, rawURL string) (bool, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodHead, rawURL, nil)
	if err != nil {
		return false, err
	}

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil || resp == nil {
		return false, nil
	}
	defer resp.Body.Close()

	return strings.HasPrefix(strings.ToLower(resp.Header.Get("Content-Type")), "image/"), nil
}

func toGoogleDriveDownloadURL(rawURL string) (string, error) {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return "", err
	}

	if matches := googleDriveFilePattern.FindStringSubmatch(parsed.Path); len(matches) == 2 {
		return "https://drive.google.com/uc?export=download&id=" + matches[1], nil
	}

	fileID := parsed.Query().Get("id")
	if fileID == "" {
		return "", errors.New("unsupported Google Drive image URL")
	}

	return "https://drive.google.com/uc?export=download&id=" + fileID, nil
}

func buildGroupedCategoryMap(categories []models.Category, awardGroupID string) (map[string]string, int) {
	categoryByName := make(map[string]string)
	categoryCount := 0

	aliases := hallOfFameCategoryAliases()
	for _, category := range categories {
		if category.AwardGroupID == nil || *category.AwardGroupID != awardGroupID {
			continue
		}
		if !category.IsActive {
			continue
		}

		normalizedName := normalizeLookup(category.Name)
		categoryByName[normalizedName] = category.ID
		for alias, canonical := range aliases {
			if normalizeLookup(canonical) == normalizedName {
				categoryByName[normalizeLookup(alias)] = category.ID
			}
		}
		categoryCount++
	}

	return categoryByName, categoryCount
}

func buildExistingProjectMap(existingProjects []models.Project) map[string]models.Project {
	existingByKey := make(map[string]models.Project, len(existingProjects))
	for _, project := range existingProjects {
		existingByKey[projectLookupKey(project.CategoryID, project.Title)] = project
	}
	return existingByKey
}

func projectLookupKey(categoryID string, title string) string {
	return categoryID + "::" + normalizeLookup(title)
}

func sanitizeHeaders(headers []string) []string {
	sanitized := make([]string, 0, len(headers))
	for _, header := range headers {
		header = strings.TrimPrefix(header, "\uFEFF")
		sanitized = append(sanitized, strings.TrimSpace(header))
	}
	return sanitized
}

func hasHeader(headers []string, target string) bool {
	for _, header := range headers {
		if header == target {
			return true
		}
	}
	return false
}

func detectHallOfFameCSV(headers []string) bool {
	return hasHeader(headers, hofHeaderCompanyName) || hasHeader(headers, hofHeaderBrandName)
}

func detectHallOfFameVariant(headers []string) (string, string, []hallOfFameSectionSpec, string, string, string) {
	if hasHeader(headers, hofHeaderCompanyName) {
		return models.HallOfFameCompanyVariant, models.HallOfFameCompanyCategoryName, hallOfFameCompanySections, hofHeaderCompanyName, "ชื่อองค์กร", "Organization Name"
	}
	if hasHeader(headers, hofHeaderBrandName) {
		return models.HallOfFameBrandVariant, models.HallOfFameBrandCategoryName, hallOfFameBrandSections, hofHeaderBrandName, "ชื่อแบรนด์", "Brand Name"
	}
	return "", "", nil, "", "", ""
}

func hallOfFameCategoryAliases() map[string]string {
	return map[string]string{
		models.HallOfFameCompanyCategoryName:    models.HallOfFameCompanyCategoryName,
		models.HallOfFameCompanyImportAliasName: models.HallOfFameCompanyCategoryName,
		models.HallOfFameBrandCategoryName:      models.HallOfFameBrandCategoryName,
		models.HallOfFameBrandImportAliasName:   models.HallOfFameBrandCategoryName,
	}
}

func rowValuesByHeader(headers []string, row []string) map[string]string {
	record := make(map[string]string, len(headers))
	for index, header := range headers {
		if index >= len(row) {
			record[header] = ""
			continue
		}
		record[header] = normalizeText(row[index])
	}
	return record
}

func headerValue(record map[string]string, primary string, aliases ...string) string {
	if value := normalizeText(record[primary]); value != "" {
		return value
	}
	for _, alias := range aliases {
		if value := normalizeText(record[alias]); value != "" {
			return value
		}
	}
	return ""
}

func rowIsEmpty(record map[string]string) bool {
	for _, value := range record {
		if value != "" {
			return false
		}
	}
	return true
}

func normalizeText(value string) string {
	value = strings.ReplaceAll(value, "\r\n", "\n")
	value = strings.ReplaceAll(value, "\r", "\n")
	return strings.TrimSpace(value)
}

func normalizeLookup(value string) string {
	value = strings.ReplaceAll(value, "\u2019", "'")
	value = strings.ReplaceAll(value, "\u2018", "'")
	return strings.ToLower(strings.Join(strings.Fields(normalizeText(value)), " "))
}

func normalizeOptionalLink(value string) string {
	value = normalizeText(value)
	if value == "-" {
		return ""
	}
	return value
}

func buildExtraDetails(headers []string, record map[string]string) string {
	skipped := map[string]struct{}{
		csvHeaderNumber:    {},
		csvHeaderAward:     {},
		csvHeaderTitle:     {},
		csvHeaderOwner:     {},
		csvHeaderDesigner:  {},
		csvHeaderSocial:    {},
		csvHeaderObjective: {},
		csvHeaderProcess:   {},
		csvHeaderImpact:    {},
		csvHeaderDrive:     {},
		csvHeaderImage:     {},
	}

	parts := make([]string, 0, len(headers))
	for _, header := range headers {
		if _, exists := skipped[header]; exists {
			continue
		}

		value := record[header]
		if value == "" {
			continue
		}
		parts = append(parts, fmt.Sprintf("%s: %s", header, value))
	}

	return strings.Join(parts, "\n\n")
}
