package main

import (
	"context"
	"log"

	"github.com/fluxychat/terraform-provider-fluxychat/internal/provider"
	"github.com/hashicorp/terraform-plugin-framework/providerserver"
)

func main() {
	opts := providerserver.ServeOpts{
		Address: "registry.terraform.io/fluxychat/fluxychat",
	}

	err := providerserver.Serve(context.Background(), provider.New("0.1.0"), opts)
	if err != nil {
		log.Fatal(err.Error())
	}
}
