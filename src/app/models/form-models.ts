import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { JsonSchema } from './schema-models';

export enum SchemaFieldType {
	Select = 'select',
	Radio = 'radio',
	Number = 'number',
	Text = 'text',
	Checkbox = 'checkbox',
	Group = 'group',
	Array = 'array',
	Parameter = 'parameter',
}

export interface FieldValidations {
	required?: boolean;
	maxLength?: number;
	minLength?: number;
	pattern?: string;
	maximum?: number;
	exclusiveMaximum?: number;
	minimum?: number;
	exclusiveMinimum?: number;
}

export interface FieldArrayValidations {
	maxItems?: number;
	minItems?: number;
}

/**
 * Holds metadata for conditionally rendered schemas based on field values
 */
export interface ConditionalSchema {
	// The value that triggers this schema to be added
	triggerValue?: any;
	// The value(s) that trigger this schema to be removed
	removeTriggerValue?: any;
	// The schema to add when triggered
	schema: JsonSchema;
	// Keys of fields/groups/arrays added by this conditional schema (for removal tracking)
	addedKeys?: string[];
}

export interface BaseSchemaConfig {
	label: string;
	description?: string;
	key: string;
	uniqueKey: string;
	type: SchemaFieldType;
	conditionalSchemas?: ConditionalSchema[];
	parent: SchemaFieldGroup | SchemaFieldArray | null;
}

export interface SchemaFieldConfig extends BaseSchemaConfig {
	controlRef: FormControl;
	options?: { label: string; value: any }[];
	removeable?: boolean;
	validations?: FieldValidations;
}

export interface SchemaFieldGroup extends BaseSchemaConfig {
	groupRef: FormGroup;
	fields: { [key: string]: SchemaFieldConfig | SchemaFieldGroup | SchemaFieldArray };
	validations?: FieldValidations;
}

export interface SchemaFieldArray extends BaseSchemaConfig {
	arrayRef: FormArray;
	items: Array<SchemaFieldConfig | SchemaFieldGroup | SchemaFieldArray>;
	itemSchema?: JsonSchema; // Schema template for array items
	validations?: FieldArrayValidations;
	canAddItem: () => boolean;
	canRemoveItem: () => boolean;
}
