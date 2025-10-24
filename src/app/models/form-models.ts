import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { JsonSchema } from './schema-models';

export enum FieldType {
	Select = 'select',
	Radio = 'radio',
	Number = 'number',
	Text = 'text',
	Checkbox = 'checkbox',
	Group = 'group',
	Array = 'array',
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

export interface FieldConfig {
	label: string;
	controlRef: FormControl;
	key: string;
	uniqueKey: string;
	type: FieldType;
	description?: string;
	options?: { label: string; value: any }[];
	validations?: FieldValidations;
	parent: FieldGroup | FieldArray;
	conditionalSchemas?: ConditionalSchema[];
}

export interface FieldGroup {
	label: string;
	groupRef: FormGroup;
	key: string;
	uniqueKey: string;
	type: FieldType;
	fields: { [key: string]: FieldConfig | FieldGroup | FieldArray };
	validations?: FieldValidations;
	parent: FieldGroup | FieldArray | null;
	conditionalSchemas?: ConditionalSchema[];
}

export interface FieldArray {
	label: string;
	arrayRef: FormArray;
	key: string;
	uniqueKey: string;
	type: FieldType;
	description?: string;
	items: Array<FieldConfig | FieldGroup | FieldArray>; // holds added item configs
	itemSchema?: JsonSchema; // Schema template for array items
	validations?: FieldArrayValidations;
	canAddItem: () => boolean;
	parent: FieldGroup | FieldArray;
	conditionalSchemas?: ConditionalSchema[];
}
