package provider

import (
	"context"
	"fmt"
	"strings"

	"github.com/hashicorp/terraform-plugin-framework/path"
	"github.com/hashicorp/terraform-plugin-framework/resource"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/planmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/stringplanmodifier"
	"github.com/hashicorp/terraform-plugin-framework/types"
	"github.com/hashicorp/terraform-plugin-log/tflog"
)

type webhookResource struct {
	client *apiClient
}

type webhookModel struct {
	ID         types.String `tfsdk:"id"`
	URL        types.String `tfsdk:"url"`
	EventTypes types.List   `tfsdk:"event_types"`
	Secret     types.String `tfsdk:"secret"`
	CreatedAt  types.String `tfsdk:"created_at"`
}

func newWebhookResource() resource.Resource {
	return &webhookResource{}
}

func (r *webhookResource) Metadata(_ context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_webhook"
}

func (r *webhookResource) Schema(_ context.Context, _ resource.SchemaRequest, resp *resource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "Registers an outbound FluxyChat webhook via POST /webhooks/register.",
		Attributes: map[string]schema.Attribute{
			"id": schema.StringAttribute{
				Computed:    true,
				Description: "Webhook ID assigned by the Worker.",
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"url": schema.StringAttribute{
				Required:    true,
				Description: "HTTPS endpoint that receives signed webhook payloads.",
			},
			"event_types": schema.ListAttribute{
				ElementType: types.StringType,
				Required:    true,
				Description: "Subscribed event types (see GET /webhooks/event-types).",
			},
			"secret": schema.StringAttribute{
				Optional:    true,
				Sensitive:   true,
				Description: "Optional HMAC signing secret. Updates rotate the secret on PATCH.",
			},
			"created_at": schema.StringAttribute{
				Computed:    true,
				Description: "Creation timestamp from the Worker.",
			},
		},
	}
}

func (r *webhookResource) Configure(_ context.Context, req resource.ConfigureRequest, resp *resource.ConfigureResponse) {
	if req.ProviderData == nil {
		return
	}
	data, ok := req.ProviderData.(*providerData)
	if !ok {
		resp.Diagnostics.AddError("Unexpected provider data", fmt.Sprintf("Expected *providerData, got %T", req.ProviderData))
		return
	}
	r.client = data.client
}

func listToStrings(ctx context.Context, list types.List) ([]string, error) {
	var values []string
	if err := list.ElementsAs(ctx, &values, false); err != nil {
		return nil, err
	}
	out := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			out = append(out, trimmed)
		}
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("event_types must contain at least one value")
	}
	return out, nil
}

func (r *webhookResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var plan webhookModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
	if resp.Diagnostics.HasError() {
		return
	}

	eventTypes, err := listToStrings(ctx, plan.EventTypes)
	if err != nil {
		resp.Diagnostics.AddError("Invalid event_types", err.Error())
		return
	}

	secret := ""
	if !plan.Secret.IsNull() && !plan.Secret.IsUnknown() {
		secret = plan.Secret.ValueString()
	}

	created, err := r.client.createWebhook(ctx, plan.URL.ValueString(), eventTypes, secret)
	if err != nil {
		resp.Diagnostics.AddError("Create webhook failed", err.Error())
		return
	}

	plan.ID = types.StringValue(created.ID)
	plan.CreatedAt = types.StringValue(created.CreatedAt)
	tflog.Info(ctx, "created fluxychat webhook", map[string]interface{}{"id": created.ID})

	resp.Diagnostics.Append(resp.State.Set(ctx, &plan)...)
}

func (r *webhookResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var state webhookModel
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}

	webhook, err := r.client.getWebhook(ctx, state.ID.ValueString())
	if err != nil {
		resp.State.RemoveResource(ctx)
		resp.Diagnostics.AddWarning("Webhook not found", err.Error())
		return
	}

	state.URL = types.StringValue(webhook.URL)
	state.CreatedAt = types.StringValue(webhook.CreatedAt)
	eventValues := parseWebhookEventTypes(webhook.EventTypes)
	eventTypes, diags := types.ListValueFrom(ctx, types.StringType, eventValues)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}
	state.EventTypes = eventTypes

	resp.Diagnostics.Append(resp.State.Set(ctx, &state)...)
}

func (r *webhookResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	var plan webhookModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
	if resp.Diagnostics.HasError() {
		return
	}

	eventTypes, err := listToStrings(ctx, plan.EventTypes)
	if err != nil {
		resp.Diagnostics.AddError("Invalid event_types", err.Error())
		return
	}

	secret := ""
	if !plan.Secret.IsNull() && !plan.Secret.IsUnknown() {
		secret = plan.Secret.ValueString()
	}

	if err := r.client.updateWebhook(ctx, plan.ID.ValueString(), plan.URL.ValueString(), eventTypes, secret); err != nil {
		resp.Diagnostics.AddError("Update webhook failed", err.Error())
		return
	}

	webhook, err := r.client.getWebhook(ctx, plan.ID.ValueString())
	if err != nil {
		resp.Diagnostics.AddError("Read webhook after update failed", err.Error())
		return
	}

	plan.CreatedAt = types.StringValue(webhook.CreatedAt)
	resp.Diagnostics.Append(resp.State.Set(ctx, &plan)...)
}

func (r *webhookResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
	var state webhookModel
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}

	if err := r.client.deleteWebhook(ctx, state.ID.ValueString()); err != nil {
		resp.Diagnostics.AddError("Delete webhook failed", err.Error())
		return
	}
	tflog.Info(ctx, "deleted fluxychat webhook", map[string]interface{}{"id": state.ID.ValueString()})
}

func (r *webhookResource) ImportState(ctx context.Context, req resource.ImportStateRequest, resp *resource.ImportStateResponse) {
	resource.ImportStatePassthroughID(ctx, path.Root("id"), req, resp)
}
