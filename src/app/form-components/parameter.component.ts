import { CommonModule } from '@angular/common';
import { Component, inject, Input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { SchemaFieldConfig, SchemaFieldGroup } from '../models/form-models';
import { JsonSchema } from '../models/schema-models';
import { SchemaService } from '../services/schema.service';

@Component({
	selector: 'app-parameter-field',
	imports: [CommonModule, ReactiveFormsModule],
	template: `
		<div class="form-field">
			<label class="field-label">
				{{ config.label }}
			</label>
			<input type="text" [formControl]="config.controlRef" class="text-input" />
			<button type="button" (click)="addParameter()">Add</button>
		</div>
	`,
	styles: [
		`
			.form-field {
				margin-bottom: 1rem;
			}
			.field-label {
				display: block;
				margin-bottom: 0.5rem;
				font-weight: 500;
			}
			.required {
				color: red;
				margin-left: 0.25rem;
			}
			.text-input {
				width: 100%;
				padding: 0.5rem;
				border: 1px solid #ccc;
				border-radius: 4px;
				font-size: 1rem;
				box-sizing: border-box;
			}
			.text-input:focus {
				outline: none;
				border-color: #007bff;
				box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
			}
			.text-input:disabled {
				background-color: #e9ecef;
				cursor: not-allowed;
			}
			.description {
				display: block;
				color: #666;
				margin-top: 0.5rem;
				font-size: 0.875rem;
			}
			.error-message {
				color: red;
				font-size: 0.875rem;
				margin-top: 0.25rem;
			}
		`,
	],
})
export class ParameterFieldComponent {
	@Input() config: SchemaFieldConfig;

	schemaService = inject(SchemaService);

	addParameter() {
		const key = this.config.controlRef.value;
		if (!key || key.trim() === '') {
			return;
		}
		const schema: JsonSchema = {
			type: 'string',
		};
		this.schemaService.addField(schema, this.config.parent as SchemaFieldGroup, key, true);

		this.config.controlRef.setValue('');
	}
}
