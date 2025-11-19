import { TestBed } from '@angular/core/testing';
import { FormArray, FormGroup } from '@angular/forms';

import {
	allOfSchema,
	anyOfSchema,
	arrayConditionalSchema,
	enablementSchema,
	ifThenElseSchema,
	mutuallyExclusiveSchema,
	nestedConditionalSchema,
	oneOfSchema,
} from '../mocks/conditional-schema.mock';
import { schemaWithRefs } from '../mocks/ref-schema.mock';
import {
	arrayFieldSchema,
	arrayOfObjectsSchema,
	arraySchema,
	nestedSchema,
	simpleSchema,
	varietySchema,
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

		it('should store required fields array in root group', () => {
			const result = service.schemaToFieldConfig(simpleSchema);

			expect(result.requiredFields).toEqual(['name', 'email']);
		});

		it('should mark only required fields with required validation', () => {
			const result = service.schemaToFieldConfig(simpleSchema);

			// 'name' and 'email' are required in simpleSchema
			const nameField = result.fields['name'] as SchemaFieldConfig;
			const emailField = result.fields['email'] as SchemaFieldConfig;
			const ageField = result.fields['age'] as SchemaFieldConfig;
			const activeField = result.fields['active'] as SchemaFieldConfig;

			expect(nameField.validations?.required).toBe(true);
			expect(emailField.validations?.required).toBe(true);
			expect(ageField.validations?.required).toBeUndefined();
			expect(activeField.validations?.required).toBeUndefined();
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

	describe('patchValue', () => {
		it('should call prepareStructureForValue and patchValue on the form group', () => {
			const rootGroup = service.schemaToFieldConfig(simpleSchema);
			const value = { name: 'John', age: 30 };

			jest.spyOn(service as any, 'prepareStructureForValue');
			jest.spyOn(rootGroup.groupRef, 'patchValue');

			service.patchValue(rootGroup, value);

			expect((service as any).prepareStructureForValue).toHaveBeenCalledWith(
				rootGroup,
				value,
			);
			expect(rootGroup.groupRef.patchValue).toHaveBeenCalledWith(value);
		});
	});

	describe('prepareStructureForValue', () => {
		it('should return early if value is null', () => {
			const rootGroup = service.schemaToFieldConfig(simpleSchema);
			jest.spyOn(service as any, 'addAdditionalPropertiesFromValue');
			(service as any).prepareStructureForValue(rootGroup, null);

			expect((service as any).addAdditionalPropertiesFromValue).not.toHaveBeenCalled();
		});

		it('should return early if value is undefined', () => {
			const rootGroup = service.schemaToFieldConfig(simpleSchema);
			jest.spyOn(service as any, 'addAdditionalPropertiesFromValue');
			(service as any).prepareStructureForValue(rootGroup, undefined);

			expect((service as any).addAdditionalPropertiesFromValue).not.toHaveBeenCalled();
		});

		it('should return early if value is not an object', () => {
			const rootGroup = service.schemaToFieldConfig(simpleSchema);
			jest.spyOn(service as any, 'addAdditionalPropertiesFromValue');
			(service as any).prepareStructureForValue(rootGroup, 'string');

			expect((service as any).addAdditionalPropertiesFromValue).not.toHaveBeenCalled();
		});

		it('should call addAdditionalPropertiesFromValue if group has additionalProperties', () => {
			const schema: JsonSchema = {
				type: 'object',
				properties: {},
				additionalProperties: true,
			};
			const rootGroup = service.schemaToFieldConfig(schema);
			const value = { customField: 'test' };
			jest.spyOn(service as any, 'addAdditionalPropertiesFromValue');

			(service as any).prepareStructureForValue(rootGroup, value);

			// Note: The field group needs to have additionalProperties set to true
			// which is done in schemaToFieldConfig based on the schema
			if (rootGroup.additionalProperties) {
				expect((service as any).addAdditionalPropertiesFromValue).toHaveBeenCalledWith(
					rootGroup,
					value,
				);
			}
		});

		it('should add array items to match the value array length', () => {
			const rootGroup = service.schemaToFieldConfig(arraySchema);
			const array = rootGroup.fields['tags'] as SchemaFieldArray;
			const value = { tags: ['tag1', 'tag2', 'tag3'] };
			expect(array.items.length).toBe(1); // minItems: 1
			(service as any).prepareStructureForValue(rootGroup, value);

			expect(array.items.length).toBe(3);
		});

		it('should recursively prepare nested groups in arrays', () => {
			const rootGroup = service.schemaToFieldConfig(arrayOfObjectsSchema);
			const array = rootGroup.fields['addresses'] as SchemaFieldArray;
			const value = {
				addresses: [{ street: '123 Main St', city: 'NYC' }],
			};
			jest.spyOn(service as any, 'prepareStructureForValue');
			(service as any).prepareStructureForValue(rootGroup, value);

			expect(array.items.length).toBe(1);
			// Should be called recursively for the nested group
			expect((service as any).prepareStructureForValue).toHaveBeenCalledTimes(2);
		});

		it('should not add array items if value for array is not an array', () => {
			const rootGroup = service.schemaToFieldConfig(arraySchema);
			const array = rootGroup.fields['tags'] as SchemaFieldArray;
			const value = { tags: 'not-an-array' };
			const initialLength = array.items.length;

			(service as any).prepareStructureForValue(rootGroup, value);

			expect(array.items.length).toBe(initialLength);
		});

		it('should select oneOf option based on value', () => {
			const rootGroup = service.schemaToFieldConfig(oneOfSchema);
			const value = {
				paymentMethod: {
					cardNumber: '1234-5678',
					cvv: '123',
				},
			};
			jest.spyOn(service as any, 'selectOneOfOption');
			(service as any).prepareStructureForValue(rootGroup, value);

			expect((service as any).selectOneOfOption).toHaveBeenCalled();
		});

		it('should select anyOf options based on value', () => {
			const rootGroup = service.schemaToFieldConfig(anyOfSchema);
			const value = {
				features: {
					optionA: 'value A',
				},
			};
			jest.spyOn(service as any, 'selectAnyOfOptions');
			(service as any).prepareStructureForValue(rootGroup, value);

			expect((service as any).selectAnyOfOptions).toHaveBeenCalled();
		});

		it('should handle if/then/else conditional schemas', () => {
			const rootGroup = service.schemaToFieldConfig(ifThenElseSchema);
			const value = {
				country: 'USA',
			};
			jest.spyOn(service as any, 'handleIfThenElseForPatch');
			(service as any).prepareStructureForValue(rootGroup, value);

			expect((service as any).handleIfThenElseForPatch).toHaveBeenCalled();
		});

		it('should not call handleIfThenElseForPatch if value for field is undefined', () => {
			const rootGroup = service.schemaToFieldConfig(ifThenElseSchema);
			const value = { someOtherField: 'test' };
			jest.spyOn(service as any, 'handleIfThenElseForPatch');

			(service as any).prepareStructureForValue(rootGroup, value);

			expect((service as any).handleIfThenElseForPatch).not.toHaveBeenCalled();
		});

		it('should recursively prepare nested groups', () => {
			const rootGroup = service.schemaToFieldConfig(nestedSchema);
			const value = {
				user: {
					firstName: 'John',
					lastName: 'Doe',
				},
			};
			const spy = jest.spyOn(service as any, 'prepareStructureForValue');
			(service as any).prepareStructureForValue(rootGroup, value);

			// Should be called for root and nested group
			expect(spy).toHaveBeenCalledTimes(2);
		});

		it('should not recursively prepare nested groups if value for group is undefined', () => {
			const rootGroup = service.schemaToFieldConfig(nestedSchema);
			const value = { name: 'John' }; // No user field
			const spy = jest.spyOn(service as any, 'prepareStructureForValue');

			(service as any).prepareStructureForValue(rootGroup, value);

			// Should only be called once for root, not for nested group
			expect(spy).toHaveBeenCalledTimes(1);
		});
	});

	describe('addAdditionalPropertiesFromValue', () => {
		it('should return early if value is null', () => {
			const schema: JsonSchema = {
				type: 'object',
				properties: {},
				additionalProperties: true,
			};
			const rootGroup = service.schemaToFieldConfig(schema);
			jest.spyOn(service, 'addField');

			(service as any).addAdditionalPropertiesFromValue(rootGroup, null);

			expect(service.addField).not.toHaveBeenCalled();
		});

		it('should return early if value is undefined', () => {
			const schema: JsonSchema = {
				type: 'object',
				properties: {},
				additionalProperties: true,
			};
			const rootGroup = service.schemaToFieldConfig(schema);
			jest.spyOn(service, 'addField');

			(service as any).addAdditionalPropertiesFromValue(rootGroup, undefined);

			expect(service.addField).not.toHaveBeenCalled();
		});

		it('should return early if value is not an object', () => {
			const schema: JsonSchema = {
				type: 'object',
				properties: {},
				additionalProperties: true,
			};
			const rootGroup = service.schemaToFieldConfig(schema);
			jest.spyOn(service, 'addField');

			(service as any).addAdditionalPropertiesFromValue(rootGroup, 'string');

			expect(service.addField).not.toHaveBeenCalled();
		});

		it('should add string field for additional string property', () => {
			const schema: JsonSchema = {
				type: 'object',
				properties: {},
				additionalProperties: true,
			};
			const rootGroup = service.schemaToFieldConfig(schema);
			const value = { customString: 'test' };

			(service as any).addAdditionalPropertiesFromValue(rootGroup, value);

			expect(rootGroup.fields['customString']).toBeDefined();
			expect(rootGroup.fields['customString'].type).toBe(SchemaFieldType.Text);
		});

		it('should add number field for additional number property', () => {
			const schema: JsonSchema = {
				type: 'object',
				properties: {},
				additionalProperties: true,
			};
			const rootGroup = service.schemaToFieldConfig(schema);
			const value = { customNumber: 42 };

			(service as any).addAdditionalPropertiesFromValue(rootGroup, value);

			expect(rootGroup.fields['customNumber']).toBeDefined();
			expect(rootGroup.fields['customNumber'].type).toBe(SchemaFieldType.Number);
		});

		it('should treat null value as string type', () => {
			const schema: JsonSchema = {
				type: 'object',
				properties: {},
				additionalProperties: true,
			};
			const rootGroup = service.schemaToFieldConfig(schema);
			const value: any = { customNull: null };

			(service as any).addAdditionalPropertiesFromValue(rootGroup, value);

			expect(rootGroup.fields['customNull']).toBeDefined();
			expect(rootGroup.fields['customNull'].type).toBe(SchemaFieldType.Text);
		});

		it('should skip existing fields', () => {
			const schema: JsonSchema = {
				type: 'object',
				properties: {
					existingField: { type: 'string' },
				},
				additionalProperties: true,
			};
			const rootGroup = service.schemaToFieldConfig(schema);
			const value = { existingField: 'test', newField: 'new' };
			jest.spyOn(service, 'addField');

			(service as any).addAdditionalPropertiesFromValue(rootGroup, value);

			// Should only be called once for newField, not for existingField
			expect(service.addField).toHaveBeenCalledTimes(1);
			expect(service.addField).toHaveBeenCalledWith(
				{ type: 'string' },
				rootGroup,
				'newField',
				undefined,
				true,
			);
		});

		it('should skip fields starting with underscore', () => {
			const schema: JsonSchema = {
				type: 'object',
				properties: {},
				additionalProperties: true,
			};
			const rootGroup = service.schemaToFieldConfig(schema);
			const value = { _internalField: 'test', normalField: 'normal' };
			jest.spyOn(service, 'addField');

			(service as any).addAdditionalPropertiesFromValue(rootGroup, value);

			// Should only be called once for normalField, not for _internalField
			expect(service.addField).toHaveBeenCalledTimes(1);
			expect(service.addField).toHaveBeenCalledWith(
				{ type: 'string' },
				rootGroup,
				'normalField',
				undefined,
				true,
			);
		});

		it('should skip array values', () => {
			const schema: JsonSchema = {
				type: 'object',
				properties: {},
				additionalProperties: true,
			};
			const rootGroup = service.schemaToFieldConfig(schema);
			const value = { arrayField: ['a', 'b'], stringField: 'test' };
			jest.spyOn(service, 'addField');

			(service as any).addAdditionalPropertiesFromValue(rootGroup, value);

			// Should only be called for stringField, not for arrayField
			expect(service.addField).toHaveBeenCalledTimes(1);
			expect(service.addField).toHaveBeenCalledWith(
				{ type: 'string' },
				rootGroup,
				'stringField',
				undefined,
				true,
			);
		});

		it('should skip object values', () => {
			const schema: JsonSchema = {
				type: 'object',
				properties: {},
				additionalProperties: true,
			};
			const rootGroup = service.schemaToFieldConfig(schema);
			const value = { objectField: { nested: 'value' }, stringField: 'test' };
			jest.spyOn(service, 'addField');

			(service as any).addAdditionalPropertiesFromValue(rootGroup, value);

			// Should only be called for stringField, not for objectField
			expect(service.addField).toHaveBeenCalledTimes(1);
			expect(service.addField).toHaveBeenCalledWith(
				{ type: 'string' },
				rootGroup,
				'stringField',
				undefined,
				true,
			);
		});
	});

	describe('handleConditionalSchemaForPatch', () => {
		it('should recursively prepare nested groups added by conditional schemas', done => {
			const schema: JsonSchema = {
				type: 'object',
				properties: {
					enableFeatures: { type: 'boolean' },
				},
				allOf: [
					{
						if: {
							properties: { enableFeatures: { const: true } },
						},
						then: {
							properties: {
								features: {
									type: 'object',
									properties: {
										feature1: { type: 'string' },
										feature2: { type: 'string' },
									},
								},
							},
						},
					},
				],
			};

			const rootGroup = service.schemaToFieldConfig(schema);
			const value = {
				enableFeatures: true,
				features: { feature1: 'test1', feature2: 'test2' },
			};

			const spy = jest.spyOn(service as any, 'prepareStructureForValue');

			// Simulate conditional field being added
			const enableFeaturesField = rootGroup.fields['enableFeatures'] as SchemaFieldConfig;
			enableFeaturesField.controlRef.setValue(true);
			setTimeout(() => {
				const addedKeys = ['features'];
				(service as any).handleConditionalSchemaForPatch(rootGroup, addedKeys, value);

				expect(spy).toHaveBeenCalled();
				done();
			}, 0);
		});

		it('should handle oneOf in conditionally added groups', () => {
			const rootGroup = service.schemaToFieldConfig(enablementSchema);
			const value = {
				status: 'FLAG_CONTROLLED',
				flags: { featureFlag: 'test-flag' },
			};

			service.patchValue(rootGroup, value);

			expect(rootGroup.fields['flags']).toBeDefined();
			const flagsGroup = rootGroup.fields['flags'] as SchemaFieldGroup;
			const radioKey = Object.keys(flagsGroup.fields).find(k => k.endsWith('oneOf-option'));
			expect(radioKey).toBeDefined();

			if (radioKey) {
				const radioField = flagsGroup.fields[radioKey] as SchemaFieldConfig;
				expect(radioField.controlRef.value).toBe('feature_flag');
			}
		});

		it('should handle anyOf in conditionally added groups', () => {
			const schema: JsonSchema = {
				type: 'object',
				properties: {
					enableOptions: { type: 'boolean' },
				},
				allOf: [
					{
						if: {
							properties: { enableOptions: { const: true } },
						},
						then: {
							properties: {
								options: {
									anyOf: [
										{
											title: 'Option A',
											properties: {
												optionA: { type: 'string' },
											},
										},
										{
											title: 'Option B',
											properties: {
												optionB: { type: 'string' },
											},
										},
									],
								},
							},
						},
					},
				],
			};

			const rootGroup = service.schemaToFieldConfig(schema);
			const value = {
				enableOptions: true,
				options: { optionA: 'valueA', optionB: 'valueB' },
			};

			jest.spyOn(service as any, 'selectAnyOfOptions');
			service.patchValue(rootGroup, value);

			expect((service as any).selectAnyOfOptions).toHaveBeenCalled();
		});

		it('should handle arrays in conditionally added fields', () => {
			const schema: JsonSchema = {
				type: 'object',
				properties: {
					hasItems: { type: 'boolean' },
				},
				allOf: [
					{
						if: {
							properties: { hasItems: { const: true } },
						},
						then: {
							properties: {
								items: {
									type: 'array',
									items: { type: 'string' },
								},
							},
						},
					},
				],
			};

			const rootGroup = service.schemaToFieldConfig(schema);
			const value = {
				hasItems: true,
				items: ['item1', 'item2', 'item3'],
			};

			service.patchValue(rootGroup, value);

			expect(rootGroup.fields['items']).toBeDefined();
			const itemsArray = rootGroup.fields['items'] as SchemaFieldArray;
			expect(itemsArray.items.length).toBe(3);
		});

		it('should handle oneOf radio fields added at parent level', () => {
			const rootGroup = service.schemaToFieldConfig(simpleSchema);
			const value = { option: 'value1' };

			// Manually add a conditional oneOf radio field to simulate this scenario
			const radioKey = '_test_oneOf-option';
			const radioSchema: JsonSchema = { type: 'string' };
			service.addField(radioSchema, rootGroup, radioKey, 0);
			rootGroup.fields[radioKey].type = SchemaFieldType.Radio;
			rootGroup.fields[radioKey].conditionalSchemas = [
				{
					triggerValue: 'option1',
					schema: { properties: { field1: { type: 'string' } } },
					addedKeys: ['field1'],
				},
			];

			jest.spyOn(service as any, 'selectOneOfOption');
			(service as any).handleConditionalSchemaForPatch(rootGroup, [radioKey], value);

			expect((service as any).selectOneOfOption).toHaveBeenCalled();
		});

		it('should handle anyOf checkbox fields added at parent level', () => {
			const rootGroup = service.schemaToFieldConfig(simpleSchema);
			const value = { optionA: 'valueA' };

			// Manually add conditional anyOf checkbox fields to simulate this scenario
			const checkboxKey1 = 'test_anyOf-option_1';
			const checkboxKey2 = 'test_anyOf-option_2';
			const checkboxSchema: JsonSchema = { type: 'boolean' };

			service.addField(checkboxSchema, rootGroup, checkboxKey1, 0);
			rootGroup.fields[checkboxKey1].type = SchemaFieldType.Checkbox;

			service.addField(checkboxSchema, rootGroup, checkboxKey2, 0);
			rootGroup.fields[checkboxKey2].type = SchemaFieldType.Checkbox;

			jest.spyOn(service as any, 'selectAnyOfOptions');
			(service as any).handleConditionalSchemaForPatch(
				rootGroup,
				[checkboxKey1, checkboxKey2],
				value,
			);

			expect((service as any).selectAnyOfOptions).toHaveBeenCalled();
		});
	});

	describe('handleIfThenElseForPatch', () => {
		it('should trigger handleConditionalSchemas to add fields', () => {
			const rootGroup = service.schemaToFieldConfig(ifThenElseSchema);
			const countryField = rootGroup.fields['country'] as SchemaFieldConfig;
			const value = { country: 'USA' };

			jest.spyOn(service as any, 'handleConditionalSchemas');

			(service as any).handleIfThenElseForPatch(countryField, 'USA', rootGroup, value);

			expect((service as any).handleConditionalSchemas).toHaveBeenCalledWith(
				countryField,
				'USA',
				rootGroup,
			);
		});

		it('should recursively prepare nested structures in added fields', () => {
			const rootGroup = service.schemaToFieldConfig(ifThenElseSchema);
			const countryField = rootGroup.fields['country'] as SchemaFieldConfig;
			const value = { country: 'USA', state: 'CA' };

			jest.spyOn(service as any, 'handleConditionalSchemaForPatch');

			(service as any).handleIfThenElseForPatch(countryField, 'USA', rootGroup, value);

			expect((service as any).handleConditionalSchemaForPatch).toHaveBeenCalled();
		});

		it('should set field value without emitting event', () => {
			const rootGroup = service.schemaToFieldConfig(ifThenElseSchema);
			const countryField = rootGroup.fields['country'] as SchemaFieldConfig;
			const value = { country: 'USA' };

			jest.spyOn(countryField.controlRef, 'setValue');

			(service as any).handleIfThenElseForPatch(countryField, 'USA', rootGroup, value);

			expect(countryField.controlRef.setValue).toHaveBeenCalledWith('USA', {
				emitEvent: false,
			});
		});

		it('should find matching conditional schema by trigger value', () => {
			const rootGroup = service.schemaToFieldConfig(ifThenElseSchema);
			const countryField = rootGroup.fields['country'] as SchemaFieldConfig;
			const value = { country: 'USA', state: 'CA' };

			(service as any).handleIfThenElseForPatch(countryField, 'USA', rootGroup, value);

			// The 'state' field should be added
			expect(rootGroup.fields['state']).toBeDefined();
		});
	});

	describe('selectOneOfOption', () => {
		it('should return early if radio field is not found', () => {
			const rootGroup = service.schemaToFieldConfig(simpleSchema);
			const value = { test: 'value' };

			jest.spyOn(service as any, 'handleConditionalSchemas');

			(service as any).selectOneOfOption(rootGroup, 'nonexistent_radio', value);

			expect((service as any).handleConditionalSchemas).not.toHaveBeenCalled();
		});

		it('should return early if radio field has no conditional schemas', () => {
			const rootGroup = service.schemaToFieldConfig(simpleSchema);
			// Add a radio field without conditional schemas
			const radioSchema: JsonSchema = { type: 'string' };
			service.addField(radioSchema, rootGroup, 'testRadio', 0);
			rootGroup.fields['testRadio'].type = SchemaFieldType.Radio;

			const value = { test: 'value' };
			jest.spyOn(service as any, 'handleConditionalSchemas');

			(service as any).selectOneOfOption(rootGroup, 'testRadio', value);

			expect((service as any).handleConditionalSchemas).not.toHaveBeenCalled();
		});

		it('should match value against oneOf schemas and select correct option', () => {
			const rootGroup = service.schemaToFieldConfig(oneOfSchema);
			const paymentGroup = rootGroup.fields['paymentMethod'] as SchemaFieldGroup;
			const radioKey = '_paymentMethod_oneOf-option';
			const value = {
				cardNumber: '1234-5678',
				cvv: '123',
			};

			jest.spyOn(service as any, 'valueMatchesSchema').mockReturnValue(true);

			(service as any).selectOneOfOption(paymentGroup, radioKey, value);

			expect((service as any).valueMatchesSchema).toHaveBeenCalled();
		});

		it('should set radio control value to the schema ID', () => {
			const rootGroup = service.schemaToFieldConfig(oneOfSchema);
			const paymentGroup = rootGroup.fields['paymentMethod'] as SchemaFieldGroup;
			const radioKey = '_paymentMethod_oneOf-option';
			const radioField = paymentGroup.fields[radioKey] as SchemaFieldConfig;
			const value = {
				cardNumber: '1234-5678',
				cvv: '123',
			};

			jest.spyOn(radioField.controlRef, 'setValue');

			(service as any).selectOneOfOption(paymentGroup, radioKey, value);

			expect(radioField.controlRef.setValue).toHaveBeenCalledWith(expect.any(String), {
				emitEvent: false,
			});
		});

		it('should recursively prepare conditionally added fields', () => {
			const rootGroup = service.schemaToFieldConfig(oneOfSchema);
			const paymentGroup = rootGroup.fields['paymentMethod'] as SchemaFieldGroup;
			const radioKey = '_paymentMethod_oneOf-option';
			const value = {
				cardNumber: '1234-5678',
				cvv: '123',
			};

			jest.spyOn(service as any, 'handleConditionalSchemaForPatch');

			(service as any).selectOneOfOption(paymentGroup, radioKey, value);

			expect((service as any).handleConditionalSchemaForPatch).toHaveBeenCalled();
		});
	});

	describe('selectAnyOfOptions', () => {
		it('should skip checkbox if not found', () => {
			const rootGroup = service.schemaToFieldConfig(simpleSchema);
			const value = { test: 'value' };

			jest.spyOn(service as any, 'handleConditionalSchemas');

			(service as any).selectAnyOfOptions(rootGroup, ['nonexistent_checkbox'], value);

			expect((service as any).handleConditionalSchemas).not.toHaveBeenCalled();
		});

		it('should skip checkbox if it has no conditional schemas', () => {
			const rootGroup = service.schemaToFieldConfig(simpleSchema);
			const checkboxSchema: JsonSchema = { type: 'boolean' };
			service.addField(checkboxSchema, rootGroup, 'testCheckbox', 0);
			rootGroup.fields['testCheckbox'].type = SchemaFieldType.Checkbox;

			const value = { test: 'value' };
			jest.spyOn(service as any, 'handleConditionalSchemas');

			(service as any).selectAnyOfOptions(rootGroup, ['testCheckbox'], value);

			expect((service as any).handleConditionalSchemas).not.toHaveBeenCalled();
		});

		it('should match value against anyOf schemas and check matching options', () => {
			const rootGroup = service.schemaToFieldConfig(anyOfSchema);
			const featuresGroup = rootGroup.fields['features'] as SchemaFieldGroup;
			const checkboxKeys = Object.keys(featuresGroup.fields).filter(k =>
				k.includes('anyOf-option'),
			);
			const value = {
				optionA: 'value A',
			};

			jest.spyOn(service as any, 'valueMatchesSchema').mockReturnValue(true);

			(service as any).selectAnyOfOptions(featuresGroup, checkboxKeys, value);

			expect((service as any).valueMatchesSchema).toHaveBeenCalled();
		});

		it('should set checkbox control value to true for matching schemas', () => {
			const rootGroup = service.schemaToFieldConfig(anyOfSchema);
			const featuresGroup = rootGroup.fields['features'] as SchemaFieldGroup;
			const checkboxKeys = Object.keys(featuresGroup.fields).filter(k =>
				k.includes('anyOf-option'),
			);
			const firstCheckbox = featuresGroup.fields[checkboxKeys[0]] as SchemaFieldConfig;
			const value = {
				optionA: 'value A',
			};

			jest.spyOn(firstCheckbox.controlRef, 'setValue');
			jest.spyOn(service as any, 'valueMatchesSchema')
				.mockReturnValueOnce(true)
				.mockReturnValueOnce(false);

			(service as any).selectAnyOfOptions(featuresGroup, checkboxKeys, value);

			expect(firstCheckbox.controlRef.setValue).toHaveBeenCalledWith(true, {
				emitEvent: false,
			});
		});

		it('should recursively prepare conditionally added fields', () => {
			const rootGroup = service.schemaToFieldConfig(anyOfSchema);
			const featuresGroup = rootGroup.fields['features'] as SchemaFieldGroup;
			const checkboxKeys = Object.keys(featuresGroup.fields).filter(k =>
				k.includes('anyOf-option'),
			);
			const value = {
				optionA: 'value A',
			};

			jest.spyOn(service as any, 'handleConditionalSchemaForPatch');
			jest.spyOn(service as any, 'valueMatchesSchema')
				.mockReturnValueOnce(true)
				.mockReturnValueOnce(false);

			(service as any).selectAnyOfOptions(featuresGroup, checkboxKeys, value);

			expect((service as any).handleConditionalSchemaForPatch).toHaveBeenCalled();
		});
	});

	describe('valueMatchesSchema', () => {
		it('should return false if schema is null', () => {
			const value = { test: 'value' };
			const result = (service as any).valueMatchesSchema(value, null);

			expect(result).toBe(false);
		});

		it('should return false if value is null', () => {
			const schema: JsonSchema = { type: 'object', properties: {} };
			const result = (service as any).valueMatchesSchema(null, schema);

			expect(result).toBe(false);
		});

		it('should return false if value is not an object', () => {
			const schema: JsonSchema = { type: 'object', properties: {} };
			const result = (service as any).valueMatchesSchema('string', schema);

			expect(result).toBe(false);
		});

		it('should resolve $ref and match against resolved schema', () => {
			service.defsMap.set('testDef', {
				type: 'object',
				properties: {
					testField: { type: 'string', const: 'testValue' },
				},
			});

			const schema: JsonSchema = { $ref: '#/$defs/testDef' };
			const value = { testField: 'testValue' };

			const result = (service as any).valueMatchesSchema(value, schema);

			expect(result).toBe(true);
		});

		it('should return false if $ref cannot be resolved', () => {
			const schema: JsonSchema = { $ref: '#/$defs/nonexistent' };
			const value = { test: 'value' };

			const result = (service as any).valueMatchesSchema(value, schema);

			expect(result).toBe(false);
		});

		it('should match using discriminator (const property)', () => {
			const schema: JsonSchema = {
				type: 'object',
				properties: {
					type: { type: 'string', const: 'credit_card' },
					cardNumber: { type: 'string' },
				},
			};
			const value = {
				type: 'credit_card',
				cardNumber: '1234',
			};

			const result = (service as any).valueMatchesSchema(value, schema);

			expect(result).toBe(true);
		});

		it('should return false if discriminator does not match', () => {
			const schema: JsonSchema = {
				type: 'object',
				properties: {
					type: { type: 'string', const: 'credit_card' },
				},
			};
			const value = {
				type: 'bank_transfer',
			};

			const result = (service as any).valueMatchesSchema(value, schema);

			expect(result).toBe(false);
		});

		it('should match using required properties', () => {
			const schema: JsonSchema = {
				type: 'object',
				properties: {
					cardNumber: { type: 'string' },
					cvv: { type: 'string' },
				},
				required: ['cardNumber', 'cvv'],
			};
			const value = {
				cardNumber: '1234',
				cvv: '123',
			};

			const result = (service as any).valueMatchesSchema(value, schema);

			expect(result).toBe(true);
		});

		it('should return false if required properties are missing', () => {
			const schema: JsonSchema = {
				type: 'object',
				properties: {
					cardNumber: { type: 'string' },
					cvv: { type: 'string' },
				},
				required: ['cardNumber', 'cvv'],
			};
			const value = {
				cardNumber: '1234',
			};

			const result = (service as any).valueMatchesSchema(value, schema);

			expect(result).toBe(false);
		});

		it('should fallback to matching any property if no required fields', () => {
			const schema: JsonSchema = {
				type: 'object',
				properties: {
					optionA: { type: 'string' },
					optionB: { type: 'string' },
				},
			};
			const value = {
				optionA: 'valueA',
			};

			const result = (service as any).valueMatchesSchema(value, schema);

			expect(result).toBe(true);
		});

		it('should return false if value has none of the schema properties', () => {
			const schema: JsonSchema = {
				type: 'object',
				properties: {
					optionA: { type: 'string' },
					optionB: { type: 'string' },
				},
			};
			const value = {
				optionC: 'valueC',
			};

			const result = (service as any).valueMatchesSchema(value, schema);

			expect(result).toBe(false);
		});

		it('should return true if no specific matching criteria', () => {
			const schema: JsonSchema = { type: 'object' };
			const value = { anything: 'goes' };

			const result = (service as any).valueMatchesSchema(value, schema);

			expect(result).toBe(true);
		});
	});

	describe('patchValue integration tests', () => {
		it('should select correct oneOf option for conditionally added field', () => {
			const rootGroup = service.schemaToFieldConfig(ifThenElseSchema);
			const value = {
				country: 'USA',
				state: 'CA',
			};
			service.patchValue(rootGroup, value);

			// The state field should be added by the if/then conditional
			expect(rootGroup.fields['state']).toBeDefined();
			// The state field control should have the value patched
			const stateField = rootGroup.fields['state'] as SchemaFieldConfig;
			expect(stateField.controlRef.value).toBe('CA');
		});

		it('should select correct oneOf option when patching nested oneOf in conditional fields', () => {
			// Create a schema with if/then that adds a oneOf field
			const schema: JsonSchema = {
				type: 'object',
				properties: {
					status: {
						type: 'string',
						enum: ['FLAG_CONTROLLED', 'ENABLED'],
					},
				},
				allOf: [
					{
						if: {
							properties: {
								status: {
									const: 'FLAG_CONTROLLED',
								},
							},
						},
						then: {
							properties: {
								flags: {
									oneOf: [
										{
											title: 'Product flag',
											properties: {
												productFlag: {
													type: 'string',
												},
											},
											required: ['productFlag'],
										},
										{
											title: 'Feature flag',
											properties: {
												featureFlag: {
													type: 'string',
												},
											},
											required: ['featureFlag'],
										},
									],
								},
							},
							required: ['flags'],
						},
					},
				],
			};

			const rootGroup = service.schemaToFieldConfig(schema);

			const value = {
				status: 'FLAG_CONTROLLED',
				flags: {
					featureFlag: 'test-flag',
				},
			};
			service.patchValue(rootGroup, value);

			expect(rootGroup.fields['flags']).toBeDefined();

			const flagsGroup = rootGroup.fields['flags'] as SchemaFieldGroup;
			const radioKey = Object.keys(flagsGroup.fields).find(k => k.endsWith('oneOf-option'));
			expect(radioKey).toBeDefined();

			if (radioKey) {
				const radioField = flagsGroup.fields[radioKey] as SchemaFieldConfig;
				expect(radioField.controlRef.value).toBe('feature_flag');
				expect(flagsGroup.fields['featureFlag']).toBeDefined();
			}
		});
	});

	describe('getAllFormErrors', () => {
		it('should get all errors in a group config', () => {
			const rootGroup = service.schemaToFieldConfig(varietySchema);
			rootGroup.groupRef.patchValue({
				name: 'J',
				email: 'jamie@example',
				enabled: true,
				status: {
					priority: 'low',
				},
				columns: [{ title: 'foo', components: [] }],
			});

			const errors = service.getAllFormErrors(rootGroup);
			expect(errors).toHaveLength(3);
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

			service.addArray(arrayFieldSchema, rootGroup, 'columns', 0);

			expect(rootGroup.fields['columns']).toBeDefined();
			expect(rootGroup.fields['columns'].type).toBe(SchemaFieldType.Array);
			expect(rootGroup.groupRef?.get('columns')).toBeInstanceOf(FormArray);
		});

		it('should store itemSchema for later use', () => {
			const rootGroup = service.schemaToFieldConfig({ type: 'object', properties: {} });

			service.addArray(arrayFieldSchema, rootGroup, 'columns', 0);

			const arrayField = rootGroup.fields['columns'];
			expect((arrayField as any).itemSchema).toBeDefined();
		});

		it('should add validations for minItems and maxItems', () => {
			const rootGroup = service.schemaToFieldConfig({ type: 'object', properties: {} });

			service.addArray(arrayFieldSchema, rootGroup, 'columns', 0);

			const arrayField = rootGroup.fields['columns'] as SchemaFieldArray;
			expect(arrayField.validations?.minItems).toBe(1);
			expect(arrayField.validations?.maxItems).toBe(5);
		});

		it('should add minimum required items if minItems specified', () => {
			const rootGroup = service.schemaToFieldConfig({ type: 'object', properties: {} });

			const schema = { ...arrayFieldSchema, minItems: 2 };
			service.addArray(schema, rootGroup, 'columns', 0);

			const arrayField = rootGroup.fields['columns'];
			expect((arrayField as any).items.length).toBe(2);
		});

		it('should implement canAddItem based on maxItems', () => {
			const rootGroup = service.schemaToFieldConfig({ type: 'object', properties: {} });

			const schema = { ...arrayFieldSchema, maxItems: 3 };
			service.addArray(schema, rootGroup, 'columns', 0);

			const arrayField = rootGroup.fields['columns'] as SchemaFieldArray;
			expect(arrayField.canAddItem()).toBe(true);

			// Add 3 items
			service.addArrayItem(arrayField);
			service.addArrayItem(arrayField);
			service.addArrayItem(arrayField);

			expect(arrayField.canAddItem()).toBe(false);
		});

		it('should implement canRemoveItem based on minItems', () => {
			const rootGroup = service.schemaToFieldConfig({ type: 'object', properties: {} });

			const schema = { ...arrayFieldSchema, minItems: 2 };
			service.addArray(schema, rootGroup, 'columns', 0);

			const arrayField = rootGroup.fields['columns'] as SchemaFieldArray;
			expect(arrayField.canRemoveItem()).toBe(false); // Already at minItems
		});

		it('should only mark specified fields as required in array item objects', () => {
			const rootGroup = service.schemaToFieldConfig({ type: 'object', properties: {} });
			service.addArray(arrayFieldSchema, rootGroup, 'columns', 0);

			const arrayField = rootGroup.fields['columns'] as SchemaFieldArray;
			const firstItem = arrayField.items[0] as SchemaFieldGroup;

			// Check that the item group has the correct requiredFields
			expect(firstItem.requiredFields).toEqual(['components']);

			// Check that only the 'title' field is NOT marked as required
			const titleField = firstItem.fields['title'] as SchemaFieldConfig;
			expect(titleField.validations?.required).toBeUndefined(); // Not required

			// Verify components field exists (it's an array, so it won't have 'required' validation)
			const componentsField = firstItem.fields['components'];
			expect(componentsField).toBeDefined();
			expect(componentsField.type).toBe(SchemaFieldType.Array);
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

			expect(paymentGroup.fields['_paymentMethod_oneOf-option']).toBeDefined();
			expect(paymentGroup.fields['_paymentMethod_oneOf-option'].type).toBe(
				SchemaFieldType.Radio,
			);
		});

		it('should create options from oneOf schemas', () => {
			const rootGroup = service.schemaToFieldConfig(oneOfSchema);
			const paymentGroup = rootGroup.fields['paymentMethod'] as SchemaFieldGroup;
			const radioField = paymentGroup.fields[
				'_paymentMethod_oneOf-option'
			] as SchemaFieldConfig;

			expect(radioField.options!.length).toBe(2);
			expect(radioField.options![0].label).toBe('Credit Card');
			expect(radioField.options![1].label).toBe('Bank Transfer');
		});

		it('should add conditional schemas for each option', () => {
			const rootGroup = service.schemaToFieldConfig(oneOfSchema);
			const paymentGroup = rootGroup.fields['paymentMethod'] as SchemaFieldGroup;
			const radioField = paymentGroup.fields['_paymentMethod_oneOf-option'];

			expect(radioField.conditionalSchemas?.length).toBe(2);
		});

		it('should mark fields as required when oneOf option with required array is selected', done => {
			const rootGroup = service.schemaToFieldConfig(oneOfSchema);
			const paymentMethodGroup = rootGroup.fields['paymentMethod'] as SchemaFieldGroup;
			const radioField = paymentMethodGroup.fields[
				'_paymentMethod_oneOf-option'
			] as SchemaFieldConfig;

			// Simulate selecting the first option (Credit Card)
			radioField.controlRef.setValue('credit_card');

			// Wait for the subscription to process
			setTimeout(() => {
				// After selection, the parent group should have the required fields from the selected option
				expect(paymentMethodGroup.requiredFields).toContain('cardNumber');
				expect(paymentMethodGroup.requiredFields).toContain('cvv');
				expect(paymentMethodGroup.requiredFields).not.toContain('expiryDate');

				// The fields should be marked as required
				const cardNumberField = paymentMethodGroup.fields[
					'cardNumber'
				] as SchemaFieldConfig;
				const cvvField = paymentMethodGroup.fields['cvv'] as SchemaFieldConfig;
				const expiryDateField = paymentMethodGroup.fields[
					'expiryDate'
				] as SchemaFieldConfig;

				expect(cardNumberField.validations?.required).toBe(true); // cardNumber is required
				expect(cvvField.validations?.required).toBe(true); // cvv is required
				expect(expiryDateField.validations?.required).toBeUndefined(); // expiryDate is not required
				done();
			}, 0);
		});
	});

	describe('handleAnyOf', () => {
		it('should create checkbox fields for anyOf options', () => {
			const rootGroup = service.schemaToFieldConfig(anyOfSchema);
			const featuresGroup = rootGroup.fields['features'] as SchemaFieldGroup;

			expect(featuresGroup.fields['features_anyOf-option_1']).toBeDefined();
			expect(featuresGroup.fields['features_anyOf-option_1'].type).toBe(
				SchemaFieldType.Checkbox,
			);
			expect(featuresGroup.fields['features_anyOf-option_2']).toBeDefined();
		});

		it('should add conditional schemas to each checkbox', () => {
			const rootGroup = service.schemaToFieldConfig(anyOfSchema);
			const featuresGroup = rootGroup.fields['features'] as SchemaFieldGroup;
			const checkbox1 = featuresGroup.fields['features_anyOf-option_1'];

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
				'_paymentMethod_oneOf-option'
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

	describe('addAddProperty', () => {
		it('should add a property field to group', () => {
			const rootGroup = service.schemaToFieldConfig({ type: 'object', properties: {} });

			service.addAddProperty(rootGroup);

			expect(rootGroup.fields['_add_property']).toBeDefined();
			expect(rootGroup.fields['_add_property'].type).toBe(SchemaFieldType.AddProperty);
		});

		it('should not add parameter control to FormGroup', () => {
			const rootGroup = service.schemaToFieldConfig({ type: 'object', properties: {} });

			service.addAddProperty(rootGroup);

			expect(rootGroup.groupRef?.get('_parameter')).toBeNull();
		});
	});

	describe('snakeCaseToLabel', () => {
		it('should properly convert snake case', () => {
			const result = (service as any).snakeCaseToLabel('FLAG_CONTROLLED');

			expect(result).toBe('Flag Controlled');
		});
	});

	describe('Mutually Exclusive Options', () => {
		it('should convert mutually exclusive properties into a oneOf (radio) field', () => {
			const rootGroup = service.schemaToFieldConfig(mutuallyExclusiveSchema);

			// There should be no direct fields for the mutually exclusive props
			expect(rootGroup.fields['soup']).toBeUndefined();
			expect(rootGroup.fields['salad']).toBeUndefined();

			// There should be a radio field created for the mutually exclusive options
			const radioFields = Object.values(rootGroup.fields).filter(
				f => f.type === SchemaFieldType.Radio,
			) as any[];

			expect(radioFields.length).toBeGreaterThan(0);

			const radio = radioFields[0];
			expect(radio.options.length).toBe(2);

			const optionLabels = radio.options.map((o: any) => o.label);
			expect(optionLabels).toEqual(expect.arrayContaining(['Soup', 'Salad']));
		});

		it('radio options should correspond to the mutually exclusive property keys', () => {
			const rootGroup = service.schemaToFieldConfig(mutuallyExclusiveSchema);

			const radioFields = Object.values(rootGroup.fields).filter(
				f => f.type === SchemaFieldType.Radio,
			) as any[];
			const radio = radioFields[0];

			// the underlying conditionalSchemas should reference soup and salad
			const triggerSchemas = radio.conditionalSchemas.map((c: any) => c.schema);
			const propNames = triggerSchemas.flatMap((s: any) => Object.keys(s.properties || {}));
			expect(propNames).toEqual(expect.arrayContaining(['soup', 'salad']));
		});
	});
});
