/**
 * Strips fields whose keys are prefixed with "_"
 */
export const stripUnderscoreFields = (obj: any): any => {
	if (obj === null || obj === undefined) {
		return obj;
	}
	if (typeof obj !== 'object') {
		return obj;
	}
	if (Array.isArray(obj)) {
		return obj.map(stripUnderscoreFields);
	}
	return Object.fromEntries(
		Object.entries(obj)
			.filter(([k]) => !k.startsWith('_'))
			.map(([k, v]) => [k, stripUnderscoreFields(v)]),
	);
};
