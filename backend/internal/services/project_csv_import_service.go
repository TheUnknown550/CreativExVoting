package services

import (
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"strings"

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

func (s *AdminService) ImportProjectsCSV(ctx context.Context, awardGroupID string, file io.Reader) (int, error) {
	if awardGroupID == "" {
		return 0, errors.New("award group is required")
	}

	categories, err := s.repo.ListCategories(ctx)
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

	payloads := make([]models.ProjectPayload, 0, len(rows)-1)
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

		payloads = append(payloads, payload)
	}

	if len(payloads) == 0 {
		return 0, errors.New("csv does not contain any importable project rows")
	}

	return s.repo.CreateProjectsBatch(ctx, payloads)
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
