import { AppSidebar } from "@client/components/layout/app-sidebar";
import { SidebarInset } from "@client/components/ui/sidebar";

export function AppLayout({
	children,
	sidebarChildren,
}: {
	children: React.ReactNode;
	sidebarChildren: React.ReactNode;
}) {
	return (
		<>
			<AppSidebar>{sidebarChildren}</AppSidebar>
			<SidebarInset variant="inset">{children}</SidebarInset>
		</>
	);
}
