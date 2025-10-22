import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldConfig } from '../models/form-models';

@Component({
	selector: 'app-text-input-field',
	imports: [CommonModule, ReactiveFormsModule],
	template: `
		<div class="form-field">
			<label class="field-label">
				{{ config.label }}
				<span *ngIf="config.validations?.required" class="required">*</span>
			</label>
			<input [type]="config.type" [formControl]="config.controlRef" class="text-input" />
			<small *ngIf="config.description" class="description">
				{{ config.description }}
			</small>
			<div
				*ngIf="config.controlRef.touched && config.controlRef.errors"
				class="error-message"
			>
				<span *ngFor="let error of config.controlRef.errors | keyvalue">
					{{ error.key }}: {{ error.value }}
				</span>
			</div>
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
export class TextInputFieldComponent {
	@Input() config: FieldConfig;

	ngOnInit() {
		// console.log('text-input', this.config);
	}
}
