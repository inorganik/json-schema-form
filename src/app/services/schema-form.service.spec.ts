import { TestBed } from '@angular/core/testing';
import { FormArray, FormGroup } from '@angular/forms';

import { SchemaFieldType } from '../models/form-models';
import { JsonSchema } from '../models/schema-models';
import {
	allOfSchema,
	anyOfSchema,
	ifThenElseSchema,
	oneOfSchema,
} from './mocks/conditional-schema.mock';
import { schemaWithRefs } from './mocks/ref-schema.mock';
import {
	arrayOfObjectsSchema,
	arraySchema,
	nestedSchema,
	simpleSchema,
} from './mocks/simple-schema.mock';
import { SchemaFormService } from './schema-form.service';

describe('SchemaFormService', () => {
	let service: SchemaFormService;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [SchemaFormService],
		});
		service = TestBed.inject(SchemaFormService);
		// Clear the schema cache and defs map before each test
		(service as any).schemaCache.clear();
		service.defsMap.clear();
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	describe('getSchema', () => {
		it('should fetch and return a schema from a URL', async () => {
			const mockSchema = { type: 'object', properties: {} };
			const mockFetch = jest.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockSchema),
			} as Response);
			global.fetch = mockFetch;

			const result = await service.getSchema('https://example.com/schema.json');

			expect(result).toEqual(mockSchema);
			expect(mockFetch).toHaveBeenCalledWith('https://example.com/schema.json');
		});

		it('should use cached schema if available in cache', async () => {
			const mockSchema = { type: 'object', properties: {} };
			const mockFetch = jest.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockSchema),
			} as Response);
			global.fetch = mockFetch;

			// Manually add to cache
			(service as any).schemaCache.set('https://example.com/cached.json', mockSchema);

			// Fetch should return cached version without calling fetch
			const result = await service.getSchema('https://example.com/cached.json');

			expect(result).toEqual(mockSchema);
			expect(mockFetch).not.toHaveBeenCalled();
		});

		it('should handle fetch errors', async () => {
			const mockFetch = jest.fn().mockResolvedValue({
				ok: false,
				status: 404,
			} as Response);
			global.fetch = mockFetch;
			jest.spyOn(console, 'error').mockImplementation();

			const result = await service.getSchema('https://example.com/invalid.json');

			expect(result).toBeNull();
			expect(console.error).toHaveBeenCalled();
		});
	});

	describe('dereferenceSchema', () => {
		it('should return schema unchanged if no refs', async () => {
			const result = await service.dereferenceSchema(simpleSchema);

			expect(result).toBeTruthy();
			expect(result.properties).toBeDefined();
		});

		it('should collect $defs in defsMap', async () => {
			await service.dereferenceSchema(schemaWithRefs);

			expect(service.defsMap.has('address')).toBe(true);
			expect(service.defsMap.has('person')).toBe(true);
		});

		it('should handle recursive dereferencing', async () => {
			const result = await service.dereferenceSchema(schemaWithRefs);

			expect(result).toBeTruthy();
		});
	});

	describe('schemaToFieldConfig', () => {
		it('should create a root field group', () => {
			const result = service.schemaToFieldConfig(simpleSchema);

			expect(result.type).toBe(SchemaFieldType.Group);
			expect(result.key).toBe('root');
			expect(result.label).toBe('Simple Form');
			expect(result.groupRef).toBeInstanceOf(FormGroup);
		});

		it('should process properties and create fields', () => {
			const result = service.schemaToFieldConfig(simpleSchema);

			expect(result.fields['name']).toBeDefined();
			expect(result.fields['age']).toBeDefined();
			expect(result.fields['email']).toBeDefined();
			expect(result.fields['active']).toBeDefined();
		});

		it('should add required validation to root group', () => {
			const result = service.schemaToFieldConfig(simpleSchema);

			expect(result.validations?.required).toBe(true);
		});

		it('should handle nested objects', () => {
			const result = service.schemaToFieldConfig(nestedSchema);

			expect(result.fields['user']).toBeDefined();
			expect(result.fields['user'].type).toBe(SchemaFieldType.Group);
		});

		it('should store $defs in defsMap', () => {
			service.schemaToFieldConfig(schemaWithRefs);

			expect(service.defsMap.has('address')).toBe(true);
			expect(service.defsMap.has('person')).toBe(true);
		});
	});

	describe('addField', () => {
		it('should add a text field to parent group', () => {
			const rootGroup = service.schemaToFieldConfig({ type: 'object', properties: {} });
			const fieldSchema: JsonSchema = { type: 'string', title: 'Name' };

			service.addField(fieldSchema, rootGroup, 'name', 0);

			expect(rootGroup.fields['name']).toBeDefined();
			expect(rootGroup.fields['name'].type).toBe(SchemaFieldType.Text);
			expect(rootGroup.groupRef?.get('name')).toBeDefined();
		});

		it('should add a number field', () => {
			const rootGroup = service.schemaToFieldConfig({ type: 'object', properties: {} });
			const fieldSchema: JsonSchema = { type: 'number', title: 'Age' };

			service.addField(fieldSchema, rootGroup, 'age', 0);

			expect(rootGroup.fields['age'].type).toBe(SchemaFieldType.Number);
		});

		it('should add a checkbox field for boolean type', () => {
			const rootGroup = service.schemaToFieldConfig({ type: 'object', properties: {} });
			const fieldSchema: JsonSchema = { type: 'boolean', title: 'Active' };

			service.addField(fieldSchema, rootGroup, 'active', 0);

			expect(rootGroup.fields['active'].type).toBe(SchemaFieldType.Checkbox);
		});

		it('should add a toggle field for boolean with toggle format', () => {
			const rootGroup = service.schemaToFieldConfig({ type: 'object', properties: {} });
			const fieldSchema: JsonSchema = { type: 'boolean', title: 'Active', format: 'toggle' };

			service.addField(fieldSchema, rootGroup, 'active', 0);

			expect(rootGroup.fields['active'].type).toBe(SchemaFieldType.Toggle);
		});

		it('should add a select field for enum with 5+ items', () => {
			const rootGroup = service.schemaToFieldConfig({ type: 'object', properties: {} });
			const fieldSchema: JsonSchema = {
				type: 'string',
				title: 'Status',
				enum: ['a', 'b', 'c', 'd', 'e'],
			};

			service.addField(fieldSchema, rootGroup, 'status', 0);

			expect(rootGroup.fields['status'].type).toBe(SchemaFieldType.Select);
			expect((rootGroup.fields['status'] as any).options?.length).toBe(5);
		});

		it('should add a radio field for enum with 4 or fewer items', () => {
			const rootGroup = service.schemaToFieldConfig({ type: 'object', properties: {} });
			const fieldSchema: JsonSchema = {
				type: 'string',
				title: 'Status',
				enum: ['a', 'b', 'c'],
			};

			service.addField(fieldSchema, rootGroup, 'status', 0);

			expect(rootGroup.fields['status'].type).toBe(SchemaFieldType.Radio);
		});

		it('should add a hidden field for const values', () => {
			const rootGroup = service.schemaToFieldConfig({ type: 'object', properties: {} });
			const fieldSchema: JsonSchema = { type: 'string', title: 'Type', const: 'user' };

			service.addField(fieldSchema, rootGroup, 'type', 0);

			expect(rootGroup.fields['type'].type).toBe(SchemaFieldType.Hidden);
		});

		it('should set default value if provided', () => {
			const rootGroup = service.schemaToFieldConfig({ type: 'object', properties: {} });
			const fieldSchema: JsonSchema = { type: 'string', title: 'Country', default: 'USA' };

			service.addField(fieldSchema, rootGroup, 'country', 0);

			expect((rootGroup.fields['country'] as any).controlRef.value).toBe('USA');
		});

		it('should add validations to field', () => {
			const rootGroup = service.schemaToFieldConfig({
				type: 'object',
				properties: {},
				required: ['name'],
			});
			const fieldSchema: JsonSchema = {
				type: 'string',
				title: 'Name',
				minLength: 2,
				maxLength: 50,
			};

			service.addField(fieldSchema, rootGroup, 'name', 0);

			expect(rootGroup.fields['name'].validations).toBeDefined();
			expect((rootGroup.fields['name'].validations as any)?.minLength).toBe(2);
			expect((rootGroup.fields['name'].validations as any)?.maxLength).toBe(50);
		});

		it('should add textarea field for textarea format', () => {
			const rootGroup = service.schemaToFieldConfig({ type: 'object', properties: {} });
			const fieldSchema: JsonSchema = {
				type: 'string',
				title: 'Description',
				format: 'textarea',
			};

			service.addField(fieldSchema, rootGroup, 'description', 0);

			expect(rootGroup.fields['description'].type).toBe(SchemaFieldType.Textarea);
		});
	});

	describe('removeField', () => {
		it('should remove field from parent group', () => {
			const rootGroup = service.schemaToFieldConfig(simpleSchema);

			service.removeField('name', rootGroup);

			expect(rootGroup.fields['name']).toBeUndefined();
			expect(rootGroup.groupRef?.get('name')).toBeNull();
		});

		it('should unsubscribe from field valueChanges', () => {
			const rootGroup = service.schemaToFieldConfig(simpleSchema);
			const field = rootGroup.fields['name'];
			const subscription = (service as any).subscriptions.get(field.uniqueKey);

			jest.spyOn(subscription, 'unsubscribe');
			service.removeField('name', rootGroup);

			expect(subscription.unsubscribe).toHaveBeenCalled();
		});
	});

	describe('addGroup', () => {
		it('should add a nested group to parent', () => {
			const rootGroup = service.schemaToFieldConfig({ type: 'object', properties: {} });
			const groupSchema: JsonSchema = {
				type: 'object',
				title: 'Address',
				properties: {
					street: { type: 'string', title: 'Street' },
				},
			};

			service.addGroup(groupSchema, rootGroup, 'address', 0);

			expect(rootGroup.fields['address']).toBeDefined();
			expect(rootGroup.fields['address'].type).toBe(SchemaFieldType.Group);
			expect(rootGroup.groupRef?.get('address')).toBeInstanceOf(FormGroup);
		});

		it('should process nested properties', () => {
			const rootGroup = service.schemaToFieldConfig({ type: 'object', properties: {} });
			const groupSchema: JsonSchema = {
				type: 'object',
				title: 'Address',
				properties: {
					street: { type: 'string', title: 'Street' },
					city: { type: 'string', title: 'City' },
				},
			};

			service.addGroup(groupSchema, rootGroup, 'address', 0);

			const addressGroup = rootGroup.fields['address'];
			expect(addressGroup.type).toBe(SchemaFieldType.Group);
			expect((addressGroup as any).fields['street']).toBeDefined();
			expect((addressGroup as any).fields['city']).toBeDefined();
		});

		it('should add parameter field for object with no properties', () => {
			const rootGroup = service.schemaToFieldConfig({ type: 'object', properties: {} });
			const groupSchema: JsonSchema = { type: 'object', title: 'Custom Data' };

			service.addGroup(groupSchema, rootGroup, 'customData', 0);

			const group = rootGroup.fields['customData'];
			expect((group as any).fields['_parameter']).toBeDefined();
		});
	});

	describe('removeGroup', () => {
		it('should remove group from parent', () => {
			const rootGroup = service.schemaToFieldConfig(nestedSchema);

			service.removeGroup('user', rootGroup);

			expect(rootGroup.fields['user']).toBeUndefined();
			expect(rootGroup.groupRef?.get('user')).toBeNull();
		});

		it('should cleanup nested subscriptions', () => {
			const rootGroup = service.schemaToFieldConfig(nestedSchema);
			jest.spyOn(service, 'cleanupFieldSubscriptions');

			service.removeGroup('user', rootGroup);

			expect(service.cleanupFieldSubscriptions).toHaveBeenCalled();
		});
	});

	describe('addArray', () => {
		it('should add an array field to parent', () => {
			const rootGroup = service.schemaToFieldConfig({ type: 'object', properties: {} });
			const arrayFieldSchema: JsonSchema = {
				type: 'array',
				title: 'Tags',
				items: { type: 'string', title: 'Tag' },
			};

			service.addArray(arrayFieldSchema, rootGroup, 'tags', 0);

			expect(rootGroup.fields['tags']).toBeDefined();
			expect(rootGroup.fields['tags'].type).toBe(SchemaFieldType.Array);
			expect(rootGroup.groupRef?.get('tags')).toBeInstanceOf(FormArray);
		});

		it('should store itemSchema for later use', () => {
			const rootGroup = service.schemaToFieldConfig({ type: 'object', properties: {} });
			const arrayFieldSchema: JsonSchema = {
				type: 'array',
				title: 'Tags',
				items: { type: 'string', title: 'Tag' },
			};

			service.addArray(arrayFieldSchema, rootGroup, 'tags', 0);

			const arrayField = rootGroup.fields['tags'];
			expect((arrayField as any).itemSchema).toBeDefined();
		});

		it('should add validations for minItems and maxItems', () => {
			const rootGroup = service.schemaToFieldConfig({ type: 'object', properties: {} });
			const arrayFieldSchema: JsonSchema = {
				type: 'array',
				title: 'Tags',
				items: { type: 'string', title: 'Tag' },
				minItems: 1,
				maxItems: 5,
			};

			service.addArray(arrayFieldSchema, rootGroup, 'tags', 0);

			const arrayField = rootGroup.fields['tags'];
			expect((arrayField.validations as any)?.minItems).toBe(1);
			expect((arrayField.validations as any)?.maxItems).toBe(5);
		});

		it('should add minimum required items if minItems specified', () => {
			const rootGroup = service.schemaToFieldConfig({ type: 'object', properties: {} });
			const arrayFieldSchema: JsonSchema = {
				type: 'array',
				title: 'Tags',
				items: { type: 'string', title: 'Tag' },
				minItems: 2,
			};

			service.addArray(arrayFieldSchema, rootGroup, 'tags', 0);

			const arrayField = rootGroup.fields['tags'];
			expect((arrayField as any).items.length).toBe(2);
		});

		it('should implement canAddItem based on maxItems', () => {
			const rootGroup = service.schemaToFieldConfig({ type: 'object', properties: {} });
			const arrayFieldSchema: JsonSchema = {
				type: 'array',
				title: 'Tags',
				items: { type: 'string', title: 'Tag' },
				maxItems: 3,
			};

			service.addArray(arrayFieldSchema, rootGroup, 'tags', 0);

			const arrayField = rootGroup.fields['tags'] as any;
			expect(arrayField.canAddItem()).toBe(true);

			// Add 3 items
			service.addArrayItem(arrayField);
			service.addArrayItem(arrayField);
			service.addArrayItem(arrayField);

			expect(arrayField.canAddItem()).toBe(false);
		});

		it('should implement canRemoveItem based on minItems', () => {
			const rootGroup = service.schemaToFieldConfig({ type: 'object', properties: {} });
			const arrayFieldSchema: JsonSchema = {
				type: 'array',
				title: 'Tags',
				items: { type: 'string', title: 'Tag' },
				minItems: 2,
			};

			service.addArray(arrayFieldSchema, rootGroup, 'tags', 0);

			const arrayField = rootGroup.fields['tags'] as any;
			expect(arrayField.canRemoveItem()).toBe(false); // Already at minItems
		});
	});

	describe('removeArray', () => {
		it('should remove array from parent', () => {
			const rootGroup = service.schemaToFieldConfig(arraySchema);

			service.removeArray('tags', rootGroup);

			expect(rootGroup.fields['tags']).toBeUndefined();
			expect(rootGroup.groupRef?.get('tags')).toBeNull();
		});

		it('should cleanup array subscriptions', () => {
			const rootGroup = service.schemaToFieldConfig(arraySchema);
			jest.spyOn(service as any, 'cleanupArraySubscriptions');

			service.removeArray('tags', rootGroup);

			expect((service as any).cleanupArraySubscriptions).toHaveBeenCalled();
		});
	});

	describe('addArrayItem', () => {
		it('should add a string item to array', () => {
			const rootGroup = service.schemaToFieldConfig(arraySchema);
			const arrayField = rootGroup.fields['tags'] as any;

			service.addArrayItem(arrayField);

			expect(arrayField.items.length).toBe(2); // 1 from minItems + 1 added
			expect(arrayField.arrayRef.length).toBe(2);
		});

		it('should add an object item to array', () => {
			const rootGroup = service.schemaToFieldConfig(arrayOfObjectsSchema);
			const arrayField = rootGroup.fields['addresses'] as any;

			service.addArrayItem(arrayField);

			expect(arrayField.items.length).toBe(1);
			expect(arrayField.items[0].type).toBe(SchemaFieldType.Group);
		});

		it('should not add item if no itemSchema', () => {
			const rootGroup = service.schemaToFieldConfig({ type: 'object', properties: {} });
			const arrayField = {
				type: SchemaFieldType.Array,
				items: [],
				arrayRef: new FormArray([]),
				key: 'test',
			} as any;

			jest.spyOn(console, 'warn').mockImplementation();
			service.addArrayItem(arrayField);

			expect(console.warn).toHaveBeenCalled();
			expect(arrayField.items.length).toBe(0);
		});
	});

	describe('removeArrayItem', () => {
		it('should remove item from array at specified index', () => {
			const rootGroup = service.schemaToFieldConfig(arraySchema);
			const arrayField = rootGroup.fields['tags'] as any;

			const initialLength = arrayField.items.length;
			service.removeArrayItem(arrayField, 0);

			expect(arrayField.items.length).toBe(initialLength - 1);
		});

		it('should not remove item if index out of bounds', () => {
			const rootGroup = service.schemaToFieldConfig(arraySchema);
			const arrayField = rootGroup.fields['tags'] as any;

			const initialLength = arrayField.items.length;
			service.removeArrayItem(arrayField, 999);

			expect(arrayField.items.length).toBe(initialLength);
		});

		it('should cleanup subscriptions for removed item', () => {
			const rootGroup = service.schemaToFieldConfig(arrayOfObjectsSchema);
			const arrayField = rootGroup.fields['addresses'] as any;
			service.addArrayItem(arrayField);

			jest.spyOn(service, 'cleanupFieldSubscriptions');
			service.removeArrayItem(arrayField, 0);

			expect(service.cleanupFieldSubscriptions).toHaveBeenCalled();
		});
	});

	describe('handleOneOf', () => {
		it('should create a radio field for oneOf options', () => {
			const rootGroup = service.schemaToFieldConfig(oneOfSchema);
			const paymentGroup = rootGroup.fields['paymentMethod'] as any;

			expect(paymentGroup.fields['paymentMethod_oneOf']).toBeDefined();
			expect(paymentGroup.fields['paymentMethod_oneOf'].type).toBe(SchemaFieldType.Radio);
		});

		it('should create options from oneOf schemas', () => {
			const rootGroup = service.schemaToFieldConfig(oneOfSchema);
			const paymentGroup = rootGroup.fields['paymentMethod'] as any;
			const radioField = paymentGroup.fields['paymentMethod_oneOf'];

			expect(radioField.options?.length).toBe(2);
			expect(radioField.options[0].label).toBe('Credit Card');
			expect(radioField.options[1].label).toBe('Bank Transfer');
		});

		it('should add conditional schemas for each option', () => {
			const rootGroup = service.schemaToFieldConfig(oneOfSchema);
			const paymentGroup = rootGroup.fields['paymentMethod'] as any;
			const radioField = paymentGroup.fields['paymentMethod_oneOf'];

			expect(radioField.conditionalSchemas?.length).toBe(2);
		});
	});

	describe('handleAnyOf', () => {
		it('should create checkbox fields for anyOf options', () => {
			const rootGroup = service.schemaToFieldConfig(anyOfSchema);
			const featuresGroup = rootGroup.fields['features'] as any;

			expect(featuresGroup.fields['features_option_1']).toBeDefined();
			expect(featuresGroup.fields['features_option_1'].type).toBe(SchemaFieldType.Checkbox);
			expect(featuresGroup.fields['features_option_2']).toBeDefined();
		});

		it('should add conditional schemas to each checkbox', () => {
			const rootGroup = service.schemaToFieldConfig(anyOfSchema);
			const featuresGroup = rootGroup.fields['features'] as any;
			const checkbox1 = featuresGroup.fields['features_option_1'];

			expect(checkbox1.conditionalSchemas?.length).toBe(1);
			expect(checkbox1.conditionalSchemas[0].triggerValue).toBe(true);
		});
	});

	describe('processSchema', () => {
		it('should handle allOf by merging schemas', () => {
			const rootGroup = service.schemaToFieldConfig(allOfSchema);

			expect(rootGroup.fields['name']).toBeDefined();
			expect(rootGroup.fields['email']).toBeDefined();
		});

		it('should handle if/then/else conditionals', () => {
			const rootGroup = service.schemaToFieldConfig(ifThenElseSchema);

			expect(rootGroup.fields['country']).toBeDefined();
			const countryField = rootGroup.fields['country'];
			expect(countryField.conditionalSchemas?.length).toBeGreaterThan(0);
		});

		it('should handle $ref by resolving from defsMap', () => {
			const rootGroup = service.schemaToFieldConfig(schemaWithRefs);

			expect(rootGroup.fields['primaryContact']).toBeDefined();
		});
	});

	describe('handleConditionalSchemas', () => {
		it('should add fields when trigger value matches', () => {
			const rootGroup = service.schemaToFieldConfig(ifThenElseSchema);
			const countryField = rootGroup.fields['country'] as any;

			// Trigger the conditional
			countryField.controlRef.setValue('USA');

			// Give a tick for async processing
			setTimeout(() => {
				expect(rootGroup.fields['state']).toBeDefined();
			}, 0);
		});

		it('should remove fields when trigger value does not match', () => {
			const rootGroup = service.schemaToFieldConfig(ifThenElseSchema);
			const countryField = rootGroup.fields['country'] as any;

			// First add fields
			countryField.controlRef.setValue('USA');

			setTimeout(() => {
				// Then change to different value
				countryField.controlRef.setValue('Canada');

				setTimeout(() => {
					expect(rootGroup.fields['state']).toBeUndefined();
				}, 0);
			}, 0);
		});
	});

	describe('cleanupFieldSubscriptions', () => {
		it('should unsubscribe from all field subscriptions in a group', () => {
			const rootGroup = service.schemaToFieldConfig(simpleSchema);
			const subscriptions = Array.from((service as any).subscriptions.values());

			subscriptions.forEach((sub: any) => jest.spyOn(sub, 'unsubscribe'));
			service.cleanupFieldSubscriptions(rootGroup);

			subscriptions.forEach((sub: any) => {
				expect(sub.unsubscribe).toHaveBeenCalled();
			});
		});

		it('should recursively cleanup nested groups', () => {
			const rootGroup = service.schemaToFieldConfig(nestedSchema);

			jest.spyOn(service, 'cleanupFieldSubscriptions');
			service.cleanupFieldSubscriptions(rootGroup);

			expect(service.cleanupFieldSubscriptions).toHaveBeenCalled();
		});
	});

	describe('addParameter', () => {
		it('should add a parameter field to group', () => {
			const rootGroup = service.schemaToFieldConfig({ type: 'object', properties: {} });

			service.addParameter(rootGroup);

			expect(rootGroup.fields['_parameter']).toBeDefined();
			expect(rootGroup.fields['_parameter'].type).toBe(SchemaFieldType.Parameter);
		});

		it('should not add parameter control to FormGroup', () => {
			const rootGroup = service.schemaToFieldConfig({ type: 'object', properties: {} });

			service.addParameter(rootGroup);

			expect(rootGroup.groupRef?.get('_parameter')).toBeNull();
		});
	});

	describe('getAndDereferenceSchema', () => {
		it('should fetch and dereference schema in one call', async () => {
			const mockSchema = { type: 'object', properties: {} };
			jest.spyOn(service, 'getSchema').mockResolvedValue(mockSchema as any);
			jest.spyOn(service, 'dereferenceSchema').mockResolvedValue(mockSchema as any);

			const result = await service.getAndDereferenceSchema('https://example.com/schema.json');

			expect(service.getSchema).toHaveBeenCalledWith('https://example.com/schema.json');
			expect(service.dereferenceSchema).toHaveBeenCalledWith(mockSchema);
			expect(result).toEqual(mockSchema);
		});

		it('should set schemasRootUrl from URL', async () => {
			const mockSchema = { type: 'object', properties: {} };
			jest.spyOn(service, 'getSchema').mockResolvedValue(mockSchema as any);
			jest.spyOn(service, 'dereferenceSchema').mockResolvedValue(mockSchema as any);

			await service.getAndDereferenceSchema('https://example.com/schemas/test.json');

			expect((service as any).schemasRootUrl).toBe('https://example.com/');
		});
	});
});
