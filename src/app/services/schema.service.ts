import { Injectable } from '@angular/core';
import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { FieldArray, FieldConfig, FieldGroup, FieldType } from '../models/form-models';
import { JsonSchema } from '../models/schema-models';

@Injectable({
	providedIn: 'root',
})
export class SchemaService {
	private subscriptions = new Map<string, Subscription>();
	private rootSchema: JsonSchema | null = null;

	constructor() {}

	/**
	 * Converts a schema to a field group config. Traverses the schema, adding
	 * configs (FieldConfig, FieldGroup or FieldArray) for each item.
	 *
	 * Returns the root FieldGroup representing the entire form
	 */
	schemaToFieldConfig(schema: JsonSchema): FieldGroup {
		// Store the root schema for resolving $refs
		this.rootSchema = schema;

		// Create the root field group
		const rootGroup: FieldGroup = {
			label: schema.title || 'Form',
			groupRef: new FormGroup({}),
			key: 'root',
			type: FieldType.Group,
			fields: {},
			parent: null,
			conditionalSchemas: [],
		};

		// Add required validation if present
		if (schema.required && schema.required.length > 0) {
			rootGroup.validations = { required: true };
		}

		// Process the schema (handles allOf, properties, anyOf, oneOf, if/then/else)
		this.processSchema(schema, rootGroup, 'root');

		return rootGroup;
	}

	/**
	 * Resolves a $ref path to get the referenced schema from $defs or definitions.
	 * Supports JSON Pointer format like "#/$defs/productFlag" or "#/definitions/productFlag"
	 *
	 * @param ref The $ref string (e.g., "#/$defs/productFlag")
	 * @returns The resolved schema or null if not found
	 */
	private resolveRef(ref: string): JsonSchema | null {
		if (!this.rootSchema || !ref.startsWith('#/')) {
			return null;
		}

		// Remove the leading "#/" and split the path
		const path = ref.substring(2).split('/');

		// Navigate through the path to find the referenced schema
		let current: any = this.rootSchema;
		for (const segment of path) {
			if (current && typeof current === 'object' && segment in current) {
				current = current[segment];
			} else {
				console.warn(`Could not resolve $ref: ${ref}`);
				return null;
			}
		}

		return current as JsonSchema;
	}

	/**
	 * Processes a schema to handle oneOf, anyOf, and if/then/else conditional logic.
	 * This method is called from schemaToFieldConfig, addGroup, and addArray to handle
	 * nested conditional schemas at any level.
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
	private processSchema(schema: JsonSchema, parent: FieldGroup | FieldArray, key?: string): void {
		console.log('process schema', schema, 'key:', key);

		// Handle $ref - resolve and process the referenced schema
		if (schema.$ref) {
			const resolvedSchema = this.resolveRef(schema.$ref);
			if (resolvedSchema) {
				// Process the resolved schema with the same parent and key
				this.processSchema(resolvedSchema, parent, key);
			}
			return;
		}

		// Process allOf - merge all schemas at the same level
		if (schema.allOf) {
			for (const allOfSchema of schema.allOf) {
				// Recursively process each allOf schema to handle nested conditionals
				this.processSchema(allOfSchema, parent);
			}
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

		// Process regular properties FIRST (before if/then/else)
		if (schema.properties) {
			for (const [propKey, propertySchema] of Object.entries(schema.properties)) {
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
					this.addGroup(actualSchema, parent, propKey);
				} else if (actualSchema.type === 'array') {
					this.addArray(actualSchema, parent, propKey);
				} else {
					this.addField(actualSchema, parent, propKey);
				}
			}
		}

		// Handle if/then/else - add conditional schemas to the field referenced in "if"
		// This is processed AFTER properties so the referenced field exists
		if (schema.if && schema.then) {
			// Find the field referenced in the "if" condition
			if (schema.if.properties) {
				for (const [ifKey, ifSchema] of Object.entries(schema.if.properties)) {
					const field = (parent as FieldGroup).fields[ifKey] as FieldConfig;
					if (field && field.conditionalSchemas) {
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
	private handleAnyOf(schema: JsonSchema, parent: FieldGroup | FieldArray, key?: string): void {
		const baseKey = key || 'anyOf';

		// When we have a key (property name), create a group for it
		if (key && parent.type === FieldType.Group) {
			// Create a group for this property
			const groupSchema: JsonSchema = {
				type: 'object',
				title: schema.title || baseKey,
				properties: {},
			};
			this.addGroup(groupSchema, parent, key);
			const targetGroup = (parent as FieldGroup).fields[key] as FieldGroup;

			// Create checkbox fields for each anyOf option
			// These controls are NOT added to the FormGroup, so they won't appear in form value
			for (let i = 0; i < schema.anyOf!.length; i++) {
				const anyOfSchema = schema.anyOf![i];
				const checkboxKey = `${baseKey}_anyOf_${i}`;

				// Create a control for the checkbox (not added to FormGroup)
				const conditionalControl = new FormControl(false);

				const checkboxField: FieldConfig = {
					label: anyOfSchema.title || `${baseKey} option ${i + 1}`,
					controlRef: conditionalControl,
					key: checkboxKey,
					type: FieldType.Checkbox,
					parent: targetGroup,
					conditionalSchemas: [
						{
							triggerValue: true,
							removeTriggerValue: false,
							schema: anyOfSchema,
							addedKeys: [],
						},
					],
				};

				// Add the field to the target group (but not to the FormGroup)
				targetGroup.fields[checkboxKey] = checkboxField;

				// Set up valueChanges subscription for conditional logic
				const subscription = conditionalControl.valueChanges.subscribe(value => {
					this.handleConditionalSchemas(checkboxField, value, targetGroup);
				});
				this.subscriptions.set(`${key}.${checkboxKey}`, subscription);
			}
		} else {
			// Legacy behavior: add checkboxes directly to parent (no key provided)
			console.log('NO PARENT KEY anyOf handling', schema);
			for (let i = 0; i < schema.anyOf!.length; i++) {
				const anyOfSchema = schema.anyOf![i];
				const checkboxKey = `${baseKey}_anyOf_${i}`;

				const checkboxSchema: JsonSchema = {
					type: 'boolean',
					title: anyOfSchema.title || `${baseKey} option ${i + 1}`,
				};

				this.addField(checkboxSchema, parent, checkboxKey);

				const checkboxField = (parent as FieldGroup).fields[checkboxKey] as FieldConfig;
				if (checkboxField && checkboxField.conditionalSchemas) {
					checkboxField.conditionalSchemas.push({
						triggerValue: true,
						removeTriggerValue: false,
						schema: anyOfSchema,
						addedKeys: [],
					});
				}
			}
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
	private handleOneOf(schema: JsonSchema, parent: FieldGroup | FieldArray, key?: string): void {
		const baseKey = key || 'oneOf';

		// When we have a key (property name), create a group for it
		if (key && parent.type === FieldType.Group) {
			// Create a group for this property
			const groupSchema: JsonSchema = {
				type: 'object',
				title: schema.title || baseKey,
				properties: {},
			};
			this.addGroup(groupSchema, parent, key);
			const targetGroup = (parent as FieldGroup).fields[key] as FieldGroup;

			// Create radio field for oneOf selection
			// This control is NOT added to the FormGroup, so it won't appear in form value
			const options = schema.oneOf!.map((oneOfSchema, i) => {
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

			const radioKey = `${baseKey}_oneOf_selector`;
			const radioField: FieldConfig = {
				label: '',
				controlRef: conditionalControl,
				key: radioKey,
				type: FieldType.Radio,
				options,
				parent: targetGroup,
				conditionalSchemas: schema.oneOf!.map((oneOfSchema, i) => ({
					triggerValue: i,
					schema: oneOfSchema,
					addedKeys: [],
				})),
			};

			// Add the field to the target group (but not to the FormGroup)
			targetGroup.fields[radioKey] = radioField;

			// Set up valueChanges subscription for conditional logic
			const subscription = conditionalControl.valueChanges.subscribe(value => {
				this.handleConditionalSchemas(radioField, value, targetGroup);
			});
			this.subscriptions.set(`${key}.${radioKey}`, subscription);
		} else {
			// Legacy behavior: add radio directly to parent (no key provided)
			console.log('NO PARENT KEY oneOf handling', schema);

			const options = schema.oneOf!.map((oneOfSchema, i) => {
				const titleFromProps = oneOfSchema.properties
					? Object.values(oneOfSchema.properties)[0]?.title
					: undefined;

				return {
					label: oneOfSchema.title || titleFromProps || `Option ${i + 1}`,
					value: i,
				};
			});

			const radioSchema: JsonSchema = {
				type: 'string',
				title: schema.title || baseKey,
				enum: options.map(opt => opt.value),
			};

			this.addField(radioSchema, parent, baseKey);

			const radioField = (parent as FieldGroup).fields[baseKey] as FieldConfig;
			if (radioField && radioField.conditionalSchemas) {
				radioField.type = FieldType.Radio;
				radioField.options = options;

				for (let i = 0; i < schema.oneOf!.length; i++) {
					radioField.conditionalSchemas.push({
						triggerValue: i,
						schema: schema.oneOf![i],
						addedKeys: [],
					});
				}
			}
		}
	}

	/**
	 * It creates a new FormGroup for the groupRef property in FieldGroup, and assigns
	 * properties of the FieldGroup based on the schema
	 */
	addGroup(schema: JsonSchema, parent: FieldGroup | FieldArray, key: string): void {
		// Create a new FormGroup
		const formGroup = new FormGroup({});

		// Create the FieldGroup config
		const fieldGroup: FieldGroup = {
			label: schema.title || key,
			groupRef: formGroup,
			key,
			type: FieldType.Group,
			fields: {},
			parent,
			conditionalSchemas: [],
		};

		// Add required validation if present
		if (schema.required && schema.required.length > 0) {
			fieldGroup.validations = { required: true };
		}

		// Add to parent
		if (parent.type === FieldType.Group) {
			const parentGroup = parent as FieldGroup;
			parentGroup.fields[key] = fieldGroup;
			parentGroup.groupRef?.addControl(key, formGroup);
		} else if (parent.type === FieldType.Array) {
			const parentArray = parent as FieldArray;
			parentArray.items.push(fieldGroup);
			parentArray.arrayRef?.push(formGroup);
		}

		// Process the schema recursively (handles properties, allOf, anyOf, oneOf, if/then/else)
		this.processSchema(schema, fieldGroup);
	}

	/**
	 * Removes a group from the parent FormGroup or FormArray and from parent fields/items
	 */
	removeGroup(key: string, parent: FieldGroup | FieldArray): void {
		if (parent.type === FieldType.Group) {
			const parentGroup = parent as FieldGroup;
			const fieldGroup = parentGroup.fields[key] as FieldGroup;

			// Recursively clean up subscriptions for all nested fields
			if (fieldGroup) {
				this.cleanupFieldSubscriptions(fieldGroup);
			}

			// Remove from FormGroup
			parentGroup.groupRef?.removeControl(key);
			// Remove from fields object
			delete parentGroup.fields[key];
		} else if (parent.type === FieldType.Array) {
			const parentArray = parent as FieldArray;
			// Find and remove from items array
			const index = parentArray.items.findIndex(item => item.key === key);
			if (index !== -1) {
				const fieldGroup = parentArray.items[index] as FieldGroup;

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
	addField(schema: JsonSchema, parent: FieldGroup | FieldArray, key: string): void {
		// Build validators using helper method
		const { validators, validations } = this.buildValidators(schema, parent);

		// Create form control with default value and validators
		const defaultValue = schema.default !== undefined ? schema.default : null;
		const control = new FormControl(defaultValue, validators);

		// Determine field type
		let fieldType: FieldType;
		if (schema.enum) {
			// Use select for 5+ items, radio for 4 or less
			fieldType = schema.enum.length >= 5 ? FieldType.Select : FieldType.Radio;
		} else {
			// Map schema type to field type
			switch (schema.type) {
				case 'boolean':
					fieldType = FieldType.Checkbox;
					break;
				case 'number':
				case 'integer':
					fieldType = FieldType.Number;
					break;
				default:
					fieldType = FieldType.Text;
			}
		}

		// Create field config
		const fieldConfig: FieldConfig = {
			label: schema.title || key,
			controlRef: control,
			key,
			type: fieldType,
			description: schema.description,
			options: schema.enum ? this.convertEnumToOptions(schema.enum) : undefined,
			validations: Object.keys(validations).length > 0 ? validations : undefined,
			parent,
			conditionalSchemas: [],
		};

		// Set up valueChanges subscription for conditional schemas
		const subscription = control.valueChanges.subscribe(value => {
			// console.log('field changed', fieldConfig, value);
			if (fieldConfig.conditionalSchemas && fieldConfig.conditionalSchemas.length > 0) {
				this.handleConditionalSchemas(fieldConfig, value, parent);
			}
		});

		// Store subscription for cleanup later
		this.subscriptions.set(key, subscription);

		// Add to parent
		if (parent.type === FieldType.Group) {
			const parentGroup = parent as FieldGroup;
			parentGroup.fields[key] = fieldConfig;
			parentGroup.groupRef?.addControl(key, control);
		} else if (parent.type === FieldType.Array) {
			const parentArray = parent as FieldArray;
			parentArray.items.push(fieldConfig);
			parentArray.arrayRef?.push(control);
		}
	}

	/**
	 * Removes the form control from the form group via the groupRef property of
	 * the parent, and remove the field config from the parent field group or array.
	 */
	removeField(key: string, parent: FieldGroup): void {
		if (parent.type === FieldType.Group) {
			// Unsubscribe from valueChanges if subscription exists
			const subscription = this.subscriptions.get(key);
			if (subscription) {
				subscription.unsubscribe();
				this.subscriptions.delete(key);
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
	addArray(schema: JsonSchema, parent: FieldGroup | FieldArray, key: string): void {
		// Create a new FormArray
		const formArray = new FormArray<any>([]);

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
		const fieldArray: FieldArray = {
			label: schema.title || key,
			arrayRef: formArray,
			key,
			type: FieldType.Array,
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
			parent,
			conditionalSchemas: [],
		};

		// Add to parent
		if (parent.type === FieldType.Group) {
			const parentGroup = parent as FieldGroup;
			parentGroup.fields[key] = fieldArray;
			parentGroup.groupRef?.addControl(key, formArray);
		} else if (parent.type === FieldType.Array) {
			const parentArray = parent as FieldArray;
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
	removeArray(key: string, parent: FieldGroup | FieldArray): void {
		if (parent.type === FieldType.Group) {
			const parentGroup = parent as FieldGroup;
			const fieldArray = parentGroup.fields[key] as FieldArray;

			// Recursively clean up subscriptions for all items in the array
			if (fieldArray) {
				this.cleanupArraySubscriptions(fieldArray);
			}

			// Remove from FormGroup
			parentGroup.groupRef?.removeControl(key);
			// Remove from fields object
			delete parentGroup.fields[key];
		} else if (parent.type === FieldType.Array) {
			const parentArray = parent as FieldArray;
			// Find and remove from items array
			const index = parentArray.items.findIndex(item => item.key === key);
			if (index !== -1) {
				const fieldArray = parentArray.items[index] as FieldArray;

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
	addArrayItem(fieldArray: FieldArray): void {
		if (!fieldArray.itemSchema) {
			console.warn('No item schema available for array:', fieldArray.key);
			return;
		}

		// Generate a unique key for this array item
		const itemKey = `${fieldArray.key}_item_${fieldArray.items.length}`;

		// Determine what type of item to add based on schema type
		if (fieldArray.itemSchema.type === 'object') {
			this.addGroup(fieldArray.itemSchema, fieldArray, itemKey);
		} else if (fieldArray.itemSchema.type === 'array') {
			this.addArray(fieldArray.itemSchema, fieldArray, itemKey);
		} else {
			this.addField(fieldArray.itemSchema, fieldArray, itemKey);
		}
	}

	/**
	 * Removes an item from a FieldArray at the specified index.
	 */
	removeArrayItem(fieldArray: FieldArray, index: number): void {
		if (index < 0 || index >= fieldArray.items.length) {
			return;
		}

		const item = fieldArray.items[index];

		// Clean up subscriptions based on item type
		if (item.type === FieldType.Group) {
			this.cleanupFieldSubscriptions(item as FieldGroup);
		} else if (item.type === FieldType.Array) {
			this.cleanupArraySubscriptions(item as FieldArray);
		} else {
			const fieldConfig = item as FieldConfig;
			const subscription = this.subscriptions.get(fieldConfig.key);
			if (subscription) {
				subscription.unsubscribe();
				this.subscriptions.delete(fieldConfig.key);
			}
		}

		// Remove from items array and FormArray
		fieldArray.items.splice(index, 1);
		fieldArray.arrayRef?.removeAt(index);
	}

	/**
	 * Handles conditional schema logic for a field based on its current value.
	 * Called by valueChanges subscriptions set up in addField.
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
		field: FieldConfig,
		currentValue: any,
		parent: FieldGroup | FieldArray,
	): void {
		if (!field.conditionalSchemas || field.conditionalSchemas.length === 0) {
			return;
		}

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
					for (const key of conditionalSchema.addedKeys) {
						if (parent.type === FieldType.Group) {
							const parentGroup = parent as FieldGroup;
							const field = parentGroup.fields[key];
							if (field) {
								if (field.type === FieldType.Group) {
									this.removeGroup(key, parent);
								} else if (field.type === FieldType.Array) {
									this.removeArray(key, parent);
								} else {
									this.removeField(key, parentGroup);
								}
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
				console.log('process properties');

				const addedKeys = this.processProperties(conditionalSchema.schema, parent);
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
		parent: FieldGroup | FieldArray,
	): { validators: any[]; validations: any } {
		const validators = [];
		const validations: any = {};

		// Check if field is required
		if (parent.type === FieldType.Group) {
			const parentGroup = parent as FieldGroup;
			if (parentGroup.validations?.required) {
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
			validations.exclusiveMaximum = schema.exclusiveMaximum;
		}
		if (schema.exclusiveMinimum !== undefined) {
			validations.exclusiveMinimum = schema.exclusiveMinimum;
		}

		return { validators, validations };
	}

	/**
	 * Helper method to process a schema and add its properties/fields to a parent.
	 * Returns an array of keys that were added (for tracking in ConditionalSchema.addedKeys)
	 */
	processProperties(schema: JsonSchema, parent: FieldGroup | FieldArray): string[] {
		const addedKeys: string[] = [];

		// Track the keys before processing
		const keysBefore =
			parent.type === FieldType.Group ? Object.keys((parent as FieldGroup).fields) : [];

		// Process the schema, which will handle properties, anyOf, oneOf, if/then/else, etc.
		this.processSchema(schema, parent);

		// Track the keys after processing to determine what was added
		if (parent.type === FieldType.Group) {
			const keysAfter = Object.keys((parent as FieldGroup).fields);
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
	private cleanupFieldSubscriptions(fieldGroup: FieldGroup): void {
		for (const [key, field] of Object.entries(fieldGroup.fields)) {
			if (field.type === FieldType.Group) {
				// Recursively clean up nested groups
				this.cleanupFieldSubscriptions(field as FieldGroup);
			} else if (field.type === FieldType.Array) {
				// Recursively clean up arrays
				this.cleanupArraySubscriptions(field as FieldArray);
			} else {
				// Clean up field subscription
				const subscription = this.subscriptions.get(key);
				if (subscription) {
					subscription.unsubscribe();
					this.subscriptions.delete(key);
				}
			}
		}
	}

	/**
	 * Recursively cleans up all subscriptions for items within a FieldArray
	 */
	private cleanupArraySubscriptions(fieldArray: FieldArray): void {
		for (const item of fieldArray.items) {
			if (item.type === FieldType.Group) {
				// Recursively clean up nested groups
				this.cleanupFieldSubscriptions(item as FieldGroup);
			} else if (item.type === FieldType.Array) {
				// Recursively clean up nested arrays
				this.cleanupArraySubscriptions(item as FieldArray);
			} else {
				// Clean up field subscription
				const fieldConfig = item as FieldConfig;
				const subscription = this.subscriptions.get(fieldConfig.key);
				if (subscription) {
					subscription.unsubscribe();
					this.subscriptions.delete(fieldConfig.key);
				}
			}
		}
	}

	/**
	 * Converts enum values to options array with label and value.
	 * Converts snake-case values like 'FLAG_CONTROLLED' to "Flag Controlled"
	 */
	private convertEnumToOptions(enumValues: any[]): { label: string; value: any }[] {
		return enumValues.map(value => ({
			label: this.snakeCaseToLabel(value),
			value: value,
		}));
	}

	/**
	 * Converts a snake-case string to a human-readable label.
	 * Example: 'FLAG_CONTROLLED' => 'Flag Controlled'
	 */
	private snakeCaseToLabel(value: any): string {
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
