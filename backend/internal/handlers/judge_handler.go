package handlers

import (
	"encoding/json"
	"net/http"

	chimw "github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"creativexvoting/backend/internal/middleware"
	"creativexvoting/backend/internal/models"
	"creativexvoting/backend/internal/services"
	"creativexvoting/backend/internal/utils"
)

type JudgeHandler struct {
	service *services.JudgeService
}

func NewJudgeHandler(service *services.JudgeService) *JudgeHandler {
	return &JudgeHandler{service: service}
}

func (h *JudgeHandler) Categories(w http.ResponseWriter, r *http.Request) {
	user := middleware.CurrentUser(r.Context())
	categories, err := h.service.Categories(r.Context(), user.ID)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	utils.Success(w, http.StatusOK, categories)
}

func (h *JudgeHandler) Projects(w http.ResponseWriter, r *http.Request) {
	user := middleware.CurrentUser(r.Context())
	projects, err := h.service.Projects(r.Context(), user.ID, r.URL.Query().Get("category_id"))
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	utils.Success(w, http.StatusOK, projects)
}

func (h *JudgeHandler) ProjectDetail(w http.ResponseWriter, r *http.Request) {
	user := middleware.CurrentUser(r.Context())
	projectID := chimw.URLParam(r, "id")

	detail, err := h.service.ProjectDetail(r.Context(), user.ID, projectID)
	if err != nil {
		if err == pgx.ErrNoRows {
			utils.Error(w, http.StatusForbidden, "project not found or not assigned")
			return
		}
		utils.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	utils.Success(w, http.StatusOK, detail)
}

func (h *JudgeHandler) MyVote(w http.ResponseWriter, r *http.Request) {
	user := middleware.CurrentUser(r.Context())
	projectID := chimw.URLParam(r, "id")

	vote, err := h.service.MyVote(r.Context(), user.ID, projectID)
	if err != nil {
		if err == pgx.ErrNoRows {
			utils.Success(w, http.StatusOK, nil)
			return
		}
		utils.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	utils.Success(w, http.StatusOK, vote)
}

func (h *JudgeHandler) SubmitVote(w http.ResponseWriter, r *http.Request) {
	user := middleware.CurrentUser(r.Context())
	projectID := chimw.URLParam(r, "id")

	var payload models.VoteSubmissionRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	vote, err := h.service.SubmitVote(r.Context(), user.ID, projectID, payload)
	if err != nil {
		if err == pgx.ErrNoRows {
			utils.Error(w, http.StatusForbidden, "project not found or not assigned")
			return
		}
		utils.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.Success(w, http.StatusOK, vote)
}

func (h *JudgeHandler) Summary(w http.ResponseWriter, r *http.Request) {
	user := middleware.CurrentUser(r.Context())
	summary, err := h.service.Summary(r.Context(), user.ID, r.URL.Query().Get("category_id"))
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	utils.Success(w, http.StatusOK, summary)
}
