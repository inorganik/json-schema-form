import { JsonSchema } from '../../models/schema-models';

export const schemaWithRefs: JsonSchema = {
	type: 'object',
	title: 'Schema with Refs',
	$defs: {
		address: {
			$id: 'address',
			type: 'object',
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
		person: {
			$id: 'person',
			type: 'object',
			properties: {
				name: {
					type: 'string',
					title: 'Name',
				},
				address: {
					$ref: '#/$defs/address',
				},
			},
		},
	},
	properties: {
		primaryContact: {
			$ref: '#/$defs/person',
		},
	},
};

export const schemaWithExternalRefs: JsonSchema = {
	type: 'object',
	title: 'Schema with External Refs',
	properties: {
		component: {
			$ref: 'https://example.com/component.json',
		},
	},
};
