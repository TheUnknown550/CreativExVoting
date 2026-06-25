package handlers

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"

	chimw "github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"creativexvoting/backend/internal/models"
	"creativexvoting/backend/internal/services"
	"creativexvoting/backend/internal/utils"
)

type AdminHandler struct {
	adminService  *services.AdminService
	importService *services.GoogleSheetsImportService
	imageService  *services.ImageService
}

func NewAdminHandler(adminService *services.AdminService, importService *services.GoogleSheetsImportService, imageService *services.ImageService) *AdminHandler {
	return &AdminHandler{
		adminService:  adminService,
		importService: importService,
		imageService:  imageService,
	}
}

func (h *AdminHandler) UploadImage(w http.ResponseWriter, r *http.Request) {
	file, _, err := r.FormFile("file")
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "missing file")
		return
	}
	defer file.Close()

	url, err := h.imageService.Save(file)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.Success(w, http.StatusOK, map[string]string{"url": url})
}

func (h *AdminHandler) Dashboard(w http.ResponseWriter, r *http.Request) {
	stats, err := h.adminService.Dashboard(r.Context())
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	utils.Success(w, http.StatusOK, stats)
}

func (h *AdminHandler) ListAwardGroups(w http.ResponseWriter, r *http.Request) {
	groups, err := h.adminService.ListAwardGroups(r.Context())
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	utils.Success(w, http.StatusOK, ensureSlice(groups))
}

func (h *AdminHandler) ListCategories(w http.ResponseWriter, r *http.Request) {
	categories, err := h.adminService.ListCategories(r.Context())
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	utils.Success(w, http.StatusOK, ensureSlice(categories))
}

func (h *AdminHandler) CreateCategory(w http.ResponseWriter, r *http.Request) {
	var payload models.CategoryPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	category, err := h.adminService.CreateCategory(r.Context(), payload)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	utils.Success(w, http.StatusCreated, category)
}

func (h *AdminHandler) UpdateCategory(w http.ResponseWriter, r *http.Request) {
	var payload models.CategoryPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	category, err := h.adminService.UpdateCategory(r.Context(), chimw.URLParam(r, "id"), payload)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	utils.Success(w, http.StatusOK, category)
}

func (h *AdminHandler) DeleteCategory(w http.ResponseWriter, r *http.Request) {
	if err := h.adminService.DeleteCategory(r.Context(), chimw.URLParam(r, "id")); err != nil {
		utils.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	utils.Success(w, http.StatusOK, map[string]string{"message": "category deactivated"})
}

func (h *AdminHandler) ListProjects(w http.ResponseWriter, r *http.Request) {
	projects, err := h.adminService.ListProjects(r.Context(), r.URL.Query().Get("category_id"), r.URL.Query().Get("search"))
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	utils.Success(w, http.StatusOK, ensureSlice(projects))
}

func (h *AdminHandler) CreateProject(w http.ResponseWriter, r *http.Request) {
	var payload models.ProjectPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	project, err := h.adminService.CreateProject(r.Context(), payload)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	utils.Success(w, http.StatusCreated, project)
}

func (h *AdminHandler) UpdateProject(w http.ResponseWriter, r *http.Request) {
	var payload models.ProjectPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	project, err := h.adminService.UpdateProject(r.Context(), chimw.URLParam(r, "id"), payload)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	utils.Success(w, http.StatusOK, project)
}

func (h *AdminHandler) DeleteProject(w http.ResponseWriter, r *http.Request) {
	if err := h.adminService.DeleteProject(r.Context(), chimw.URLParam(r, "id")); err != nil {
		utils.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	utils.Success(w, http.StatusOK, map[string]string{"message": "project deactivated"})
}

func (h *AdminHandler) ListCriteria(w http.ResponseWriter, r *http.Request) {
	criteria, err := h.adminService.ListCriteria(r.Context(), r.URL.Query().Get("category_id"))
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	utils.Success(w, http.StatusOK, ensureSlice(criteria))
}

func (h *AdminHandler) CreateCriterion(w http.ResponseWriter, r *http.Request) {
	var payload models.CriterionPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	criterion, err := h.adminService.CreateCriterion(r.Context(), payload)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	utils.Success(w, http.StatusCreated, criterion)
}

func (h *AdminHandler) UpdateCriterion(w http.ResponseWriter, r *http.Request) {
	var payload models.CriterionPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	criterion, err := h.adminService.UpdateCriterion(r.Context(), chimw.URLParam(r, "id"), payload)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	utils.Success(w, http.StatusOK, criterion)
}

func (h *AdminHandler) DeleteCriterion(w http.ResponseWriter, r *http.Request) {
	if err := h.adminService.DeleteCriterion(r.Context(), chimw.URLParam(r, "id")); err != nil {
		utils.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	utils.Success(w, http.StatusOK, map[string]string{"message": "criterion deactivated"})
}

func (h *AdminHandler) ListJudges(w http.ResponseWriter, r *http.Request) {
	judges, err := h.adminService.ListJudges(r.Context())
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	utils.Success(w, http.StatusOK, ensureSlice(judges))
}

func (h *AdminHandler) CreateJudge(w http.ResponseWriter, r *http.Request) {
	var payload models.JudgePayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	user, err := h.adminService.CreateJudge(r.Context(), payload)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	utils.Success(w, http.StatusCreated, user)
}

func (h *AdminHandler) UpdateJudge(w http.ResponseWriter, r *http.Request) {
	var payload models.JudgePayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	user, err := h.adminService.UpdateJudge(r.Context(), chimw.URLParam(r, "id"), payload)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	utils.Success(w, http.StatusOK, user)
}

func (h *AdminHandler) DeleteJudge(w http.ResponseWriter, r *http.Request) {
	if err := h.adminService.DeleteJudge(r.Context(), chimw.URLParam(r, "id")); err != nil {
		utils.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	utils.Success(w, http.StatusOK, map[string]string{"message": "judge deactivated"})
}

func (h *AdminHandler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var payload models.ResetPasswordPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.adminService.ResetPassword(r.Context(), chimw.URLParam(r, "id"), payload.Password); err != nil {
		utils.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	utils.Success(w, http.StatusOK, map[string]string{"message": "password reset"})
}

func (h *AdminHandler) GetJudgeAssignments(w http.ResponseWriter, r *http.Request) {
	assignments, err := h.adminService.GetJudgeAssignments(r.Context(), chimw.URLParam(r, "id"))
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	utils.Success(w, http.StatusOK, ensureStrings(assignments))
}

func (h *AdminHandler) ReplaceJudgeAssignments(w http.ResponseWriter, r *http.Request) {
	var payload models.AssignmentPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.adminService.ReplaceJudgeAssignments(r.Context(), chimw.URLParam(r, "id"), payload.GroupIDs); err != nil {
		utils.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	utils.Success(w, http.StatusOK, map[string]string{"message": "assignments updated"})
}

func (h *AdminHandler) DeleteJudgeAssignment(w http.ResponseWriter, r *http.Request) {
	if err := h.adminService.DeleteJudgeAssignment(r.Context(), chimw.URLParam(r, "id"), chimw.URLParam(r, "group_id")); err != nil {
		utils.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	utils.Success(w, http.StatusOK, map[string]string{"message": "assignment removed"})
}

func (h *AdminHandler) Results(w http.ResponseWriter, r *http.Request) {
	response, err := h.adminService.Results(r.Context(), r.URL.Query().Get("category_id"), r.URL.Query().Get("judge_id"))
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	utils.Success(w, http.StatusOK, ensureResults(response))
}

func (h *AdminHandler) ExportResults(w http.ResponseWriter, r *http.Request) {
	rows, err := h.adminService.ExportResults(r.Context(), r.URL.Query().Get("category_id"), r.URL.Query().Get("judge_id"))
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", `attachment; filename="voting-results.csv"`)

	writer := csv.NewWriter(w)
	defer writer.Flush()

	_ = writer.Write([]string{
		"category",
		"project title",
		"judge name",
		"criterion name",
		"criterion score",
		"project total score by judge",
		"project total score overall",
		"average score",
	})

	for _, row := range rows {
		_ = writer.Write([]string{
			row.Category,
			row.ProjectTitle,
			row.JudgeName,
			row.CriterionName,
			intToString(row.CriterionScore),
			intToString(row.ProjectTotalByJudge),
			intToString(row.ProjectTotalOverall),
			floatToString(row.AverageScore),
		})
	}
}

func (h *AdminHandler) ProjectVoteDetail(w http.ResponseWriter, r *http.Request) {
	detail, err := h.adminService.ProjectVoteDetail(r.Context(), chimw.URLParam(r, "id"))
	if err != nil {
		if err == pgx.ErrNoRows {
			utils.Error(w, http.StatusNotFound, "project not found")
			return
		}
		utils.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	utils.Success(w, http.StatusOK, detail)
}

func (h *AdminHandler) ImportGoogleSheets(w http.ResponseWriter, r *http.Request) {
	utils.Error(w, http.StatusNotImplemented, "not implemented yet")
}

func intToString(value int) string {
	return fmt.Sprintf("%d", value)
}

func floatToString(value float64) string {
	return fmt.Sprintf("%.2f", value)
}
