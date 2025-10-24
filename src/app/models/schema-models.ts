/**
 * JSON Schema Draft 7 type definition
 * Supports all keywords and annotations from the specification
 */

export interface JsonSchema {
	// Core keywords
	$id?: string;
	$schema?: string;
	$ref?: string;
	$comment?: string;

	// Annotation keywords
	title?: string;
	description?: string;
	default?: any;
	readOnly?: boolean;
	writeOnly?: boolean;
	examples?: any[];

	// Type keywords
	type?: JsonSchemaType;
	enum?: any[];
	const?: any;

	// Numeric keywords
	multipleOf?: number;
	maximum?: number;
	exclusiveMaximum?: number;
	minimum?: number;
	exclusiveMinimum?: number;

	// String keywords
	maxLength?: number;
	minLength?: number;
	pattern?: string;
	format?: string;

	// Array keywords
	items?: JsonSchema | JsonSchema[];
	additionalItems?: JsonSchema;
	maxItems?: number;
	minItems?: number;
	uniqueItems?: boolean;
	contains?: JsonSchema;

	// Object keywords
	maxProperties?: number;
	minProperties?: number;
	required?: string[];
	properties?: { [key: string]: JsonSchema };
	patternProperties?: { [pattern: string]: JsonSchema };
	additionalProperties?: JsonSchema;
	dependencies?: { [key: string]: JsonSchema | string[] };
	propertyNames?: JsonSchema;

	// Conditional keywords
	if?: JsonSchema;
	then?: JsonSchema;
	else?: JsonSchema;

	// Combining keywords
	allOf?: JsonSchema[];
	anyOf?: JsonSchema[];
	oneOf?: JsonSchema[];
	not?: JsonSchema;

	// Media keywords
	contentMediaType?: string;
	contentEncoding?: string;

	// Schema composition
	definitions?: { [key: string]: JsonSchema };
	$defs?: { [key: string]: JsonSchema };
}

export type JsonSchemaType =
	| 'null'
	| 'boolean'
	| 'object'
	| 'array'
	| 'number'
	| 'integer'
	| 'string';
