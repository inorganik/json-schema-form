import { FormArray, FormControl, FormGroup } from '@angular/forms';

export enum FieldType {
	'select',
	'radio',
	'number',
	'text',
	'checkbox',
	'group',
	'array',
}

export interface FieldConfig {
	label: string;
	controlRef: FormControl;
	key: string;
	type: FieldType;
	required: boolean;
	description?: string;
	options?: any[];
}

export interface FieldGroup {
	label: string;
	groupRef?: FormGroup;
	type: FieldType;
	fields: { [key: string]: FieldConfig | FieldGroup | FieldArray };
	// todo: add handler function which would take the form value
	// and conditonally add fields based on conditional schemas
}

export interface FieldArray {
	label: string;
	arrayRef?: FormArray;
	type: FieldType;
	items: Array<FieldConfig | FieldGroup | FieldArray>;
	minItems?: number;
	maxItems?: number;
	// todo: add handler function which would take the value
	// and conditonally add fields based on conditional schemas
}
