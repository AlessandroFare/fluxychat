"use client";

import { Button } from "@client/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@client/components/ui/dialog";
import { UserRound } from "lucide-react";
import { useState } from "react";

interface AvatarPickerProps {
	value: string;
	onChange: (value: string) => void;
}

export function AvatarPicker({ value, onChange }: AvatarPickerProps) {
	const [dialogOpen, setDialogOpen] = useState(false);

	return (
		<div className="flex items-center gap-4">
			<div className="relative size-16 overflow-hidden rounded-lg border">
				{value ? (
					<img
						src={value}
						alt="Agent avatar"
						className="size-full object-cover"
					/>
				) : (
					<div className="size-full flex items-center justify-center">
						<UserRound />
					</div>
				)}
			</div>
			<Button
				type="button"
				size="sm"
				variant="outline"
				onClick={() => setDialogOpen(true)}
			>
				Change Avatar
			</Button>
			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent className="sm:max-w-[525px]">
					<DialogHeader>
						<DialogTitle>Select Avatar</DialogTitle>
					</DialogHeader>
					<div className="grid grid-cols-5 gap-3 p-4">
						{Array.from({ length: 10 }, (_, i) => i + 1).map((num) => {
							const avatarId = `/notion-avatars/avatar-${num.toString().padStart(2, "0")}.svg`;
							return (
								<button
									key={avatarId}
									type="button"
									className={`relative aspect-square rounded-lg border-2 p-2 transition-all hover:bg-accent ${
										value === avatarId
											? "border-primary bg-accent"
											: "border-transparent"
									}`}
									onClick={() => {
										onChange(avatarId);
										setDialogOpen(false);
									}}
								>
									<img
										src={avatarId}
										alt={`Avatar ${num}`}
										className="size-full"
									/>
								</button>
							);
						})}
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
