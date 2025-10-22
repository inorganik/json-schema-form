import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldConfig } from '../models/form-models';

@Component({
	selector: 'app-radio-field',
	imports: [CommonModule, ReactiveFormsModule],
	template: `
		<div class="form-field">
			<label class="field-label">
				{{ config.label }}
				<span *ngIf="config.validations?.required" class="required">*</span>
			</label>
			<div class="radio-group">
				@for (option of config.options; track $index) {
				<label class="radio-option">
					<input
						type="radio"
						[name]="config.key.toString()"
						[value]="option.value"
						[formControl]="config.controlRef"
					/>
					<span class="radio-label">{{ option.label }}</span>
				</label>
				}
			</div>
			<small *ngIf="config.description" class="description">
				{{ config.description }}
			</small>
			<div *ngIf="config.controlRef.errors" class="error-message">
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
			.radio-group {
				display: flex;
				flex-direction: column;
				gap: 0.5rem;
			}
			.radio-option {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				cursor: pointer;
			}
			.radio-option input[type='radio'] {
				cursor: pointer;
			}
			.radio-label {
				cursor: pointer;
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
export class RadioFieldComponent {
	@Input() config: FieldConfig;

	ngOnInit() {
		// console.log('radio', this.config);
	}
}
