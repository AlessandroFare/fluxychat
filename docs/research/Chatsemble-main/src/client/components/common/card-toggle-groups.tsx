import {
	ToggleGroup,
	ToggleGroupItem,
} from "@client/components/ui/toggle-group";
import { idToReadableText } from "@client/lib/id-parsing";

interface ToggleGroupProps<T extends string> {
	value: T | undefined;
	options: Readonly<string[]>;
	descriptions: Readonly<Record<string, string>>;
	iconMap: Readonly<
		Record<string, React.ComponentType<{ className?: string }>>
	>;
	onValueChange: (value: T) => void;
}

export function CardToggleGroup<T extends string>({
	value,
	onValueChange,
	options,
	descriptions,
	iconMap,
}: ToggleGroupProps<T>) {
	return (
		<ToggleGroup
			type="single"
			value={value}
			onValueChange={onValueChange}
			className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
		>
			{options.map((option) => {
				const Icon = iconMap[option] ?? (() => null);
				return (
					<ToggleGroupItem
						key={option}
						value={option}
						variant="outline"
						className="flex flex-col items-stretch gap-1 h-full py-3 px-4"
					>
						<Icon className="h-4 w-4 mx-auto" />
						<span>{idToReadableText(option, { capitalize: true })}</span>
						<p className="text-xs text-muted-foreground text-center text-wrap">
							{descriptions[option]}
						</p>
					</ToggleGroupItem>
				);
			})}
		</ToggleGroup>
	);
}
