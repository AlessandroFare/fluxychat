import { useOrganizationConnectionContext } from "@client/components/providers/organization-connection-provider";
import { Button } from "@client/components/ui/button";
import {
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@client/components/ui/dialog";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@client/components/ui/form";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@client/components/ui/select";
import { honoClient } from "@client/lib/api-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { createChatRoomMemberSchema } from "@shared/types";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { ChatMemberCombobox } from "../chat-member-combobox";

export type FormValues = z.infer<typeof createChatRoomMemberSchema>;

interface ChatMemberAddFormProps {
	roomId: string;
	onSuccess: () => void;
}

export function ChatMemberAddForm({
	roomId,
	onSuccess,
}: ChatMemberAddFormProps) {
	const {
		mainChatRoomState: { members },
	} = useOrganizationConnectionContext();

	const form = useForm<FormValues>({
		resolver: zodResolver(createChatRoomMemberSchema),
		defaultValues: {
			id: "",
			roomId,
			type: "user",
			role: "member",
		},
	});

	const addMemberMutation = useMutation({
		mutationFn: async (values: FormValues) => {
			const response = await honoClient.api.chat["chat-rooms"][
				":chatRoomId"
			].members.$post({
				param: { chatRoomId: values.roomId },
				json: values,
			});
			return response.json();
		},
		onSuccess: () => {
			form.reset();
			onSuccess();
		},
	});

	const onSubmit = (values: FormValues) => addMemberMutation.mutate(values);

	const selectedMember = {
		id: form.watch("id"),
		type: form.watch("type"),
	};

	return (
		<>
			<DialogHeader>
				<DialogTitle>Add Member</DialogTitle>
				<DialogDescription>Add a new member to the chat room</DialogDescription>
			</DialogHeader>
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
					<FormItem className="flex flex-col">
						<FormLabel>Select Member</FormLabel>
						<ChatMemberCombobox
							selectedMember={selectedMember}
							setSelectedMember={(member) => {
								form.setValue("id", member?.id ?? "");
								form.setValue("type", member?.type ?? "user");
							}}
							currentMembers={members}
						/>
						<FormMessage />
					</FormItem>

					<FormField
						control={form.control}
						name="role"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Role</FormLabel>
								<Select
									onValueChange={field.onChange}
									defaultValue={field.value}
								>
									<FormControl>
										<SelectTrigger>
											<SelectValue placeholder="Select role" />
										</SelectTrigger>
									</FormControl>
									<SelectContent>
										<SelectItem value="admin">Admin</SelectItem>
										<SelectItem value="member">Member</SelectItem>
									</SelectContent>
								</Select>
								<FormMessage />
							</FormItem>
						)}
					/>

					<DialogFooter>
						<Button type="submit" disabled={addMemberMutation.isPending}>
							{addMemberMutation.isPending ? "Adding member..." : "Add member"}
						</Button>
					</DialogFooter>
				</form>
			</Form>
		</>
	);
}
