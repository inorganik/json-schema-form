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

	constructor() {}

	schemaToFieldConfig(schema: JsonSchema): FieldGroup {
		/**
		 * Converts a schema to a field group config. Traverses the schema, adding
		 * configs (FieldConfig, FieldGroup or FieldArray) for each item.
		 *
		 * It will follow these rules for each item traversed:
		 *
		 * - properties: add fields/arrays/groups for each item
		 * - for types of each schema, use the following:
		 *   • 'object': FieldGroup - use addGroup
		 *   • 'array': FieldArray - use addArray
		 *   • all other types: FieldConfig - use addField
		 * - allOf: include all the properties at the same level as allOf
		 * - anyOf: add a type "checkbox" field config for each schema in the anyOf. Store schemas
		 *   in conditionalSchemas array. Setup valueChanges handler to call handleConditionalSchemas
		 * - oneOf: add a type "radio" field config with options for each schema. Store schemas
		 *   in conditionalSchemas array. Setup valueChanges handler to call handleConditionalSchemas
		 * - if/then/else: store then/else schemas in conditionalSchemas of the field referenced in "if".
		 *   Setup valueChanges handler on that field to call handleConditionalSchemas
		 *
		 * Returns the root FieldGroup representing the entire form
		 *
		 */

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

		// Process allOf - merge all schemas at the same level
		if (schema.allOf) {
			for (const allOfSchema of schema.allOf) {
				if (allOfSchema.properties) {
					this.processSchemaProperties(allOfSchema, rootGroup);
				}
			}
		}

		// Process regular properties
		if (schema.properties) {
			for (const [key, propertySchema] of Object.entries(schema.properties)) {
				// Handle anyOf - create checkbox fields
				if (propertySchema.anyOf) {
					for (let i = 0; i < propertySchema.anyOf.length; i++) {
						const anyOfSchema = propertySchema.anyOf[i];
						const checkboxKey = `${key}_anyOf_${i}`;

						// Create a checkbox field for this anyOf option
						const checkboxSchema: JsonSchema = {
							type: 'boolean',
							title: anyOfSchema.title || `${key} option ${i + 1}`,
						};

						this.addField(checkboxSchema, rootGroup, checkboxKey);

						// Get the field we just added and set up conditional schemas
						const checkboxField = rootGroup.fields[checkboxKey] as FieldConfig;
						if (checkboxField && checkboxField.conditionalSchemas) {
							checkboxField.conditionalSchemas.push({
								triggerValue: true,
								removeTriggerValue: false,
								schema: anyOfSchema,
								addedKeys: [],
							});
						}
					}
					continue;
				}

				// Handle oneOf - create radio field with options
				if (propertySchema.oneOf) {
					const options = propertySchema.oneOf.map((schema, i) => {
						const titleFromProps = schema.properties
							? Object.values(schema.properties)[0]?.title
							: undefined;
						return {
							label: schema.title || titleFromProps || `Option ${i + 1}`,
							value: i,
						};
					});

					const radioSchema: JsonSchema = {
						type: 'string',
						title: propertySchema.title || key,
						enum: options.map(opt => opt.value),
					};

					this.addField(radioSchema, rootGroup, key);

					// Get the field we just added and set up conditional schemas
					const radioField = rootGroup.fields[key] as FieldConfig;
					if (radioField && radioField.conditionalSchemas) {
						// Override the field type to be radio
						radioField.type = FieldType.Radio;
						radioField.options = options;

						// Add conditional schemas for each oneOf option
						for (let i = 0; i < propertySchema.oneOf.length; i++) {
							radioField.conditionalSchemas.push({
								triggerValue: i,
								schema: propertySchema.oneOf[i],
								addedKeys: [],
							});
						}
					}
					continue;
				}

				// Regular property - process normally
				const schemaType = Array.isArray(propertySchema.type)
					? propertySchema.type[0]
					: propertySchema.type;

				if (schemaType === 'object') {
					this.addGroup(propertySchema, rootGroup, key);
				} else if (schemaType === 'array') {
					this.addArray(propertySchema, rootGroup, key);
				} else {
					this.addField(propertySchema, rootGroup, key);
				}
			}
		}

		// Handle if/then/else - add conditional schemas to the field referenced in "if"
		if (schema.if && schema.then) {
			// Find the field referenced in the "if" condition
			if (schema.if.properties) {
				for (const [ifKey, ifSchema] of Object.entries(schema.if.properties)) {
					const field = rootGroup.fields[ifKey] as FieldConfig;
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
					}
				}
			}
		}

		return rootGroup;
	}

	/**
	 * It creates a new FormGroup for the groupRef property in FieldGroup, and assigns
	 * properties of the FieldGroup based on the schema:
	 *
	 * - label from title
	 * - key from property name that holds schema (under "properties")
	 * - type will always be "group"
	 * - fields will hold properties, and be added with this.addField
	 * - parent reference to parent FieldGroup or FieldArray
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

		// Process properties recursively
		if (schema.properties) {
			this.processSchemaProperties(schema, fieldGroup);
		}
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
	 * New-up a FormControl, setting validation requirements based on schema. Creates the
	 * FieldConfig and adds it to the parent, assigns the form control to the controlRef property,
	 * and add the control to the parent form group or form array via the groupRef or arrayRef
	 * properties of the parent. It assigns FieldConfig properties based on the schema:
	 *
	 * - label from title
	 * - key from property name that holds schema
	 * - type from type, but where there is an enum:
	 *     • 'select' field type should be used for enums with 5 or more items
	 *     • 'radio' field type should be used for 4 items or less
	 * - description from description
	 * - options from enum values
	 * - validations come from schema and parent, if any
	 * - parent reference to parent FieldGroup or FieldArray
	 * - sets up a valueChanges subscription to call handleConditionalSchemas for any
	 *   conditionalSchemas stored in this field
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
			const schemaType = Array.isArray(schema.type) ? schema.type[0] : schema.type;
			switch (schemaType) {
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
			console.log('field changed', fieldConfig, value);
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
	 * New-up a FormArray, setting validation requirements based on schema. Creates the
	 * FieldArray and adds it to the parent, assigns the form array to the arrayRef property,
	 * and add the form array to the parent form group or form array via the groupRef or arrayRef
	 * properties of the parent. It assigns FieldArray properties based on the schema:
	 *
	 * - label from title
	 * - key from property name that holds schema
	 * - type will always be "array"
	 * - description from description
	 * - validations come from schema and parent, if any
	 * - reference to parent FieldGroup or FieldArray
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

		// Add minimum required items if specified
		if (itemSchema && schema.minItems) {
			for (let i = 0; i < schema.minItems; i++) {
				this.addArrayItem(fieldArray, itemSchema);
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
	addArrayItem(fieldArray: FieldArray, itemSchema?: JsonSchema): void {
		if (!itemSchema) {
			itemSchema = fieldArray.itemSchema;
		}

		if (!itemSchema) {
			console.warn('No item schema available for array:', fieldArray.key);
			return;
		}

		// Generate a unique key for this array item
		const itemKey = `${fieldArray.key}_item_${fieldArray.items.length}`;

		// Determine what type of item to add based on schema type
		const schemaType = Array.isArray(itemSchema.type) ? itemSchema.type[0] : itemSchema.type;

		if (schemaType === 'object') {
			this.addGroup(itemSchema, fieldArray, itemKey);
		} else if (schemaType === 'array') {
			this.addArray(itemSchema, fieldArray, itemKey);
		} else {
			this.addField(itemSchema, fieldArray, itemKey);
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
		parent: FieldGroup | FieldArray
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
				const addedKeys = this.processSchemaProperties(conditionalSchema.schema, parent);
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
		parent: FieldGroup | FieldArray
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
	 * Used by handleConditionalSchemas to add conditional fields.
	 * Traverses the schema's properties and calls addField, addGroup, or addArray as appropriate.
	 * Returns an array of keys that were added (for tracking in ConditionalSchema.addedKeys)
	 */
	processSchemaProperties(schema: JsonSchema, parent: FieldGroup | FieldArray): string[] {
		const addedKeys: string[] = [];

		if (!schema.properties) {
			return addedKeys;
		}

		// Iterate through each property in the schema
		for (const [key, propertySchema] of Object.entries(schema.properties)) {
			const schemaType = Array.isArray(propertySchema.type)
				? propertySchema.type[0]
				: propertySchema.type;

			// Determine what type of field to add based on schema type
			if (schemaType === 'object') {
				this.addGroup(propertySchema, parent, key);
				addedKeys.push(key);
			} else if (schemaType === 'array') {
				this.addArray(propertySchema, parent, key);
				addedKeys.push(key);
			} else {
				this.addField(propertySchema, parent, key);
				addedKeys.push(key);
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
