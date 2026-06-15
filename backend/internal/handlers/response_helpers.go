package handlers

import "creativexvoting/backend/internal/models"

func ensureSlice[T any](items []T) []T {
	if items == nil {
		return []T{}
	}
	return items
}

func ensureStrings(items []string) []string {
	if items == nil {
		return []string{}
	}
	return items
}

func ensureResults(response models.ResultsResponse) models.ResultsResponse {
	response.Rankings = ensureSlice(response.Rankings)
	response.JudgeVotes = ensureSlice(response.JudgeVotes)
	return response
}
