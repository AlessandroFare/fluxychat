package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Audit F-93: the resources removed themselves from state on any API error —
// a transient 5xx or network blip made Terraform forget (and re-create) live
// resources. Only a confirmed absence removes state.
var errResourceNotFound = errors.New("resource not found")

// validateWorkerURL rejects plain-HTTP Worker URLs: every call carries the
// admin JWT, so http would put the token on the wire in clear. Localhost is
// allowed for local development.
func validateWorkerURL(raw string) (string, error) {
	trimmed := strings.TrimRight(strings.TrimSpace(raw), "/")
	parsed, err := url.Parse(trimmed)
	if err != nil || parsed.Host == "" {
		return "", fmt.Errorf("worker_url must be an absolute URL, got %q", raw)
	}
	if parsed.Scheme == "https" {
		return trimmed, nil
	}
	if parsed.Scheme == "http" {
		switch parsed.Hostname() {
		case "localhost", "127.0.0.1", "::1":
			return trimmed, nil
		}
		return "", fmt.Errorf("worker_url must use https (http is only allowed for localhost): %q", raw)
	}
	return "", fmt.Errorf("worker_url must use https, got scheme %q", parsed.Scheme)
}

// validateWebhookURL keeps registrations to real https endpoints (localhost
// http allowed for local receivers).
func validateWebhookURL(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	parsed, err := url.Parse(trimmed)
	if err != nil || parsed.Host == "" {
		return "", fmt.Errorf("url must be an absolute URL, got %q", raw)
	}
	if parsed.Scheme == "https" {
		return trimmed, nil
	}
	if parsed.Scheme == "http" {
		switch parsed.Hostname() {
		case "localhost", "127.0.0.1", "::1":
			return trimmed, nil
		}
	}
	return "", fmt.Errorf("url must use https (http is only allowed for localhost): %q", raw)
}

type apiClient struct {
	workerURL string
	adminJWT  string
	http      *http.Client
}

func newAPIClient(workerURL, adminJWT string) *apiClient {
	return &apiClient{
		workerURL: strings.TrimRight(workerURL, "/"),
		adminJWT:  adminJWT,
		http: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

type projectRecord struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Plan string `json:"plan,omitempty"`
}

func (c *apiClient) createProject(ctx context.Context, name string) (projectRecord, error) {
	body, _ := json.Marshal(map[string]string{"name": name})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.workerURL+"/admin/projects", bytes.NewReader(body))
	if err != nil {
		return projectRecord{}, err
	}
	req.Header.Set("Authorization", "Bearer "+c.adminJWT)
	req.Header.Set("Content-Type", "application/json")

	res, err := c.http.Do(req)
	if err != nil {
		return projectRecord{}, err
	}
	defer res.Body.Close()

	raw, _ := io.ReadAll(res.Body)
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return projectRecord{}, fmt.Errorf("create project failed: HTTP %d: %s", res.StatusCode, string(raw))
	}

	var payload struct {
		Project projectRecord `json:"project"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return projectRecord{}, err
	}
	if payload.Project.ID == "" {
		return projectRecord{}, fmt.Errorf("create project: missing id in response")
	}
	return payload.Project, nil
}

func (c *apiClient) getProject(ctx context.Context, id string) (projectRecord, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.workerURL+"/admin/projects", nil)
	if err != nil {
		return projectRecord{}, err
	}
	req.Header.Set("Authorization", "Bearer "+c.adminJWT)

	res, err := c.http.Do(req)
	if err != nil {
		return projectRecord{}, err
	}
	defer res.Body.Close()

	raw, _ := io.ReadAll(res.Body)
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return projectRecord{}, fmt.Errorf("list projects failed: HTTP %d: %s", res.StatusCode, string(raw))
	}

	var payload struct {
		Projects []projectRecord `json:"projects"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return projectRecord{}, err
	}
	for _, p := range payload.Projects {
		if p.ID == id {
			return p, nil
		}
	}
	return projectRecord{}, fmt.Errorf("project %q: %w", id, errResourceNotFound)
}

type webhookRecord struct {
	ID         string `json:"id"`
	ProjectID  string `json:"project_id"`
	URL        string `json:"url"`
	EventTypes string `json:"event_types"`
	CreatedAt  string `json:"created_at"`
}

func parseWebhookEventTypes(raw string) []string {
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

func (c *apiClient) createWebhook(ctx context.Context, url string, eventTypes []string, secret string) (webhookRecord, error) {
	payload := map[string]any{
		"url":         url,
		"eventTypes":  eventTypes,
	}
	if secret != "" {
		payload["secret"] = secret
	}
	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.workerURL+"/webhooks/register", bytes.NewReader(body))
	if err != nil {
		return webhookRecord{}, err
	}
	req.Header.Set("Authorization", "Bearer "+c.adminJWT)
	req.Header.Set("Content-Type", "application/json")

	res, err := c.http.Do(req)
	if err != nil {
		return webhookRecord{}, err
	}
	defer res.Body.Close()

	raw, _ := io.ReadAll(res.Body)
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return webhookRecord{}, fmt.Errorf("create webhook failed: HTTP %d: %s", res.StatusCode, string(raw))
	}

	var response struct {
		Webhook struct {
			ID        string `json:"id"`
			ProjectID string `json:"projectId"`
			URL       string `json:"url"`
		} `json:"webhook"`
	}
	if err := json.Unmarshal(raw, &response); err != nil {
		return webhookRecord{}, err
	}
	if response.Webhook.ID == "" {
		return webhookRecord{}, fmt.Errorf("create webhook: missing id in response")
	}
	return webhookRecord{
		ID:         response.Webhook.ID,
		ProjectID:  response.Webhook.ProjectID,
		URL:        response.Webhook.URL,
		EventTypes: strings.Join(eventTypes, ","),
	}, nil
}

func (c *apiClient) getWebhook(ctx context.Context, id string) (webhookRecord, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.workerURL+"/admin/webhooks", nil)
	if err != nil {
		return webhookRecord{}, err
	}
	req.Header.Set("Authorization", "Bearer "+c.adminJWT)

	res, err := c.http.Do(req)
	if err != nil {
		return webhookRecord{}, err
	}
	defer res.Body.Close()

	raw, _ := io.ReadAll(res.Body)
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return webhookRecord{}, fmt.Errorf("list webhooks failed: HTTP %d: %s", res.StatusCode, string(raw))
	}

	var payload struct {
		Webhooks []webhookRecord `json:"webhooks"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return webhookRecord{}, err
	}
	for _, webhook := range payload.Webhooks {
		if webhook.ID == id {
			return webhook, nil
		}
	}
	return webhookRecord{}, fmt.Errorf("webhook %q: %w", id, errResourceNotFound)
}

func (c *apiClient) updateWebhook(ctx context.Context, id, url string, eventTypes []string, secret string) error {
	payload := map[string]any{}
	if url != "" {
		payload["url"] = url
	}
	if len(eventTypes) > 0 {
		payload["eventTypes"] = eventTypes
	}
	if secret != "" {
		payload["secret"] = secret
	}
	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPatch, c.workerURL+"/webhooks/"+id, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.adminJWT)
	req.Header.Set("Content-Type", "application/json")

	res, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	raw, _ := io.ReadAll(res.Body)
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("update webhook failed: HTTP %d: %s", res.StatusCode, string(raw))
	}
	return nil
}

func (c *apiClient) deleteWebhook(ctx context.Context, id string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, c.workerURL+"/webhooks/"+id, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.adminJWT)

	res, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	raw, _ := io.ReadAll(res.Body)
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("delete webhook failed: HTTP %d: %s", res.StatusCode, string(raw))
	}
	return nil
}
