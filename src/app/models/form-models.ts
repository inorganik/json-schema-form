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

export interface FieldConfig {
	label: string;
	controlRef: FormControl;
	key: string;
	type: FieldType;
	description?: string;
	options?: any[];
	validations: FieldValidations;
}

export interface FieldGroup {
	label: string;
	groupRef?: FormGroup;
	key: string;
	type: FieldType;
	fields: { [key: string]: FieldConfig | FieldGroup | FieldArray };
	// todo: add handler function which would take the form value
	// and conditonally add fields based on conditional schemas
}

export interface FieldArrayValidations {
	maxItems?: number;
	minItems?: number;
}

export interface FieldArray {
	label: string;
	arrayRef?: FormArray;
	type: FieldType;
	key: string;
	items: Array<FieldConfig | FieldGroup | FieldArray>;
	minItems?: number;
	maxItems?: number;
	// todo: add handler function which would take the value
	// and conditonally add fields based on conditional schemas
}
