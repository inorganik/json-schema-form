import { TestBed } from '@angular/core/testing';
import { FormArray, FormGroup } from '@angular/forms';

import {
	allOfSchema,
	anyOfSchema,
	arrayConditionalSchema,
	ifThenElseSchema,
	nestedConditionalSchema,
	oneOfSchema,
} from '../mocks/conditional-schema.mock';
import { schemaWithRefs } from '../mocks/ref-schema.mock';
import {
	arrayOfObjectsSchema,
	arraySchema,
	nestedSchema,
	simpleSchema,
} from '../mocks/simple-schema.mock';
import {
	SchemaFieldArray,
	SchemaFieldConfig,
	SchemaFieldGroup,
	SchemaFieldType,
} from '../models/form-models';
import { JsonSchema } from '../models/schema-models';
import { SchemaFormService } from './schema-form.service';

describe('SchemaFormService', () => {
	let service: SchemaFormService;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [SchemaFormService],
		});
		service = TestBed.inject(SchemaFormService);
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

			const result = await service.getSchema('https://example.com/invalid.json');

			expect(result).toBeNull();
		});
	});

	describe('dereferenceSchema', () => {
		it('should collect $defs in defsMap', async () => {
			await service.dereferenceSchema(schemaWithRefs);

			expect(service.defsMap.has('address')).toBe(true);
			expect(service.defsMap.has('person')).toBe(true);
		});
	});

	describe('getAndDereferenceSchema', () => {
		it('should fetch and dereference schema in one call', async () => {
			const example = 'https://example.com/schema.json';
			const mockSchema = { type: 'object', properties: {} };
			jest.spyOn(service, 'getSchema').mockResolvedValue(mockSchema as any);
			jest.spyOn(service, 'dereferenceSchema').mockResolvedValue(mockSchema as any);

			const result = await service.getAndDereferenceSchema(example);

			expect(service.getSchema).toHaveBeenCalledWith(example);
			expect(service.dereferenceSchema).toHaveBeenCalledWith(mockSchema);
			expect(result).toEqual(mockSchema);
		});

		it('should set schemasRootUrl from URL', async () => {
			const mockSchema = { type: 'object', properties: {} };
			jest.spyOn(service, 'getSchema').mockResolvedValue(mockSchema as any);
			jest.spyOn(service, 'dereferenceSchema').mockResolvedValue(mockSchema as any);

			await service.getAndDereferenceSchema('https://example.com/schemas/test.json');

			expect((service as any).schemasRootUrl).toBe('https://example.com');
		});
	});

	describe('schemaToFieldConfig', () => {
		it('should create a root field group', () => {
			const result = service.schemaToFieldConfig(simpleSchema);

			expect(result.type).toBe(SchemaFieldType.Group);
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
				title: 'Status',
				enum: ['a', 'b', 'c', 'd', 'e'],
			};

			service.addField(fieldSchema, rootGroup, 'status', 0);

			const statusField = rootGroup.fields['status'] as SchemaFieldConfig;
			expect(statusField.type).toBe(SchemaFieldType.Select);
			expect(statusField.options?.length).toBe(5);
		});

		it('should add a radio field for enum with 4 or fewer items', () => {
			const rootGroup = service.schemaToFieldConfig({ type: 'object', properties: {} });
			const fieldSchema: JsonSchema = {
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

			const countryField = rootGroup.fields['country'] as SchemaFieldConfig;
			expect(countryField.controlRef.value).toBe('USA');
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

			const nameField = rootGroup.fields['name'] as SchemaFieldGroup;
			expect(nameField.validations).toBeDefined();
			expect(nameField.validations?.minLength).toBe(2);
			expect(nameField.validations?.maxLength).toBe(50);
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

			const addressGroup = rootGroup.fields['address'] as SchemaFieldGroup;
			expect(addressGroup.type).toBe(SchemaFieldType.Group);
			expect(addressGroup.fields['street']).toBeDefined();
			expect(addressGroup.fields['city']).toBeDefined();
		});

		it('should add parameter field for object with no properties', () => {
			const rootGroup = service.schemaToFieldConfig({ type: 'object', properties: {} });
			const groupSchema: JsonSchema = { type: 'object', title: 'Custom Data' };

			service.addGroup(groupSchema, rootGroup, 'customData', 0);

			const group = rootGroup.fields['customData'] as SchemaFieldGroup;
			expect(group.fields['_add_parameter']).toBeDefined();
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

			const arrayField = rootGroup.fields['tags'] as SchemaFieldArray;
			expect(arrayField.validations?.minItems).toBe(1);
			expect(arrayField.validations?.maxItems).toBe(5);
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

			const arrayField = rootGroup.fields['tags'] as SchemaFieldArray;
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

			const arrayField = rootGroup.fields['tags'] as SchemaFieldArray;
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
			const arrayField = rootGroup.fields['tags'] as SchemaFieldArray;

			service.addArrayItem(arrayField);

			expect(arrayField.items.length).toBe(2); // 1 from minItems + 1 added
			expect(arrayField.arrayRef.length).toBe(2);
		});

		it('should add an object item to array', () => {
			const rootGroup = service.schemaToFieldConfig(arrayOfObjectsSchema);
			const arrayField = rootGroup.fields['addresses'] as SchemaFieldArray;

			service.addArrayItem(arrayField);

			expect(arrayField.items.length).toBe(1);
			expect(arrayField.items[0].type).toBe(SchemaFieldType.Group);
		});
	});

	describe('removeArrayItem', () => {
		it('should remove item from array at specified index', () => {
			const rootGroup = service.schemaToFieldConfig(arraySchema);
			const arrayField = rootGroup.fields['tags'] as SchemaFieldArray;

			const initialLength = arrayField.items.length;
			service.removeArrayItem(arrayField, 0);

			expect(arrayField.items.length).toBe(initialLength - 1);
		});

		it('should not remove item if index out of bounds', () => {
			const rootGroup = service.schemaToFieldConfig(arraySchema);
			const arrayField = rootGroup.fields['tags'] as SchemaFieldArray;

			const initialLength = arrayField.items.length;
			service.removeArrayItem(arrayField, 999);

			expect(arrayField.items.length).toBe(initialLength);
		});

		it('should cleanup subscriptions for removed item', () => {
			const rootGroup = service.schemaToFieldConfig(arrayOfObjectsSchema);
			const arrayField = rootGroup.fields['addresses'] as SchemaFieldArray;
			service.addArrayItem(arrayField);

			jest.spyOn(service, 'cleanupFieldSubscriptions');
			service.removeArrayItem(arrayField, 0);

			expect(service.cleanupFieldSubscriptions).toHaveBeenCalled();
		});
	});

	describe('handleOneOf', () => {
		it('should create a radio field for oneOf options', () => {
			const rootGroup = service.schemaToFieldConfig(oneOfSchema);
			const paymentGroup = rootGroup.fields['paymentMethod'] as SchemaFieldGroup;

			expect(paymentGroup.fields['paymentMethod_oneOf']).toBeDefined();
			expect(paymentGroup.fields['paymentMethod_oneOf'].type).toBe(SchemaFieldType.Radio);
		});

		it('should create options from oneOf schemas', () => {
			const rootGroup = service.schemaToFieldConfig(oneOfSchema);
			const paymentGroup = rootGroup.fields['paymentMethod'] as SchemaFieldGroup;
			const radioField = paymentGroup.fields['paymentMethod_oneOf'] as SchemaFieldConfig;

			expect(radioField.options!.length).toBe(2);
			expect(radioField.options![0].label).toBe('Credit Card');
			expect(radioField.options![1].label).toBe('Bank Transfer');
		});

		it('should add conditional schemas for each option', () => {
			const rootGroup = service.schemaToFieldConfig(oneOfSchema);
			const paymentGroup = rootGroup.fields['paymentMethod'] as SchemaFieldGroup;
			const radioField = paymentGroup.fields['paymentMethod_oneOf'];

			expect(radioField.conditionalSchemas?.length).toBe(2);
		});
	});

	describe('handleAnyOf', () => {
		it('should create checkbox fields for anyOf options', () => {
			const rootGroup = service.schemaToFieldConfig(anyOfSchema);
			const featuresGroup = rootGroup.fields['features'] as SchemaFieldGroup;

			expect(featuresGroup.fields['features_option_1']).toBeDefined();
			expect(featuresGroup.fields['features_option_1'].type).toBe(SchemaFieldType.Checkbox);
			expect(featuresGroup.fields['features_option_2']).toBeDefined();
		});

		it('should add conditional schemas to each checkbox', () => {
			const rootGroup = service.schemaToFieldConfig(anyOfSchema);
			const featuresGroup = rootGroup.fields['features'] as SchemaFieldGroup;
			const checkbox1 = featuresGroup.fields['features_option_1'];

			expect(checkbox1.conditionalSchemas!.length).toBe(1);
			expect(checkbox1.conditionalSchemas![0].triggerValue).toBe(true);
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
			const countryField = rootGroup.fields['country'] as SchemaFieldConfig;

			countryField.controlRef.setValue('USA');

			// wait for async
			setTimeout(() => {
				expect(rootGroup.fields['state']).toBeDefined();
			}, 0);
		});

		it('should remove fields when trigger value does not match', () => {
			const rootGroup = service.schemaToFieldConfig(ifThenElseSchema);
			const countryField = rootGroup.fields['country'] as SchemaFieldConfig;

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

	describe('cleanupAndRemoveItem', () => {
		it('should cleanup and remove a field from parent group', () => {
			const rootGroup = service.schemaToFieldConfig(simpleSchema);
			const field = rootGroup.fields['name'] as SchemaFieldConfig;

			expect(rootGroup.fields['name']).toBeDefined();

			(service as any).cleanupAndRemoveItem(field, 'name', rootGroup);

			expect(rootGroup.fields['name']).toBeUndefined();
			expect(rootGroup.groupRef?.get('name')).toBeNull();
		});

		it('should cleanup and remove a nested group from parent', () => {
			const rootGroup = service.schemaToFieldConfig(nestedSchema);
			const userGroup = rootGroup.fields['user'] as SchemaFieldGroup;

			expect(rootGroup.fields['user']).toBeDefined();

			(service as any).cleanupAndRemoveItem(userGroup, 'user', rootGroup);

			expect(rootGroup.fields['user']).toBeUndefined();
			expect(rootGroup.groupRef?.get('user')).toBeNull();
		});

		it('should cleanup and remove an array from parent', () => {
			const rootGroup = service.schemaToFieldConfig(arraySchema);
			const arrayField = rootGroup.fields['tags'] as SchemaFieldArray;

			expect(rootGroup.fields['tags']).toBeDefined();

			(service as any).cleanupAndRemoveItem(arrayField, 'tags', rootGroup);

			expect(rootGroup.fields['tags']).toBeUndefined();
			expect(rootGroup.groupRef?.get('tags')).toBeNull();
		});

		it('should recursively cleanup nested conditional schemas before removal', () => {
			const rootGroup = service.schemaToFieldConfig(ifThenElseSchema);
			const countryField = rootGroup.fields['country'] as SchemaFieldConfig;

			// Trigger conditional to add nested fields
			countryField.controlRef.setValue('USA');

			setTimeout(() => {
				jest.spyOn(service as any, 'cleanupNestedConditionalSchemas');

				(service as any).cleanupAndRemoveItem(countryField, 'country', rootGroup);

				expect((service as any).cleanupNestedConditionalSchemas).toHaveBeenCalledWith(
					countryField,
				);
			}, 0);
		});
	});

	describe('cleanupNestedConditionalSchemas', () => {
		it('should cleanup conditional schemas with addedKeys on a field', () => {
			const rootGroup = service.schemaToFieldConfig(ifThenElseSchema);
			const countryField = rootGroup.fields['country'] as SchemaFieldConfig;

			// Trigger conditional to add the 'state' field
			countryField.controlRef.setValue('USA');

			setTimeout(() => {
				expect(rootGroup.fields['state']).toBeDefined();
				expect(countryField.conditionalSchemas?.[0]?.addedKeys?.length).toBeGreaterThan(0);

				// Cleanup nested conditional schemas
				(service as any).cleanupNestedConditionalSchemas(countryField);

				// The 'state' field should be removed
				expect(rootGroup.fields['state']).toBeUndefined();
				expect(countryField.conditionalSchemas?.[0]?.addedKeys?.length).toBe(0);
			}, 0);
		});

		it('should recursively cleanup conditional schemas in nested groups', () => {
			const rootGroup = service.schemaToFieldConfig(nestedConditionalSchema);
			const enableFeatureField = rootGroup.fields['enableFeature'] as SchemaFieldConfig;

			// Enable the feature to add settings group
			enableFeatureField.controlRef.setValue(true);

			setTimeout(() => {
				expect(rootGroup.fields['settings']).toBeDefined();
				const settingsGroup = rootGroup.fields['settings'] as SchemaFieldGroup;

				// Set mode to advanced to add nested conditional field
				const modeField = settingsGroup.fields['mode'] as SchemaFieldConfig;
				modeField.controlRef.setValue('advanced');

				setTimeout(() => {
					expect(settingsGroup.fields['advancedOption']).toBeDefined();

					// Now cleanup the settings group
					(service as any).cleanupNestedConditionalSchemas(settingsGroup);

					// The advancedOption should be cleaned up
					expect(settingsGroup.fields['advancedOption']).toBeUndefined();
				}, 0);
			}, 0);
		});

		it('should cleanup conditional schemas in arrays', () => {
			const rootGroup = service.schemaToFieldConfig(arrayConditionalSchema);
			const arrayField = rootGroup.fields['items'] as SchemaFieldArray;

			// Add an item to the array
			service.addArrayItem(arrayField);
			const arrayItem = arrayField.items[0] as SchemaFieldGroup;
			const typeField = arrayItem.fields['type'] as SchemaFieldConfig;

			// Trigger conditional
			typeField.controlRef.setValue('typeA');

			setTimeout(() => {
				expect(arrayItem.fields['optionA']).toBeDefined();

				// Cleanup the array
				(service as any).cleanupNestedConditionalSchemas(arrayField);

				// The conditional field should be removed
				expect(arrayItem.fields['optionA']).toBeUndefined();
			}, 0);
		});

		it('should handle cleanup when no conditional schemas exist', () => {
			const rootGroup = service.schemaToFieldConfig(simpleSchema);
			const nameField = rootGroup.fields['name'] as SchemaFieldConfig;

			// This should not throw an error
			expect(() => {
				(service as any).cleanupNestedConditionalSchemas(nameField);
			}).not.toThrow();
		});

		it('should clear addedKeys array after cleanup', () => {
			const rootGroup = service.schemaToFieldConfig(oneOfSchema);
			const paymentMethodGroup = rootGroup.fields['paymentMethod'] as SchemaFieldGroup;
			const radioField = paymentMethodGroup.fields[
				'paymentMethod_oneOf'
			] as SchemaFieldConfig;

			// Select first option (Credit Card)
			radioField.controlRef.setValue(0);

			setTimeout(() => {
				expect(paymentMethodGroup.fields['cardNumber']).toBeDefined();
				const addedKeysBefore = radioField.conditionalSchemas?.[0]?.addedKeys?.length || 0;
				expect(addedKeysBefore).toBeGreaterThan(0);

				// Cleanup
				(service as any).cleanupNestedConditionalSchemas(radioField);

				// addedKeys should be cleared
				expect(radioField.conditionalSchemas?.[0]?.addedKeys?.length).toBe(0);
			}, 0);
		});
	});

	describe('addParameter', () => {
		it('should add a parameter field to group', () => {
			const rootGroup = service.schemaToFieldConfig({ type: 'object', properties: {} });

			service.addParameter(rootGroup);

			expect(rootGroup.fields['_add_parameter']).toBeDefined();
			expect(rootGroup.fields['_add_parameter'].type).toBe(SchemaFieldType.Parameter);
		});

		it('should not add parameter control to FormGroup', () => {
			const rootGroup = service.schemaToFieldConfig({ type: 'object', properties: {} });

			service.addParameter(rootGroup);

			expect(rootGroup.groupRef?.get('_parameter')).toBeNull();
		});
	});

	describe('snakeCaseToLabel', () => {
		it('should properly convert snake case', () => {
			const result = (service as any).snakeCaseToLabel('FLAG_CONTROLLED');

			expect(result).toBe('Flag Controlled');
		});
	});
});
