import Mention from "@tiptap/extension-mention";
/* import type { Node } from "@tiptap/pm/model"; */

export const MentioPlugin = Mention.extend({
	name: "mention",
	/* addStorage() {
		return {
			markdown: {
				serialize: (state: { write: (arg: string) => void }, node: Node) => {
					state.write(`@{"id":${node.attrs.id},"label":"${node.attrs.label}"}`);
				},
			},
		};
	}, */
});
