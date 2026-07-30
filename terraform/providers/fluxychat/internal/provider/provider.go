package provider

import (
	"context"

	"github.com/hashicorp/terraform-plugin-framework/datasource"
	"github.com/hashicorp/terraform-plugin-framework/provider"
	"github.com/hashicorp/terraform-plugin-framework/provider/schema"
	"github.com/hashicorp/terraform-plugin-framework/resource"
	"github.com/hashicorp/terraform-plugin-framework/types"
)

type fluxyProvider struct {
	version string
}

type providerModel struct {
	WorkerURL types.String `tfsdk:"worker_url"`
	AdminJWT  types.String `tfsdk:"admin_jwt"`
}

type providerData struct {
	client *apiClient
}

func New(version string) func() provider.Provider {
	return func() provider.Provider {
		return &fluxyProvider{version: version}
	}
}

func (p *fluxyProvider) Metadata(_ context.Context, req provider.MetadataRequest, resp *provider.MetadataResponse) {
	resp.TypeName = "fluxychat"
	resp.Version = p.version
}

func (p *fluxyProvider) Schema(_ context.Context, _ provider.SchemaRequest, resp *provider.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "Interact with FluxyChat Worker admin APIs.",
		Attributes: map[string]schema.Attribute{
			"worker_url": schema.StringAttribute{
				Required:    true,
				Description: "Base URL of the FluxyChat Worker (e.g. https://api.example.com).",
			},
			"admin_jwt": schema.StringAttribute{
				Required:    true,
				Sensitive:   true,
				Description: "Admin JWT with owner/admin role for project provisioning.",
			},
		},
	}
}

func (p *fluxyProvider) Configure(ctx context.Context, req provider.ConfigureRequest, resp *provider.ConfigureResponse) {
	var config providerModel
	resp.Diagnostics.Append(req.Config.Get(ctx, &config)...)
	if resp.Diagnostics.HasError() {
		return
	}

	if config.WorkerURL.IsNull() || config.AdminJWT.IsNull() {
		resp.Diagnostics.AddError("Missing configuration", "worker_url and admin_jwt are required")
		return
	}

	client := newAPIClient(config.WorkerURL.ValueString(), config.AdminJWT.ValueString())
	resp.DataSourceData = &providerData{client: client}
	resp.ResourceData = &providerData{client: client}
}

func (p *fluxyProvider) Resources(_ context.Context) []func() resource.Resource {
	return []func() resource.Resource{
		newProjectResource,
		newWebhookResource,
	}
}

func (p *fluxyProvider) DataSources(_ context.Context) []func() datasource.DataSource {
	return nil
}
