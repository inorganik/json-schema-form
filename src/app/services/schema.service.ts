import { Injectable } from '@angular/core';
import { FieldArray, FieldConfig, FieldGroup } from '../models/form-models';
import { JsonSchema } from '../models/schema-models';

@Injectable({
	providedIn: 'root',
})
export class SchemaService {
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
		// todo
		return {} as FieldGroup;
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
		// todo
	}

	/**
	 * Removes a group from the parent FormGroup or FormArray and from parent fields/items
	 */
	removeGroup(key: string, parent: FieldGroup | FieldArray): void {
		// todo
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
		// todo
	}

	/**
	 * Removes the form control from the form group via the groupRef property of
	 * the parent, and remove the field config from the parent field group or array.
	 */
	removeField(key: string, parent: FieldGroup): void {
		// todo
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
		// todo
	}

	/**
	 * Removes the form array from the parent FormGroup or FormArray and from parent fields/items
	 */
	removeArray(key: string, parent: FieldGroup | FieldArray): void {
		// todo
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
		// todo
	}

	/**
	 * Helper method to process a schema and add its properties/fields to a parent.
	 * Used by handleConditionalSchemas to add conditional fields.
	 * Traverses the schema's properties and calls addField, addGroup, or addArray as appropriate.
	 * Returns an array of keys that were added (for tracking in ConditionalSchema.addedKeys)
	 */
	processSchemaProperties(schema: JsonSchema, parent: FieldGroup | FieldArray): string[] {
		// todo
		return [];
	}
}
