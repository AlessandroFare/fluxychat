export function AgentNotSelected() {
	return (
		<div className="flex flex-1 flex-col items-center justify-center">
			<span className="text-lg font-bold">No agent selected</span>
			<p className="text-sm text-muted-foreground">
				Please select an agent from the sidebar
			</p>
		</div>
	);
}

export function AgentNotFound() {
	return (
		<div className="flex flex-1 flex-col items-center justify-center">
			<span className="text-lg font-bold">Agent not found</span>
		</div>
	);
}
