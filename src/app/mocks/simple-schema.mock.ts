import { JsonSchema } from '../models/schema-models';

export const simpleSchema: JsonSchema = {
	type: 'object',
	title: 'Simple Form',
	properties: {
		name: {
			type: 'string',
			title: 'Name',
			minLength: 2,
			maxLength: 50,
		},
		age: {
			type: 'number',
			title: 'Age',
			minimum: 0,
			maximum: 120,
		},
		email: {
			type: 'string',
			title: 'Email',
			pattern: '^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$',
		},
		active: {
			type: 'boolean',
			title: 'Active',
		},
	},
	required: ['name', 'email'],
};

export const schemaWithEnum: JsonSchema = {
	type: 'object',
	title: 'Form with Enum',
	properties: {
		status: {
			type: 'string',
			title: 'Status',
			enum: ['active', 'inactive', 'pending'],
		},
		priority: {
			type: 'string',
			title: 'Priority',
			enum: ['low', 'medium', 'high', 'urgent', 'critical'],
		},
	},
	required: ['status'],
};

export const schemaWithDefaults: JsonSchema = {
	type: 'object',
	title: 'Form with Defaults',
	properties: {
		country: {
			type: 'string',
			title: 'Country',
			default: 'USA',
		},
		subscribed: {
			type: 'boolean',
			title: 'Subscribed',
			default: true,
		},
	},
};

export const schemaWithConst: JsonSchema = {
	type: 'object',
	title: 'Form with Const',
	properties: {
		type: {
			type: 'string',
			title: 'Type',
			const: 'user',
		},
		name: {
			type: 'string',
			title: 'Name',
		},
	},
};

export const nestedSchema: JsonSchema = {
	type: 'object',
	title: 'Nested Form',
	properties: {
		user: {
			type: 'object',
			title: 'User',
			properties: {
				firstName: {
					type: 'string',
					title: 'First Name',
				},
				lastName: {
					type: 'string',
					title: 'Last Name',
				},
			},
		},
	},
};

export const arraySchema: JsonSchema = {
	type: 'object',
	title: 'Form with Array',
	properties: {
		tags: {
			type: 'array',
			title: 'Tags',
			items: {
				type: 'string',
				title: 'Tag',
			},
			minItems: 1,
			maxItems: 5,
		},
	},
};

export const arrayOfObjectsSchema: JsonSchema = {
	type: 'object',
	title: 'Form with Array of Objects',
	properties: {
		addresses: {
			type: 'array',
			title: 'Addresses',
			items: {
				type: 'object',
				title: 'Address',
				properties: {
					street: {
						type: 'string',
						title: 'Street',
					},
					city: {
						type: 'string',
						title: 'City',
					},
				},
			},
		},
	},
};

export const arrayFieldSchema: JsonSchema = {
	type: 'array',
	title: 'Columns',
	items: {
		type: 'object',
		properties: {
			title: { type: 'string', title: 'Title' },
			components: {
				type: 'array',
				items: { type: 'string' },
				title: 'Components',
			},
		},
		required: ['components'],
	},
	minItems: 1,
	maxItems: 5,
};

export const varietySchema: JsonSchema = {
	type: 'object',
	title: 'Simple Form',
	properties: {
		name: {
			type: 'string',
			title: 'Name',
			minLength: 2,
			maxLength: 50,
		},
		email: {
			type: 'string',
			title: 'Email',
			pattern: '^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$',
		},
		enabled: {
			type: 'boolean',
			title: 'Enabled',
			format: 'toggle',
		},
		status: schemaWithEnum,
		columns: arrayFieldSchema,
	},
	required: ['name', 'email'],
};
