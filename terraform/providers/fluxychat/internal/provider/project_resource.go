package provider

import (
	"context"
	"fmt"

	"github.com/hashicorp/terraform-plugin-framework/path"
	"github.com/hashicorp/terraform-plugin-framework/resource"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema"
	"github.com/hashicorp/terraform-plugin-framework/types"
	"github.com/hashicorp/terraform-plugin-log/tflog"
)

type projectResource struct {
	client *apiClient
}

type projectModel struct {
	ID   types.String `tfsdk:"id"`
	Name types.String `tfsdk:"name"`
	Plan types.String `tfsdk:"plan"`
}

func newProjectResource() resource.Resource {
	return &projectResource{}
}

func (r *projectResource) Metadata(_ context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_project"
}

func (r *projectResource) Schema(_ context.Context, _ resource.SchemaRequest, resp *resource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "Provisions a FluxyChat project via POST /admin/projects.",
		Attributes: map[string]schema.Attribute{
			"id": schema.StringAttribute{
				Computed:    true,
				Description: "Project ID assigned by the Worker.",
			},
			"name": schema.StringAttribute{
				Required:    true,
				Description: "Human-readable project name.",
			},
			"plan": schema.StringAttribute{
				Computed:    true,
				Description: "Current plan tier (read from Worker).",
			},
		},
	}
}

func (r *projectResource) Configure(_ context.Context, req resource.ConfigureRequest, resp *resource.ConfigureResponse) {
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

func (r *projectResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var plan projectModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
	if resp.Diagnostics.HasError() {
		return
	}

	created, err := r.client.createProject(ctx, plan.Name.ValueString())
	if err != nil {
		resp.Diagnostics.AddError("Create project failed", err.Error())
		return
	}

	plan.ID = types.StringValue(created.ID)
	plan.Plan = types.StringValue(created.Plan)
	tflog.Info(ctx, "created fluxychat project", map[string]interface{}{"id": created.ID})

	resp.Diagnostics.Append(resp.State.Set(ctx, &plan)...)
}

func (r *projectResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var state projectModel
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}

	project, err := r.client.getProject(ctx, state.ID.ValueString())
	if err != nil {
		resp.State.RemoveResource(ctx)
		resp.Diagnostics.AddWarning("Project not found", err.Error())
		return
	}

	state.Name = types.StringValue(project.Name)
	state.Plan = types.StringValue(project.Plan)
	resp.Diagnostics.Append(resp.State.Set(ctx, &state)...)
}

func (r *projectResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	var plan projectModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
	if resp.Diagnostics.HasError() {
		return
	}
	// Rename not exposed on admin API — replace resource if name changes.
	resp.Diagnostics.AddError(
		"Update not supported",
		"Project rename is not available via admin API. Change name requires taint/recreate.",
	)
}

func (r *projectResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
	tflog.Info(ctx, "delete fluxychat project — state only (no Worker DELETE API yet)")
}

func (r *projectResource) ImportState(ctx context.Context, req resource.ImportStateRequest, resp *resource.ImportStateResponse) {
	resource.ImportStatePassthroughID(ctx, path.Root("id"), req, resp)
}
