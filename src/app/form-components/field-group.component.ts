import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FieldArray, FieldConfig, FieldGroup, FieldType } from '../models/form-models';
import { FieldArrayComponent } from './field-array.component';
import { FieldComponent } from './field.component';

@Component({
	selector: 'app-field-group',
	imports: [CommonModule, FieldComponent, FieldArrayComponent],
	template: `
		<div class="field-group">
			<fieldset>
				<legend>{{ config.label }}</legend>
				<div class="group-fields">
					@for (field of fieldEntries; track field.key) { @switch (field.fieldConfig.type)
					{ @case (FieldType.Group) {
					<app-field-group [config]="asFieldGroup(field.fieldConfig)" />
					} @case (FieldType.Array) {
					<app-field-array [config]="asFieldArray(field.fieldConfig)" />
					} @default {
					<app-field [config]="asField(field.fieldConfig)" />
					} }}
				</div>
			</fieldset>
		</div>
	`,
	styles: [
		`
			.field-group {
				margin-bottom: 1rem;
			}
			fieldset {
				border: 1px solid #ccc;
				border-radius: 4px;
				padding: 1rem;
			}
			legend {
				font-weight: 600;
				padding: 0 0.5rem;
			}
			.group-fields {
				display: flex;
				flex-direction: column;
				gap: 0.5rem;
			}
		`,
	],
})
export class FieldGroupComponent {
	@Input() config: FieldGroup;

	// Expose FieldType enum to template
	FieldType = FieldType;

	asField(item: FieldConfig | FieldGroup | FieldArray): FieldConfig {
		return item as FieldConfig;
	}

	asFieldGroup(item: FieldConfig | FieldGroup | FieldArray): FieldGroup {
		return item as FieldGroup;
	}

	asFieldArray(item: FieldConfig | FieldGroup | FieldArray): FieldArray {
		return item as FieldArray;
	}

	get fieldEntries() {
		return Object.entries(this.config.fields).map(([key, value]) => ({
			key,
			fieldConfig: value,
		}));
	}

	ngOnInit() {
		// console.log('field-group', this.config);
	}
}
