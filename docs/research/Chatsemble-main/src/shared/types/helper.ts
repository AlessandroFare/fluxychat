export type Versioned<T, TypeName extends string, Version extends number> = {
	version: Version;
	type: TypeName;
	data: T;
};
