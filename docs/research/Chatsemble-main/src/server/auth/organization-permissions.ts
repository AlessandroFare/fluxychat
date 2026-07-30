import { createAccessControl } from "better-auth/plugins/access";
import {
	adminAc,
	defaultStatements,
	memberAc,
	ownerAc,
} from "better-auth/plugins/organization/access";

export const chatRoomPermissionTypes = ["create", "update", "delete"] as const;
export const chatRoomMemberPermissionTypes = ["create", "delete"] as const;

const statement = {
	...defaultStatements,
	chatRoom: chatRoomPermissionTypes,
	chatRoomMember: chatRoomMemberPermissionTypes,
} as const;

const accessControl = createAccessControl(statement);

const member = accessControl.newRole({
	...memberAc.statements,
	chatRoom: ["create"],
	chatRoomMember: [],
});

const admin = accessControl.newRole({
	...adminAc.statements,
	chatRoom: ["create", "update", "delete"],
	chatRoomMember: ["create", "delete"],
});

const owner = accessControl.newRole({
	...ownerAc.statements,
	chatRoom: ["create", "update", "delete"],
	chatRoomMember: ["create", "delete"],
});

const organizationPermissions = {
	member,
	admin,
	owner,
	accessControl,
};

export { organizationPermissions };
