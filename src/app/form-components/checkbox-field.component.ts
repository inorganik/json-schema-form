import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldConfig } from '../models/form-models';

@Component({
	selector: 'app-checkbox-field',
	imports: [CommonModule, ReactiveFormsModule],
	template: `
		<div class="form-field">
			<label class="checkbox-container">
				<input type="checkbox" [formControl]="config.controlRef" class="checkbox-input" />
				<span class="checkbox-label">
					{{ config.label }}
					<span *ngIf="config.validations?.required" class="required">*</span>
				</span>
			</label>
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
			.checkbox-container {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				cursor: pointer;
			}
			.checkbox-input {
				width: 1.125rem;
				height: 1.125rem;
				cursor: pointer;
			}
			.checkbox-label {
				cursor: pointer;
				font-weight: 500;
			}
			.required {
				color: red;
				margin-left: 0.25rem;
			}
			.description {
				display: block;
				color: #666;
				margin-top: 0.5rem;
				margin-left: 1.625rem;
				font-size: 0.875rem;
			}
			.error-message {
				color: red;
				font-size: 0.875rem;
				margin-top: 0.25rem;
				margin-left: 1.625rem;
			}
		`,
	],
})
export class CheckboxFieldComponent {
	@Input() config: FieldConfig;

	ngOnInit() {
		// console.log('checkbox', this.config);
	}
}
