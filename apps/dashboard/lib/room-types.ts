/** Room types accepted by the Worker when creating a room. */
export const ROOM_TYPE_OPTIONS = [
  { value: "group", label: "Group", description: "Named channel; add members explicitly" },
  { value: "public", label: "Public", description: "Join rules depend on your Worker policy" },
  { value: "dm", label: "Direct", description: "Typically two participants" },
] as const;

export type RoomTypeValue = (typeof ROOM_TYPE_OPTIONS)[number]["value"];

export function isRoomType(value: string): value is RoomTypeValue {
  return ROOM_TYPE_OPTIONS.some((o) => o.value === value);
}
