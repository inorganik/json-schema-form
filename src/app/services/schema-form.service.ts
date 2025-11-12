import { Injectable } from '@angular/core';
import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';

import { Subscription } from 'rxjs';

import {
	ConditionalSchema,
	SchemaFieldArray,
	SchemaFieldConfig,
	SchemaFieldGroup,
	SchemaFieldType,
} from '../models/form-models';
import { JsonSchema } from '../models/schema-models';

/**
 * Service for rendering forms from json schemas
 */
@Injectable()
export class SchemaFormService {
	// Root url of where schemas are fetched to help service distinguish between ids and urls
	private schemasRootUrl: string;

	// A cache of all $defs in the schemas
	public defsMap = new Map();

	// for caching fetched schemas
	private schemaCache: Map<string, JsonSchema> = new Map();

	// subscriptions for watching field values
	public subscriptions = new Map<string, Subscription>();

	// Toggle debug property in field configs, enabling display of unique keys
	private debug = false;

	private anyOfKeySegment = 'anyOf-option';
	private oneOfKeySegment = 'oneOf-option';

	/**
	 * Convenience method that consolidates service calls
	 *
	 * @param url - url of schema
	 */
	async getAndDereferenceSchema(url: string): Promise<JsonSchema> {
		const urlObj = new URL(url);
		this.schemasRootUrl = urlObj.origin;
		const schema = await this.getSchema(url);
		return this.dereferenceSchema(schema);
	}

	/**
	 * Fetch a schema. Will detect if url is an asset url
	 */
	async getSchema(url: string): Promise<JsonSchema | null> {
		if (this.schemaCache.has(url)) {
			return this.schemaCache.get(url);
		}
		try {
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			return response.json();
		} catch (error) {
			console.error('Failed to fetch widget schema:', error);
			return null;
		}
	}

	/**
	 * Replaces $ref pointers in a schema with the objects they reference,
	 * fetching any referenced schemas as necessary
	 */
	async dereferenceSchema(schema: JsonSchema): Promise<JsonSchema> {
		// helper to collect $defs recursively
		const collectDefs = (obj: any) => {
			if (obj && typeof obj === 'object') {
				if (obj.$defs && typeof obj.$defs === 'object') {
					for (const key of Object.keys(obj.$defs)) {
						const defObj = obj.$defs[key];
						if (defObj && typeof defObj === 'object') {
							const defKey = defObj['$id'] ? defObj['$id'] : key;
							this.defsMap.set(defKey, defObj);
						}
					}
				}
				for (const value of Object.values(obj)) {
					collectDefs(value);
				}
			} else if (Array.isArray(obj)) {
				for (const item of obj) {
					collectDefs(item);
				}
			}
		};

		// track visited objects to prevent infinite recursion
		const visited = new Set<any>();

		const dereference = async (obj: any): Promise<any> => {
			if (visited.has(obj)) {
				return obj;
			}
			visited.add(obj);
			collectDefs(obj);

			if (Array.isArray(obj)) {
				const result = await Promise.all(obj.map(item => dereference(item)));
				visited.delete(obj);
				return result;
			} else if (obj && typeof obj === 'object') {
				if ('$ref' in obj && typeof obj['$ref'] === 'string') {
					const refVal = obj['$ref'];
					if (refVal.startsWith(this.schemasRootUrl)) {
						// check defsMap for matching $id
						if (this.defsMap.has(refVal)) {
							return;
						}
						// if not found in defsMap, fetch from remote
						const refSchema = await this.getSchema(refVal);
						return dereference(refSchema);
					}
				}
				// traverse object properties
				const entries = await Promise.all(
					Object.entries(obj).map(async ([key, value]) => [
						key,
						await dereference(value),
					]),
				);
				visited.delete(obj);
				return Object.fromEntries(entries);
			}
			visited.delete(obj);
			return obj;
		};
		return dereference(schema);
	}

	/**
	 * Entry point for converting a schema to a field group config. Traverses the
	 * schema, adding configs (FieldConfig, FieldGroup or FieldArray) for each item.
	 *
	 * @param schema - json schema to convert
	 * @returns {SchemaFieldGroup} form config
	 */
	schemaToFieldConfig(schema: JsonSchema): SchemaFieldGroup {
		// set defs
		if (schema.$defs) {
			for (const [key, definition] of Object.entries(schema.$defs)) {
				const defKey = schema.$defs[key].$id ? schema.$defs[key].$id : key;
				if (!this.defsMap.has(defKey)) {
					this.defsMap.set(defKey, definition);
				}
			}
		}

		// Create the root field group
		const rootGroup: SchemaFieldGroup = {
			label: schema.title || 'Form',
			groupRef: new FormGroup({}),
			key: 'root',
			uniqueKey: 'root',
			type: SchemaFieldType.Group,
			fields: {},
			parent: null,
			conditionalSchemas: [],
			debug: this.debug,
			renderFieldset: false,
		};

		// Store the required fields array from the schema
		if (schema.required && schema.required.length > 0) {
			rootGroup.requiredFields = schema.required;
		}

		// Process the schema (handles allOf, properties, anyOf, oneOf, if/then/else)
		this.processSchema(schema, rootGroup, 'root');

		return rootGroup;
	}

	/**
	 * Patches a value to a from group in a SchemaFieldGroup
	 *
	 * @param rootGroup - a schema field group
	 * @param value - the form value to patch to the rootGroup form group
	 */
	patchValue(rootGroup: SchemaFieldGroup, value: any): void {
		if (!value || typeof value !== 'object') {
			return;
		}

		// First pass: prepare the structure (add array items, select oneOf/anyOf options)
		this.prepareStructureForValue(rootGroup, value);
		// Second pass: patch the values to the form controls
		rootGroup.groupRef.patchValue(value);
	}

	/**
	 * Recursively prepares the field structure for patching by adding array items
	 * and selecting oneOf/anyOf options based on the value object
	 *
	 * @param fieldGroup - the field group to prepare
	 * @param value - the value object to match against
	 */
	private prepareStructureForValue(fieldGroup: SchemaFieldGroup, value: any): void {
		if (!value || typeof value !== 'object') {
			return;
		}

		// Handle additionalProperties
		if (fieldGroup.additionalProperties) {
			this.addAdditionalPropertiesFromValue(fieldGroup, value);
		}

		// Iterate through the fields in the group
		for (const [key, field] of Object.entries(fieldGroup.fields)) {
			if (field.type === SchemaFieldType.Group) {
				const group = field as SchemaFieldGroup;
				// Check if this is a oneOf wrapper group
				const oneOfRadioKey = Object.keys(group.fields).find(k =>
					k.endsWith(this.oneOfKeySegment),
				);
				if (oneOfRadioKey) {
					// This is a oneOf group, handle oneOf selection
					this.selectOneOfOption(group, oneOfRadioKey, value);
				}

				// Check if this is an anyOf wrapper group
				const anyOfCheckboxKeys = Object.keys(group.fields).filter(
					k =>
						k.includes(this.anyOfKeySegment) &&
						group.fields[k].type === SchemaFieldType.Checkbox,
				);
				if (anyOfCheckboxKeys.length > 0) {
					// This is an anyOf group, handle anyOf selection
					this.selectAnyOfOptions(group, anyOfCheckboxKeys, value);
				}

				// Recursively prepare nested groups
				if (value[key]) {
					this.prepareStructureForValue(group, value[key]);
				}
			} else if (field.type === SchemaFieldType.Array) {
				const array = field as SchemaFieldArray;
				const arrayValue = value[key];

				if (Array.isArray(arrayValue)) {
					// Add items to match the array length in the value
					while (array.items.length < arrayValue.length) {
						this.addArrayItem(array);
					}

					// Recursively prepare each array item if it's a group
					for (let i = 0; i < array.items.length; i++) {
						const item = array.items[i];
						if (item.type === SchemaFieldType.Group && arrayValue[i]) {
							this.prepareStructureForValue(item as SchemaFieldGroup, arrayValue[i]);
						}
					}
				}
			} else if (field.type === SchemaFieldType.Radio && key.endsWith(this.oneOfKeySegment)) {
				// This is a root-level oneOf radio field (not in a wrapper group)
				this.selectOneOfOption(fieldGroup, key, value);
			} else if (
				field.type === SchemaFieldType.Checkbox &&
				key.includes(this.anyOfKeySegment)
			) {
				// This is a root-level anyOf checkbox (not in a wrapper group)
				// Collect all anyOf checkboxes at this level
				const anyOfCheckboxKeys = Object.keys(fieldGroup.fields).filter(
					k =>
						k.includes(this.anyOfKeySegment) &&
						fieldGroup.fields[k].type === SchemaFieldType.Checkbox,
				);
				this.selectAnyOfOptions(fieldGroup, anyOfCheckboxKeys, value);
			} else {
				// Check if this field has conditional schemas (if/then/else)
				const fieldConfig = field as SchemaFieldConfig;
				if (fieldConfig.conditionalSchemas && fieldConfig.conditionalSchemas.length > 0) {
					// Check if the value has a value for this field
					if (value[key] !== undefined) {
						// Set the field value and trigger conditional schemas
						this.handleIfThenElseForPatch(fieldConfig, value[key], fieldGroup, value);
					}
				}
			}
		}
	}

	/**
	 * Handles if/then/else conditional schemas when patching values.
	 * Triggers the handleConditionalSchemas method to add fields, then recursively prepares nested structures.
	 *
	 * @param field - the field with conditional schemas
	 * @param fieldValue - the value for this specific field
	 * @param parentGroup - the parent group containing this field
	 * @param fullValue - the full value object (for nested field preparation)
	 */
	private handleIfThenElseForPatch(
		field: SchemaFieldConfig,
		fieldValue: any,
		parentGroup: SchemaFieldGroup,
		fullValue: any,
	): void {
		// Use the existing handleConditionalSchemas method to add the conditional fields
		// This ensures consistency with the reactive behavior
		this.handleConditionalSchemas(field, fieldValue, parentGroup);

		// Find the matching conditional schema to recursively prepare nested structures
		for (const conditionalSchema of field.conditionalSchemas) {
			if (conditionalSchema.triggerValue === fieldValue && conditionalSchema.addedKeys) {
				// Recursively prepare any nested structures in the added fields
				for (const addedKey of conditionalSchema.addedKeys) {
					const addedField = parentGroup.fields[addedKey];

					if (addedField && addedField.type === SchemaFieldType.Group) {
						const addedGroup = addedField as SchemaFieldGroup;

						// Check if this is a oneOf wrapper group
						const oneOfRadioKey = Object.keys(addedGroup.fields).find(k =>
							k.endsWith(this.oneOfKeySegment),
						);
						if (oneOfRadioKey && fullValue[addedKey]) {
							// Handle oneOf selection in the conditionally added group
							this.selectOneOfOption(addedGroup, oneOfRadioKey, fullValue[addedKey]);
						}

						// Check if this is an anyOf wrapper group
						const anyOfCheckboxKeys = Object.keys(addedGroup.fields).filter(
							k =>
								k.includes(this.anyOfKeySegment) &&
								addedGroup.fields[k].type === SchemaFieldType.Checkbox,
						);
						if (anyOfCheckboxKeys.length > 0 && fullValue[addedKey]) {
							// Handle anyOf selection in the conditionally added group
							this.selectAnyOfOptions(
								addedGroup,
								anyOfCheckboxKeys,
								fullValue[addedKey],
							);
						}

						// Recursively prepare the group
						if (fullValue[addedKey]) {
							this.prepareStructureForValue(addedGroup, fullValue[addedKey]);
						}
					} else if (
						addedField &&
						addedField.type === SchemaFieldType.Array &&
						fullValue[addedKey]
					) {
						// Handle arrays in conditionally added fields
						const addedArray = addedField as SchemaFieldArray;
						const arrayValue = fullValue[addedKey];

						if (Array.isArray(arrayValue)) {
							// Add items to match the array length in the value
							while (addedArray.items.length < arrayValue.length) {
								this.addArrayItem(addedArray);
							}

							// Recursively prepare each array item if it's a group
							for (let i = 0; i < addedArray.items.length; i++) {
								const item = addedArray.items[i];
								if (item.type === SchemaFieldType.Group && arrayValue[i]) {
									this.prepareStructureForValue(
										item as SchemaFieldGroup,
										arrayValue[i],
									);
								}
							}
						}
					} else if (
						addedField &&
						addedField.type === SchemaFieldType.Radio &&
						addedKey.endsWith(this.oneOfKeySegment)
					) {
						// This is a oneOf radio field added at the parent level (not in a wrapper group)
						// Handle oneOf selection for this radio field
						this.selectOneOfOption(parentGroup, addedKey, fullValue);
					} else if (
						addedField &&
						addedField.type === SchemaFieldType.Checkbox &&
						addedKey.includes(this.anyOfKeySegment)
					) {
						// This is an anyOf checkbox field added at the parent level
						// Collect all related anyOf checkboxes
						const anyOfCheckboxKeys = conditionalSchema.addedKeys.filter(
							k =>
								k.includes(this.anyOfKeySegment) &&
								parentGroup.fields[k]?.type === SchemaFieldType.Checkbox,
						);
						if (anyOfCheckboxKeys.length > 0) {
							this.selectAnyOfOptions(parentGroup, anyOfCheckboxKeys, fullValue);
						}
					}
				}
				break;
			}
		}

		// Set the field value after adding conditional fields
		field.controlRef.setValue(fieldValue, { emitEvent: false });
	}

	/**
	 * Adds fields for additional properties found in the value object that don't
	 * already exist in the field group. Only handles simple key-value pairs.
	 *
	 * @param fieldGroup - the field group with additionalProperties enabled
	 * @param value - the value object containing additional properties
	 */
	private addAdditionalPropertiesFromValue(fieldGroup: SchemaFieldGroup, value: any): void {
		if (!value || typeof value !== 'object') {
			return;
		}

		// Get all value keys that are not already in the field group
		// Exclude special field keys that start with underscore
		const existingKeys = Object.keys(fieldGroup.fields);
		const valueKeys = Object.keys(value);

		for (const key of valueKeys) {
			if (existingKeys.includes(key) || key.startsWith('_')) {
				continue;
			}
			// Skip arrays and objects - only handle simple key-value pairs
			const valueType = typeof value[key];
			if (Array.isArray(value[key]) || (valueType === 'object' && value[key] !== null)) {
				continue;
			}

			// Determine the schema type based on the value
			let schema: JsonSchema;
			if (value[key] === null) {
				schema = { type: 'string' };
			} else if (valueType === 'number') {
				schema = { type: 'number' };
			} else {
				schema = { type: 'string' };
			}

			this.addField(schema, fieldGroup, key, undefined, true);
		}
	}

	/**
	 * Selects the appropriate oneOf option based on the value object
	 *
	 * @param group - the field group containing the oneOf radio field
	 * @param radioKey - the key of the radio field
	 * @param value - the value object to match against
	 */
	private selectOneOfOption(group: SchemaFieldGroup, radioKey: string, value: any): void {
		const radioField = group.fields[radioKey] as SchemaFieldConfig;
		if (!radioField || !radioField.conditionalSchemas) {
			return;
		}

		// Try to match the value against each oneOf schema
		for (let i = 0; i < radioField.conditionalSchemas.length; i++) {
			const conditionalSchema = radioField.conditionalSchemas[i];
			if (this.valueMatchesSchema(value, conditionalSchema.schema)) {
				// Manually trigger handleConditionalSchemas to add fields BEFORE setting value
				this.handleConditionalSchemas(radioField, i, group);

				// Set the radio control value to select this option
				radioField.controlRef.setValue(i, { emitEvent: false });

				// Recursively prepare the conditionally added fields
				if (conditionalSchema.addedKeys && conditionalSchema.addedKeys.length > 0) {
					for (const addedKey of conditionalSchema.addedKeys) {
						const addedField = group.fields[addedKey];
						if (
							addedField &&
							addedField.type === SchemaFieldType.Group &&
							value[addedKey]
						) {
							this.prepareStructureForValue(
								addedField as SchemaFieldGroup,
								value[addedKey],
							);
						}
					}
				}
				break;
			}
		}
	}

	/**
	 * Selects the appropriate anyOf options based on the value object
	 *
	 * @param group - the field group containing the anyOf checkbox fields
	 * @param checkboxKeys - the keys of the checkbox fields
	 * @param value - the value object to match against
	 */
	private selectAnyOfOptions(group: SchemaFieldGroup, checkboxKeys: string[], value: any): void {
		for (const checkboxKey of checkboxKeys) {
			const checkboxField = group.fields[checkboxKey] as SchemaFieldConfig;
			if (
				!checkboxField ||
				!checkboxField.conditionalSchemas ||
				checkboxField.conditionalSchemas.length === 0
			) {
				continue;
			}

			const conditionalSchema = checkboxField.conditionalSchemas[0];
			if (this.valueMatchesSchema(value, conditionalSchema.schema)) {
				// Manually trigger handleConditionalSchemas to add fields BEFORE setting value
				this.handleConditionalSchemas(checkboxField, true, group);

				checkboxField.controlRef.setValue(true, { emitEvent: false });

				// Recursively prepare the conditionally added fields
				if (conditionalSchema.addedKeys && conditionalSchema.addedKeys.length > 0) {
					for (const addedKey of conditionalSchema.addedKeys) {
						const addedField = group.fields[addedKey];
						if (
							addedField &&
							addedField.type === SchemaFieldType.Group &&
							value[addedKey]
						) {
							this.prepareStructureForValue(
								addedField as SchemaFieldGroup,
								value[addedKey],
							);
						}
					}
				}
			}
		}
	}

	/**
	 * Checks if a value object matches a JSON schema's structure
	 * Used to determine which oneOf/anyOf option should be selected
	 *
	 * @param value - the value object to check
	 * @param schema - the JSON schema to match against
	 * @returns true if the value matches the schema structure
	 */
	private valueMatchesSchema(value: any, schema: JsonSchema): boolean {
		if (!schema || !value || typeof value !== 'object') {
			return false;
		}

		// Resolve $ref if present
		if (schema.$ref) {
			const resolvedSchema = this.resolveRef(schema.$ref);
			if (resolvedSchema) {
				return this.valueMatchesSchema(value, resolvedSchema);
			}
			return false;
		}

		// If schema has properties, check if value has any of those properties
		if (schema.properties) {
			const schemaKeys = Object.keys(schema.properties);
			const valueKeys = Object.keys(value);
			return schemaKeys.some(key => valueKeys.includes(key));
		}

		// If schema has a const value, check exact match
		if (schema.const !== undefined) {
			return value === schema.const;
		}
		if (schema.enum) {
			return schema.enum.includes(value);
		}
		return true;
	}

	/**
	 * Resolves a $ref path to get the referenced schema from the defsMap
	 */
	private resolveRef(ref: string): JsonSchema | null {
		const defsPath = '#/$defs/';
		let key = '';
		if (ref.startsWith(defsPath)) {
			key = ref.slice(defsPath.length);
		} else {
			key = ref;
		}

		if (this.defsMap.has(key)) {
			return this.defsMap.get(key);
		} else {
			console.warn(`Could not resolve $ref: ${ref}`);
			return null;
		}
	}

	/**
	 * Processes a schema to handle oneOf, anyOf, and if/then/else conditional logic.
	 *
	 * Handles root-level schema keywords:
	 * - allOf: merges all schemas at the same level
	 * - anyOf: creates checkbox fields for each option with conditional schemas
	 * - oneOf: creates a radio field with options and conditional schemas
	 * - if/then/else: adds conditional schemas to the referenced field
	 * - properties: processes each property (which may also have conditionals)
	 * - items: processes array items at the top level when type is "array"
	 *
	 * @param schema The JSON schema to process
	 * @param parent The parent FieldGroup or FieldArray to add fields to
	 * @param key Optional key to use for oneOf/anyOf fields (when processing a property)
	 */
	private processSchema(
		schema: JsonSchema,
		parent: SchemaFieldGroup | SchemaFieldArray,
		key?: string,
	): void {
		// Handle $ref - resolve and process the referenced schema
		if (schema.$ref) {
			const resolvedSchema = this.resolveRef(schema.$ref);
			if (resolvedSchema) {
				// Process the resolved schema with the same parent and key
				this.processSchema(resolvedSchema, parent, key);
			}
			return;
		}

		// Handle anyOf - create checkbox fields for each option
		if (schema.anyOf) {
			this.handleAnyOf(schema, parent, key);
		}

		// Handle oneOf - create radio field with options
		if (schema.oneOf) {
			this.handleOneOf(schema, parent, key);
		}

		// Handle top-level array type with items
		if (schema.type === 'array' && schema.items && !schema.properties) {
			// This is a top-level array schema, process it as an array field
			if (key) {
				this.addArray(schema, parent, key);
			}
			// If no key is provided, we can't add it (top-level arrays need a key)
			return;
		}

		// Process regular properties FIRST (before allOf and if/then/else)
		if (schema.properties) {
			const propertyEntries = Object.entries(schema.properties);
			for (let i = 0; i < propertyEntries.length; i++) {
				const [propKey, propertySchema] = propertyEntries[i];
				// Handle $ref in property schema
				let actualSchema = propertySchema;
				if (propertySchema.$ref) {
					const resolvedSchema = this.resolveRef(propertySchema.$ref);
					if (resolvedSchema) {
						actualSchema = resolvedSchema;
					}
				}

				// Check if property has conditional keywords - process recursively with key
				if (actualSchema.anyOf || actualSchema.oneOf) {
					this.processSchema(actualSchema, parent, propKey);
					continue;
				}

				if (actualSchema.type === 'object') {
					this.addGroup(actualSchema, parent, propKey, i);
				} else if (actualSchema.type === 'array') {
					this.addArray(actualSchema, parent, propKey, i);
				} else {
					this.addField(actualSchema, parent, propKey, i);
				}
			}
		}

		// Process allOf - merge all schemas at the same level
		// This is processed AFTER properties so fields exist before we attach conditionals
		if (schema.allOf) {
			for (const allOfSchema of schema.allOf) {
				// Recursively process each allOf schema to handle nested conditionals
				this.processSchema(allOfSchema, parent);
			}
		}

		// Handle if/then/else - add conditional schemas to the field referenced in "if"
		// This is processed AFTER properties so the referenced field exists
		if (schema.if && schema.then) {
			// Find the field referenced in the "if" condition
			if (schema.if.properties) {
				for (const [ifKey, ifSchema] of Object.entries(schema.if.properties)) {
					// Look for the field in the parent group
					// Walk up the tree if needed to find the root group where the field is defined
					const targetGroup =
						parent.type === SchemaFieldType.Group ? (parent as SchemaFieldGroup) : null;
					let field: SchemaFieldConfig | SchemaFieldGroup | SchemaFieldArray | undefined;

					if (targetGroup) {
						field = targetGroup.fields[ifKey];

						// If not found and we have a parent, check the parent (for nested allOf scenarios)
						if (
							!field &&
							targetGroup.parent &&
							targetGroup.parent.type === SchemaFieldType.Group
						) {
							field = (targetGroup.parent as SchemaFieldGroup).fields[ifKey];
						}
					}

					if (field && 'conditionalSchemas' in field && field.conditionalSchemas) {
						// Get the condition value (const value in the if schema)
						const conditionValue = ifSchema.const;

						// Add "then" schema
						if (schema.then) {
							field.conditionalSchemas.push({
								triggerValue: conditionValue,
								schema: schema.then,
								addedKeys: [],
							});
						}

						// Add "else" schema if present
						if (schema.else) {
							field.conditionalSchemas.push({
								removeTriggerValue: conditionValue,
								schema: schema.else,
								addedKeys: [],
							});
						}
					} else {
						console.warn('Field not found or has no conditionalSchemas:', ifKey, field);
					}
				}
			}
		}
	}

	/**
	 * Handles anyOf schema logic by creating checkbox fields for each option.
	 * Each checkbox controls whether its associated schema is applied.
	 *
	 * @param schema The JSON schema containing anyOf
	 * @param parent The parent FieldGroup or FieldArray to add fields to
	 * @param key Optional key to use for the anyOf fields (when processing a property)
	 */
	private handleAnyOf(
		schema: JsonSchema,
		parent: SchemaFieldGroup | SchemaFieldArray,
		key?: string,
	): void {
		if (parent.type !== SchemaFieldType.Group) {
			console.warn('anyOf requires parent to be a FieldGroup', schema);
			return;
		}

		const baseKey = key || Math.random().toString(36).substring(2);

		// Determine target group based on whether we have a key
		const targetGroup: SchemaFieldGroup = parent as SchemaFieldGroup;
		let fieldsetGroup: SchemaFieldGroup | null = null;

		if (key) {
			// Create a wrapper group for UI purposes (fieldset)
			const groupSchema: JsonSchema = {
				type: 'object',
				title: schema.title || this.snakeCaseToLabel(key),
				properties: {},
			};
			this.addGroup(groupSchema, parent, key);
			fieldsetGroup = (parent as SchemaFieldGroup).fields[key] as SchemaFieldGroup;
		}

		// Create checkbox fields for each anyOf option
		for (let i = 0; i < schema.anyOf.length; i++) {
			let anyOfSchema = schema.anyOf[i];
			if (anyOfSchema.$ref) {
				anyOfSchema = this.resolveRef(anyOfSchema.$ref);
			}
			const checkboxKey = `${baseKey}_${this.anyOfKeySegment}_${i + 1}`;

			// Create a control for the checkbox (not added to FormGroup)
			const conditionalControl = new FormControl(false);

			// Parent is determined by if there is a key
			const checkboxParent = fieldsetGroup || targetGroup;

			const checkboxField: SchemaFieldConfig = {
				label: anyOfSchema.title || `${baseKey} option ${i + 1}`,
				controlRef: conditionalControl,
				key: checkboxKey,
				uniqueKey: `${checkboxParent.uniqueKey}_${checkboxKey}`,
				type: SchemaFieldType.Checkbox,
				parent: checkboxParent,
				conditionalSchemas: [
					{
						triggerValue: true,
						removeTriggerValue: false,
						schema: anyOfSchema,
						addedKeys: [],
					},
				],
				debug: this.debug,
			};

			// Add the checkbox field to the fieldset group's fields
			checkboxParent.fields[checkboxKey] = checkboxField;

			// Set up valueChanges subscription - add conditional fields to parent
			const subscription = conditionalControl.valueChanges.subscribe(value => {
				this.handleConditionalSchemas(checkboxField, value, checkboxParent);
			});
			this.subscriptions.set(checkboxField.uniqueKey, subscription);
		}
	}

	/**
	 * Handles oneOf schema logic by creating a radio field with options.
	 * The radio field selection determines which schema is applied.
	 *
	 * @param schema The JSON schema containing oneOf
	 * @param parent The parent FieldGroup or FieldArray to add fields to
	 * @param key Optional key to use for the oneOf field (when processing a property)
	 */
	private handleOneOf(
		schema: JsonSchema,
		parent: SchemaFieldGroup | SchemaFieldArray,
		key?: string,
	): void {
		if (parent.type !== SchemaFieldType.Group) {
			console.warn('oneOf requires parent to be a FieldGroup', schema);
			return;
		}
		const baseKey = key || Math.random().toString(36).substring(2);

		// Determine target group based on whether we have a key
		const targetGroup: SchemaFieldGroup = parent as SchemaFieldGroup;
		let fieldsetGroup: SchemaFieldGroup | null = null;

		if (key) {
			// Create a wrapper group for UI purposes (fieldset)
			const groupSchema: JsonSchema = {
				type: 'object',
				title: schema.title || this.snakeCaseToLabel(key),
				properties: {},
			};
			this.addGroup(groupSchema, parent, key);
			fieldsetGroup = (parent as SchemaFieldGroup).fields[key] as SchemaFieldGroup;
		}

		// Create radio field for oneOf selection
		const options = schema.oneOf.map((oneOfSchema, i) => {
			if (oneOfSchema.$ref) {
				oneOfSchema = this.resolveRef(oneOfSchema.$ref);
			}
			const titleFromProps = oneOfSchema.properties
				? Object.values(oneOfSchema.properties)[0]?.title
				: undefined;

			return {
				label: oneOfSchema.title || titleFromProps || `Option ${i + 1}`,
				value: i,
			};
		});

		// Create a control for the radio (not added to FormGroup)
		const conditionalControl = new FormControl(null);

		const radioKey = `${baseKey}_${this.oneOfKeySegment}`;

		// Parent is determined by if there is a key
		const radioParent = fieldsetGroup || targetGroup;

		const radioField: SchemaFieldConfig = {
			label: schema.title || '',
			controlRef: conditionalControl,
			key: radioKey,
			uniqueKey: `${radioParent.uniqueKey}_${radioKey}`,
			type: SchemaFieldType.Radio,
			options,
			parent: radioParent,
			conditionalSchemas: schema.oneOf.map(
				(oneOfSchema, i) =>
					({
						triggerValue: i,
						schema: oneOfSchema.$ref ? this.resolveRef(oneOfSchema.$ref) : oneOfSchema,
						addedKeys: [],
					}) as ConditionalSchema,
			),
			debug: this.debug,
		};

		// Add the radio field to the fieldset group's fields
		radioParent.fields[radioKey] = radioField;

		// Set up valueChanges subscription for conditional logic
		const subscription = conditionalControl.valueChanges.subscribe(value => {
			this.handleConditionalSchemas(radioField, value, radioParent);
		});
		this.subscriptions.set(radioField.uniqueKey, subscription);
	}

	/**
	 * Creates a new FormGroup for the groupRef property in FieldGroup, and assigns
	 * properties of the FieldGroup based on the schema
	 */
	addGroup(
		schema: JsonSchema,
		parent: SchemaFieldGroup | SchemaFieldArray,
		key: string,
		index?: number,
	): void {
		// console.log('add group', schema, parent, key);
		// Create a new FormGroup
		const formGroup = new FormGroup({});

		// Create unique key with index prefix if provided
		let uniqueKey = parent.uniqueKey;
		if (index !== undefined) {
			uniqueKey += '_' + `00${index}`.slice(-3);
		}
		uniqueKey += '_' + key;

		let title = schema.title || this.snakeCaseToLabel(key);
		if (parent.type === SchemaFieldType.Array) {
			title = schema.title || 'Item';
			title = title += ' ' + (index + 1);
		}

		// Create the FieldGroup config
		const fieldGroup: SchemaFieldGroup = {
			label: title,
			groupRef: formGroup,
			key,
			uniqueKey,
			type: SchemaFieldType.Group,
			fields: {},
			parent,
			conditionalSchemas: [],
			debug: this.debug,
			renderFieldset: parent.type !== SchemaFieldType.Array,
		};

		// Store the required fields array from the schema
		if (schema.required && schema.required.length > 0) {
			fieldGroup.requiredFields = schema.required;
		}

		// Add to parent
		if (parent.type === SchemaFieldType.Group) {
			const parentGroup = parent as SchemaFieldGroup;
			parentGroup.fields[key] = fieldGroup;
			parentGroup.groupRef?.addControl(key, formGroup);
		} else if (parent.type === SchemaFieldType.Array) {
			const parentArray = parent as SchemaFieldArray;
			parentArray.items.push(fieldGroup);
			parentArray.arrayRef?.push(formGroup);
		}

		// Process the schema recursively (handles properties, allOf, anyOf, oneOf, if/then/else)
		this.processSchema(schema, fieldGroup);

		// Include add parameter field for schema that allows additional properties
		if (schema.additionalProperties) {
			fieldGroup.additionalProperties = true;
			this.addAddProperty(fieldGroup);
		}
	}

	/**
	 * Adds an add property field to a field group to support additionalProperties
	 */
	addAddProperty(parent: SchemaFieldGroup): void {
		// form control for the property key input (not added to parent group)
		const control = new FormControl('');

		// Create the property field config
		const addPropertyField: SchemaFieldConfig = {
			label: 'Add Property',
			controlRef: control,
			description: 'Enter a key to add a custom property.',
			key: '_add_property',
			uniqueKey: `${parent.uniqueKey}_999_addProperty`,
			type: SchemaFieldType.AddProperty,
			parent,
			conditionalSchemas: [],
			debug: this.debug,
		};

		// Add to parent fields (but not to the FormGroup)
		parent.fields['_add_property'] = addPropertyField;
	}

	/**
	 * Removes a group from the parent FormGroup or FormArray and from parent fields/items
	 */
	removeGroup(key: string, parent: SchemaFieldGroup | SchemaFieldArray): void {
		if (parent.type === SchemaFieldType.Group) {
			const parentGroup = parent as SchemaFieldGroup;
			const fieldGroup = parentGroup.fields[key] as SchemaFieldGroup;

			// Recursively clean up subscriptions for all nested fields
			if (fieldGroup) {
				this.cleanupFieldSubscriptions(fieldGroup);
			}

			// Remove from FormGroup
			parentGroup.groupRef?.removeControl(key);
			// Remove from fields object
			delete parentGroup.fields[key];
		} else if (parent.type === SchemaFieldType.Array) {
			const parentArray = parent as SchemaFieldArray;
			// Find and remove from items array
			const index = parentArray.items.findIndex(item => item.key === key);
			if (index !== -1) {
				const fieldGroup = parentArray.items[index] as SchemaFieldGroup;

				// Recursively clean up subscriptions for all nested fields
				if (fieldGroup) {
					this.cleanupFieldSubscriptions(fieldGroup);
				}

				parentArray.items.splice(index, 1);
				parentArray.arrayRef?.removeAt(index);
			}
		}
	}

	/**
	 * New-up a FormControl, and assigns FieldConfig properties based on the schema
	 */
	addField(
		schema: JsonSchema,
		parent: SchemaFieldGroup | SchemaFieldArray,
		key: string,
		index?: number,
		removeable = false,
	): SchemaFieldConfig {
		// Build validators using helper method
		const { validators, validations } = this.buildValidators(schema, parent, key);

		// Create form control with default value and validators
		const defaultValue =
			schema.default !== undefined ? schema.default : schema.const ? schema.const : null;
		const control = new FormControl(defaultValue, validators);

		// Determine field type
		let fieldType: SchemaFieldType;
		if (schema.enum) {
			// Use select for 5+ items, radio for 4 or less
			fieldType = schema.enum.length >= 5 ? SchemaFieldType.Select : SchemaFieldType.Radio;
			if (schema.format === 'radio') {
				fieldType = SchemaFieldType.Radio;
			} else if (schema.format === 'select') {
				fieldType = SchemaFieldType.Select;
			}
		} else if (schema.const) {
			fieldType = SchemaFieldType.Hidden;
		} else {
			// Map schema type to field type
			switch (schema.type) {
				case 'boolean':
					fieldType =
						schema.format === 'toggle'
							? SchemaFieldType.Toggle
							: SchemaFieldType.Checkbox;
					break;
				case 'number':
				case 'integer':
					fieldType = SchemaFieldType.Number;
					break;
				default:
					fieldType =
						schema.format === 'textarea'
							? SchemaFieldType.Textarea
							: SchemaFieldType.Text;
			}
		}

		// Create unique key with index prefix if provided
		let uniqueKey = parent.uniqueKey;
		if (parent.type !== SchemaFieldType.Array) {
			if (index !== undefined) {
				uniqueKey += '_' + `00${index}`.slice(-3);
			}
		}
		uniqueKey += '_' + key;

		let title = schema.title || key;
		if (parent.type === SchemaFieldType.Array) {
			title = schema.title || 'Item';
			title = title += ' ' + (index + 1);
		}

		// Create field config
		const fieldConfig: SchemaFieldConfig = {
			label: title,
			controlRef: control,
			key,
			uniqueKey,
			type: fieldType,
			description: schema.description,
			options: schema.enum ? this.convertEnumToOptions(schema) : undefined,
			validations: Object.keys(validations).length > 0 ? validations : undefined,
			parent,
			removeable,
			conditionalSchemas: [],
			debug: this.debug,
			rule:
				schema.format === 'rule-above'
					? 'above'
					: schema.format === 'rule-below'
						? 'below'
						: null,
		};

		// Set up valueChanges subscription for conditional schemas
		const subscription = control.valueChanges.subscribe(value => {
			if (fieldConfig.conditionalSchemas && fieldConfig.conditionalSchemas.length > 0) {
				this.handleConditionalSchemas(fieldConfig, value, parent);
			}
		});

		// Store subscription for cleanup later
		this.subscriptions.set(fieldConfig.uniqueKey, subscription);

		// Add to parent
		if (parent.type === SchemaFieldType.Group) {
			const parentGroup = parent as SchemaFieldGroup;
			parentGroup.fields[key] = fieldConfig;
			parentGroup.groupRef?.addControl(key, control);
		} else if (parent.type === SchemaFieldType.Array) {
			const parentArray = parent as SchemaFieldArray;
			parentArray.items.push(fieldConfig);
			parentArray.arrayRef?.push(control);
		}
		return fieldConfig;
	}

	/**
	 * Removes the form control from the form group via the groupRef property of
	 * the parent, and remove the field config from the parent field group or array.
	 */
	removeField(key: string, parent: SchemaFieldGroup): void {
		if (parent.type === SchemaFieldType.Group) {
			const field = parent.fields[key] as SchemaFieldConfig;

			// Unsubscribe from valueChanges if subscription exists
			if (field) {
				const subscription = this.subscriptions.get(field.uniqueKey);
				if (subscription) {
					subscription.unsubscribe();
					this.subscriptions.delete(field.uniqueKey);
				}
			}

			// Remove from FormGroup
			parent.groupRef?.removeControl(key);
			// Remove from fields object
			delete parent.fields[key];
		}
	}

	/**
	 * New-up a FormArray, and assigns FieldArray properties based on the schema
	 */
	addArray(
		schema: JsonSchema,
		parent: SchemaFieldGroup | SchemaFieldArray,
		key: string,
		index?: number,
	): void {
		// Create a new FormArray
		const formArray = new FormArray<any>([]);

		// Create unique key with index prefix if provided
		let uniqueKey = parent.uniqueKey;
		if (parent.type !== SchemaFieldType.Array) {
			uniqueKey += index !== undefined ? '_' + `00${index}`.slice(-3) : '_' + key;
		}

		// Build validations
		const validations: any = {};
		if (schema.maxItems !== undefined) {
			validations.maxItems = schema.maxItems;
		}
		if (schema.minItems !== undefined) {
			validations.minItems = schema.minItems;
		}

		// Get the items schema (support both single schema and array of schemas)
		const itemSchema = Array.isArray(schema.items) ? schema.items[0] : schema.items;

		// Create the FieldArray config
		const fieldArray: SchemaFieldArray = {
			label: schema.title || this.snakeCaseToLabel(key),
			arrayRef: formArray,
			key,
			uniqueKey,
			type: SchemaFieldType.Array,
			description: schema.description,
			items: [],
			itemSchema, // Store the schema template for array items
			validations: Object.keys(validations).length > 0 ? validations : undefined,
			canAddItem: () => {
				if (fieldArray.validations?.maxItems !== undefined) {
					return fieldArray.items.length < fieldArray.validations.maxItems;
				}
				return true;
			},
			canRemoveItem: () => {
				if (fieldArray.validations?.minItems !== undefined) {
					return fieldArray.items.length > fieldArray.validations.minItems;
				}
				return true;
			},
			parent,
			conditionalSchemas: [],
			debug: this.debug,
		};

		// Add to parent
		if (parent.type === SchemaFieldType.Group) {
			const parentGroup = parent as SchemaFieldGroup;
			parentGroup.fields[key] = fieldArray;
			parentGroup.groupRef?.addControl(key, formArray);
		} else if (parent.type === SchemaFieldType.Array) {
			const parentArray = parent as SchemaFieldArray;
			parentArray.items.push(fieldArray);
			parentArray.arrayRef?.push(formArray);
		}

		// Process the schema for any conditional logic (anyOf, oneOf, if/then/else)
		// Note: This is rare for arrays but supported by JSON Schema
		if (schema.anyOf || schema.oneOf || schema.if || schema.allOf) {
			this.processSchema(schema, fieldArray);
		}

		// Add minimum required items if specified
		if (itemSchema && schema.minItems) {
			for (let i = 0; i < schema.minItems; i++) {
				this.addArrayItem(fieldArray);
			}
		}
	}

	/**
	 * Removes the form array from the parent FormGroup or FormArray and from parent fields/items
	 */
	removeArray(key: string, parent: SchemaFieldGroup | SchemaFieldArray): void {
		if (parent.type === SchemaFieldType.Group) {
			const parentGroup = parent as SchemaFieldGroup;
			const fieldArray = parentGroup.fields[key] as SchemaFieldArray;

			// Recursively clean up subscriptions for all items in the array
			if (fieldArray) {
				this.cleanupArraySubscriptions(fieldArray);
			}

			// Remove from FormGroup
			parentGroup.groupRef?.removeControl(key);
			// Remove from fields object
			delete parentGroup.fields[key];
		} else if (parent.type === SchemaFieldType.Array) {
			const parentArray = parent as SchemaFieldArray;
			// Find and remove from items array
			const index = parentArray.items.findIndex(item => item.key === key);
			if (index !== -1) {
				const fieldArray = parentArray.items[index] as SchemaFieldArray;

				// Recursively clean up subscriptions for all items in the array
				if (fieldArray) {
					this.cleanupArraySubscriptions(fieldArray);
				}

				parentArray.items.splice(index, 1);
				parentArray.arrayRef?.removeAt(index);
			}
		}
	}

	/**
	 * Adds a new item to a FieldArray based on the itemSchema.
	 * Determines the type of item to add (field, group, or array) and creates it.
	 */
	addArrayItem(fieldArray: SchemaFieldArray): void {
		if (!fieldArray.itemSchema) {
			console.warn('No item schema available for array:', fieldArray.key);
			return;
		}

		// Generate a unique key for this array item
		const itemIndex = fieldArray.items.length;
		const itemKey = `${fieldArray.key}_${itemIndex + 1}`;

		// Determine what type of item to add based on schema type
		if (fieldArray.itemSchema.type === 'object') {
			this.addGroup(fieldArray.itemSchema, fieldArray, itemKey, itemIndex);
		} else if (fieldArray.itemSchema.type === 'array') {
			this.addArray(fieldArray.itemSchema, fieldArray, itemKey, itemIndex);
		} else {
			this.addField(fieldArray.itemSchema, fieldArray, itemKey, itemIndex);
		}
	}

	/**
	 * Removes an item from a FieldArray at the specified index.
	 */
	removeArrayItem(fieldArray: SchemaFieldArray, index: number): void {
		if (index < 0 || index >= fieldArray.items.length) {
			return;
		}

		const item = fieldArray.items[index];

		// Clean up subscriptions based on item type
		if (item.type === SchemaFieldType.Group) {
			this.cleanupFieldSubscriptions(item as SchemaFieldGroup);
		} else if (item.type === SchemaFieldType.Array) {
			this.cleanupArraySubscriptions(item as SchemaFieldArray);
		} else {
			const fieldConfig = item as SchemaFieldConfig;
			const subscription = this.subscriptions.get(fieldConfig.uniqueKey);
			if (subscription) {
				subscription.unsubscribe();
				this.subscriptions.delete(fieldConfig.uniqueKey);
			}
		}

		// Remove from items array and FormArray
		fieldArray.items.splice(index, 1);
		fieldArray.arrayRef?.removeAt(index);
	}

	/**
	 * Handles conditional schema logic for a field based on its current value.
	 * Called by valueChanges subscriptions.
	 *
	 * For each ConditionalSchema in the field's conditionalSchemas array:
	 * - If the field value matches triggerValue, add the schema's properties/fields to the parent
	 * - If the field value matches removeTriggerValue (or doesn't match triggerValue), remove
	 *   previously added fields/groups/arrays (tracked in addedKeys)
	 * - Track which keys were added in the ConditionalSchema.addedKeys for later removal
	 *
	 * This method enables:
	 * - if/then/else: check if condition matches, add "then" properties or "else" properties
	 * - oneOf: add properties for selected option, remove properties from previously selected option
	 * - anyOf: add/remove properties based on checkbox state
	 */
	handleConditionalSchemas(
		field: SchemaFieldConfig,
		currentValue: any,
		parent: SchemaFieldGroup | SchemaFieldArray,
	): void {
		if (!field.conditionalSchemas || field.conditionalSchemas.length === 0) {
			return;
		}
		// Sort conditional schemas so removal comes first, so that if we are adding a separate
		// schema with the same keys, they will get added.
		field.conditionalSchemas.sort((a, b) => {
			const shouldAddA = a.triggerValue !== undefined && currentValue === a.triggerValue;
			const shouldAddB = b.triggerValue !== undefined && currentValue === b.triggerValue;
			return !shouldAddA && shouldAddB ? -1 : shouldAddA && !shouldAddB ? 1 : 0;
		});

		for (const conditionalSchema of field.conditionalSchemas) {
			const shouldAdd =
				conditionalSchema.triggerValue !== undefined &&
				currentValue === conditionalSchema.triggerValue;
			const shouldRemove =
				conditionalSchema.removeTriggerValue !== undefined &&
				currentValue === conditionalSchema.removeTriggerValue;
			// Remove previously added keys if they exist and we should remove or value doesn't match
			if (conditionalSchema.addedKeys && conditionalSchema.addedKeys.length > 0) {
				if (shouldRemove || !shouldAdd) {
					// Remove all previously added keys
					if (parent.type === SchemaFieldType.Group) {
						const parentGroup = parent as SchemaFieldGroup;
						for (const key of conditionalSchema.addedKeys) {
							const item = parentGroup.fields[key];
							if (item) {
								// Clean up and remove the item
								this.cleanupAndRemoveItem(item, key, parent);
							}
						}
					}
					// Clear the added keys
					conditionalSchema.addedKeys = [];
				}
			}

			// Add schema properties if trigger value matches
			if (
				shouldAdd &&
				(!conditionalSchema.addedKeys || conditionalSchema.addedKeys.length === 0)
			) {
				// Update the parent's requiredFields if the conditional schema has required fields
				if (
					conditionalSchema.schema.required &&
					conditionalSchema.schema.required.length > 0 &&
					parent.type === SchemaFieldType.Group
				) {
					const parentGroup = parent as SchemaFieldGroup;
					if (!parentGroup.requiredFields) {
						parentGroup.requiredFields = [];
					}
					// Merge in the new required fields, avoiding duplicates
					for (const requiredKey of conditionalSchema.schema.required) {
						if (!parentGroup.requiredFields.includes(requiredKey)) {
							parentGroup.requiredFields.push(requiredKey);
						}
					}
				}

				// Create a modified parent with the field's uniqueKey for proper ordering
				const conditionalParent = { ...parent, uniqueKey: field.uniqueKey };
				const addedKeys = this.processProperties(
					conditionalSchema.schema,
					conditionalParent,
				);
				conditionalSchema.addedKeys = addedKeys;
			}
		}
	}

	/**
	 * Builds validators and validation metadata from a schema and parent context.
	 * Returns an object containing the validators array for FormControl and validations object for FieldConfig.
	 */
	private buildValidators(
		schema: JsonSchema,
		parent: SchemaFieldGroup | SchemaFieldArray,
		fieldKey?: string,
	): { validators: any[]; validations: any } {
		const validators = [];
		const validations: any = {};

		// Check if field is required by looking at parent's requiredFields array
		if (parent.type === SchemaFieldType.Group && fieldKey) {
			const parentGroup = parent as SchemaFieldGroup;
			if (parentGroup.requiredFields && parentGroup.requiredFields.includes(fieldKey)) {
				validators.push(Validators.required);
				validations.required = true;
			}
		}

		// String validations
		if (schema.maxLength !== undefined) {
			validators.push(Validators.maxLength(schema.maxLength));
			validations.maxLength = schema.maxLength;
		}
		if (schema.minLength !== undefined) {
			validators.push(Validators.minLength(schema.minLength));
			validations.minLength = schema.minLength;
		}
		if (schema.pattern) {
			validators.push(Validators.pattern(schema.pattern));
			validations.pattern = schema.pattern;
		}

		// Number validations
		if (schema.maximum !== undefined) {
			validators.push(Validators.max(schema.maximum));
			validations.maximum = schema.maximum;
		}
		if (schema.minimum !== undefined) {
			validators.push(Validators.min(schema.minimum));
			validations.minimum = schema.minimum;
		}
		if (schema.exclusiveMaximum !== undefined) {
			validators.push(Validators.max(schema.exclusiveMaximum - 1));
			validations.exclusiveMaximum = schema.exclusiveMaximum;
		}
		if (schema.exclusiveMinimum !== undefined) {
			validators.push(Validators.min(schema.exclusiveMinimum + 1));
			validations.exclusiveMinimum = schema.exclusiveMinimum;
		}

		return { validators, validations };
	}

	/**
	 * Helper method to process a schema and add its properties/fields to a parent.
	 * Returns an array of keys that were added (for tracking in ConditionalSchema.addedKeys)
	 */
	processProperties(schema: JsonSchema, parent: SchemaFieldGroup | SchemaFieldArray): string[] {
		const addedKeys: string[] = [];

		// Track the keys before processing
		const keysBefore =
			parent.type === SchemaFieldType.Group
				? Object.keys((parent as SchemaFieldGroup).fields)
				: [];

		// Process the schema, which will handle properties, anyOf, oneOf, if/then/else, etc.
		this.processSchema(schema, parent);

		// Track the keys after processing to determine what was added
		if (parent.type === SchemaFieldType.Group) {
			const keysAfter = Object.keys((parent as SchemaFieldGroup).fields);
			for (const key of keysAfter) {
				if (!keysBefore.includes(key)) {
					addedKeys.push(key);
				}
			}
		}

		return addedKeys;
	}

	/**
	 * Recursively cleans up all subscriptions for fields within a FieldGroup
	 */
	public cleanupFieldSubscriptions(fieldGroup: SchemaFieldGroup): void {
		for (const field of Object.values(fieldGroup.fields)) {
			if (field.type === SchemaFieldType.Group) {
				// Recursively clean up nested groups
				this.cleanupFieldSubscriptions(field as SchemaFieldGroup);
			} else if (field.type === SchemaFieldType.Array) {
				// Recursively clean up arrays
				this.cleanupArraySubscriptions(field as SchemaFieldArray);
			} else {
				// Clean up field subscription
				const fieldConfig = field as SchemaFieldConfig;
				const subscription = this.subscriptions.get(fieldConfig.uniqueKey);
				if (subscription) {
					subscription.unsubscribe();
					this.subscriptions.delete(fieldConfig.uniqueKey);
				}
			}
		}
	}

	/**
	 * Recursively cleans up all subscriptions for items within a FieldArray
	 */
	private cleanupArraySubscriptions(fieldArray: SchemaFieldArray): void {
		for (const item of fieldArray.items) {
			if (item.type === SchemaFieldType.Group) {
				// Recursively clean up nested groups
				this.cleanupFieldSubscriptions(item as SchemaFieldGroup);
			} else if (item.type === SchemaFieldType.Array) {
				// Recursively clean up nested arrays
				this.cleanupArraySubscriptions(item as SchemaFieldArray);
			} else {
				// Clean up field subscription
				const fieldConfig = item as SchemaFieldConfig;
				const subscription = this.subscriptions.get(fieldConfig.uniqueKey);
				if (subscription) {
					subscription.unsubscribe();
					this.subscriptions.delete(fieldConfig.uniqueKey);
				}
			}
		}
	}

	/**
	 * Helper to clean up a nested conditional schemas and removes it from its parent
	 *
	 * @param item The item to clean up and remove
	 * @param key The key of the item in the parent
	 * @param parent The parent group or array
	 */
	private cleanupAndRemoveItem(
		item: SchemaFieldConfig | SchemaFieldGroup | SchemaFieldArray,
		key: string,
		parent: SchemaFieldGroup | SchemaFieldArray,
	): void {
		// Recursively clean up nested conditional schemas
		this.cleanupNestedConditionalSchemas(item);

		// Remove the item from the parent
		if (parent.type === SchemaFieldType.Group) {
			const parentGroup = parent as SchemaFieldGroup;
			if (item.type === SchemaFieldType.Group) {
				this.removeGroup(key, parent);
			} else if (item.type === SchemaFieldType.Array) {
				this.removeArray(key, parent);
			} else {
				this.removeField(key, parentGroup);
			}
		}
	}

	/**
	 * Recursively cleans up nested conditional schemas that have been applied to a field/group/array.
	 * Ensures that when removing a field that has conditionalSchemas with addedKeys,
	 * we also remove any nested fields that were added by those conditional schemas.
	 *
	 * @param item The field, group, or array to clean up
	 */
	private cleanupNestedConditionalSchemas(
		item: SchemaFieldConfig | SchemaFieldGroup | SchemaFieldArray,
	): void {
		// First, handle groups and arrays - recursively clean up all fields within
		if (item.type === SchemaFieldType.Group) {
			const group = item as SchemaFieldGroup;
			// Create a copy of field keys to avoid modification during iteration
			const fieldKeys = Object.keys(group.fields);
			for (const fieldKey of fieldKeys) {
				const field = group.fields[fieldKey];
				if (field) {
					this.cleanupNestedConditionalSchemas(field);
				}
			}
		}

		if (item.type === SchemaFieldType.Array) {
			const array = item as SchemaFieldArray;
			// Create a copy of items to avoid modification during iteration
			const items = [...array.items];
			for (const arrayItem of items) {
				this.cleanupNestedConditionalSchemas(arrayItem);
			}
		}

		// Then handle field configs with conditional schemas
		if (item.conditionalSchemas) {
			for (const conditionalSchema of item.conditionalSchemas) {
				if (conditionalSchema.addedKeys && conditionalSchema.addedKeys.length > 0) {
					// Find the parent where these keys were added
					// For fields with conditionalSchemas, the keys are added to the field's parent
					const parent = item.parent;
					if (parent && parent.type === SchemaFieldType.Group) {
						// Remove each added key
						for (const key of conditionalSchema.addedKeys) {
							const nestedItem = (parent as SchemaFieldGroup).fields[key];
							if (nestedItem) {
								// Clean up and remove the nested item
								this.cleanupAndRemoveItem(nestedItem, key, parent);
							}
						}
					}
					// Clear the addedKeys array
					conditionalSchema.addedKeys = [];
				}
			}
		}
	}

	/**
	 * Converts enum values to options array with label and value.
	 */
	private convertEnumToOptions(schema: JsonSchema): { label: string; value: any }[] {
		return schema.enum.map(value => ({
			label: schema.format === 'options-label' ? this.snakeCaseToLabel(value) : value,
			value: value,
		}));
	}

	/**
	 * Converts a snake-case string to a human-readable label.
	 * Example: 'FLAG_CONTROLLED' => 'Flag Controlled'
	 */
	private snakeCaseToLabel(value: string): string {
		// If the value is not a string, return it as-is
		if (typeof value !== 'string') {
			return String(value);
		}
		// Convert snake_case to Title Case
		return value
			.split('_')
			.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');
	}
}
