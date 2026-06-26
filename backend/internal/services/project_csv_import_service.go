package services

import (
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
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

	categoryByName := make(map[string]string)
	categoryCount := 0
	for _, category := range categories {
		if category.AwardGroupID == nil || *category.AwardGroupID != awardGroupID {
			continue
		}
		if !category.IsActive {
			continue
		}
		categoryByName[normalizeLookup(category.Name)] = category.ID
		categoryCount++
	}

	existingByKey := make(map[string]models.Project, len(existingProjects))
	for _, project := range existingProjects {
		existingByKey[projectLookupKey(project.CategoryID, project.Title)] = project
	}

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
	headerIndex := make(map[string]int, len(headers))
	for index, header := range headers {
		headerIndex[header] = index
	}

	for _, required := range csvRequiredHeaders {
		if _, exists := headerIndex[required]; !exists {
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

	payloads := make([]models.ProjectPayload, len(pendingRows))
	if err := s.prepareImportedImagesInParallel(ctx, pendingRows, payloads); err != nil {
		return 0, err
	}

	if len(payloads) == 0 {
		return 0, errors.New("csv does not contain any importable project rows")
	}

	return s.repo.CreateProjectsBatch(ctx, payloads)
}

func (s *AdminService) prepareImportedImagesInParallel(
	ctx context.Context,
	rows []pendingImportRow,
	out []models.ProjectPayload,
) error {
	workerCount := min(maxParallelImageImports, len(rows))
	if workerCount <= 0 {
		return nil
	}
	workerCount = min(workerCount, runtime.NumCPU())
	if workerCount < 1 {
		workerCount = 1
	}

	type job struct {
		index int
		row   pendingImportRow
	}

	jobs := make(chan job)
	var wg sync.WaitGroup

	for i := 0; i < workerCount; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for current := range jobs {
				payload := current.row.payload
				payload.ImageURL, payload.ImageSourceURL = s.prepareImportedImage(
					ctx,
					payload.ImageURL,
					current.row.hasExisting,
					current.row.existingProj,
				)
				out[current.index] = payload
			}
		}()
	}

	for index, row := range rows {
		select {
		case <-ctx.Done():
			close(jobs)
			wg.Wait()
			return ctx.Err()
		case jobs <- job{index: index, row: row}:
		}
	}

	close(jobs)
	wg.Wait()

	if err := ctx.Err(); err != nil {
		return err
	}

	return nil
}

func (s *AdminService) prepareImportedImage(ctx context.Context, rawURL string, hasExisting bool, existing models.Project) (string, string) {
	sourceURL := normalizeText(rawURL)
	if sourceURL == "" {
		return "", ""
	}

	if hasExisting && normalizeText(existing.ImageSourceURL) == sourceURL {
		return existing.ImageURL, existing.ImageSourceURL
	}

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
	return strings.ToLower(strings.Join(strings.Fields(normalizeText(value)), " "))
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
