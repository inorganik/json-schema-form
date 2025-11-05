import { JsonSchema } from '../models/schema-models';

export const oneOfSchema: JsonSchema = {
	type: 'object',
	title: 'One Of Form',
	properties: {
		paymentMethod: {
			title: 'Payment Method',
			oneOf: [
				{
					title: 'Credit Card',
					type: 'object',
					properties: {
						cardNumber: {
							type: 'string',
							title: 'Card Number',
						},
						cvv: {
							type: 'string',
							title: 'CVV',
						},
					},
				},
				{
					title: 'Bank Transfer',
					type: 'object',
					properties: {
						accountNumber: {
							type: 'string',
							title: 'Account Number',
						},
						routingNumber: {
							type: 'string',
							title: 'Routing Number',
						},
					},
				},
			],
		},
	},
};

export const anyOfSchema: JsonSchema = {
	type: 'object',
	title: 'Any Of Form',
	properties: {
		features: {
			title: 'Features',
			anyOf: [
				{
					title: 'Feature A',
					type: 'object',
					properties: {
						optionA: {
							type: 'string',
							title: 'Option A',
						},
					},
				},
				{
					title: 'Feature B',
					type: 'object',
					properties: {
						optionB: {
							type: 'string',
							title: 'Option B',
						},
					},
				},
			],
		},
	},
};

export const ifThenElseSchema: JsonSchema = {
	type: 'object',
	title: 'If Then Else Form',
	properties: {
		country: {
			type: 'string',
			title: 'Country',
			enum: ['USA', 'Canada', 'Other'],
		},
	},
	allOf: [
		{
			if: {
				properties: {
					country: {
						const: 'USA',
					},
				},
			},
			then: {
				properties: {
					state: {
						type: 'string',
						title: 'State',
						enum: ['CA', 'NY', 'TX'],
					},
				},
			},
		},
		{
			if: {
				properties: {
					country: {
						const: 'Canada',
					},
				},
			},
			then: {
				properties: {
					province: {
						type: 'string',
						title: 'Province',
						enum: ['ON', 'QC', 'BC'],
					},
				},
			},
		},
	],
};

export const allOfSchema: JsonSchema = {
	type: 'object',
	title: 'All Of Form',
	allOf: [
		{
			properties: {
				name: {
					type: 'string',
					title: 'Name',
				},
			},
		},
		{
			properties: {
				email: {
					type: 'string',
					title: 'Email',
				},
			},
		},
	],
};

export const nestedConditionalSchema: JsonSchema = {
	type: 'object',
	properties: {
		enableFeature: {
			type: 'boolean',
			title: 'Enable Feature',
		},
	},
	allOf: [
		{
			if: {
				properties: {
					enableFeature: { const: true },
				},
			},
			then: {
				properties: {
					settings: {
						type: 'object',
						title: 'Settings',
						properties: {
							mode: {
								type: 'string',
								title: 'Mode',
								enum: ['simple', 'advanced'],
							},
						},
						allOf: [
							{
								if: {
									properties: {
										mode: { const: 'advanced' },
									},
								},
								then: {
									properties: {
										advancedOption: {
											type: 'string',
											title: 'Advanced Option',
										},
									},
								},
							},
						],
					},
				},
			},
		},
	],
};

export const arrayConditionalSchema: JsonSchema = {
	type: 'object',
	properties: {
		items: {
			type: 'array',
			title: 'Items',
			items: {
				type: 'object',
				properties: {
					type: {
						type: 'string',
						title: 'Type',
						enum: ['typeA', 'typeB'],
					},
				},
				allOf: [
					{
						if: {
							properties: {
								type: { const: 'typeA' },
							},
						},
						then: {
							properties: {
								optionA: {
									type: 'string',
									title: 'Option A',
								},
							},
						},
					},
				],
			},
		},
	},
};
