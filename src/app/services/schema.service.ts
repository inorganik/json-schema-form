import { Injectable } from '@angular/core';
import { FieldArray, FieldGroup } from '../models/form-models';
import { JsonSchema } from '../models/schema-models';

@Injectable({
	providedIn: 'root',
})
export class SchemaService {
	constructor() {}

	schemaToFieldConfig(schema: JsonSchema): FieldGroup {
		/**
		 * todo: convert a schema to a field group config. It should
		 * traverse the schema, adding configs (either FieldConfig, FieldGroup or FieldArray)
		 * for each item.
		 *
		 * It will follow these rules for each item traversed:
		 *
		 * - allOf: include all the properties at the same level as allOf
		 * - anyOf: use a field of type checkbox to include the item. when checked it adds it
		 * - oneOf: add a field of type select using keys of oneOf
		 * - properties: add fields/arrays/groups for each item
		 * - for types, use the following:
		 *   • 'object': FieldGroup
		 *   • 'array': FieldArray
		 *   • all others: FieldConfig, with type assigned to FieldConfig's type property.
		 *      - 'select' field type should be used for enums with 5 or more items
		 *      - 'radio' field type should be used for 4 items or less
		 *
		 *
		 */
	}

	addField(schema: JsonSchema, parent: FieldGroup | FieldArray): void {
		/**
		 * It should new-up a FormControl, setting validation requirements based on config.
		 * It will create the FieldConfig, add it to the parent, It will assign the form control to
		 * the controlRef property, and add the control to the parent form group or form array via
		 * the groupRef or arrayRef properties of the parent.
		 */
	}

	removeField(key: string, parent: FieldGroup): void {
		/**
		 * It should remove the form control from the form group via the groupRef property of
		 * the parent, and remove the field config from the parent field group.
		 */
	}

	addGroup(schema: JsonSchema, parent: FieldGroup | FieldArray): void {
		/**
		 * Like addField, but for FormGroup/FieldGroup
		 */
	}

	removeGroup(key: string, parent: FieldGroup | FieldArray): void {
		/**
		 * Like addField, but for FormGroup/FieldGroup
		 */
	}

	addArray(schema: JsonSchema, parent: FieldGroup | FieldArray): void {
		/**
		 * Like addField, but for FormArray/FieldArray
		 */
	}

	removeArray(key: string, parent: FieldGroup | FieldArray): void {
		/**
		 * Like addField, but for FormArray/FieldArray
		 */
	}
}
