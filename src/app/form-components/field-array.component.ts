import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FieldArray, FieldConfig, FieldGroup, FieldType } from '../models/form-models';
import { FieldGroupComponent } from './field-group.component';
import { FieldComponent } from './field.component';

@Component({
	selector: 'app-field-array',
	imports: [CommonModule, FieldComponent, FieldGroupComponent],
	template: `
		<div class="app-field-array">
			array group
			<label>{{ config.label }}</label>
			<div class="array-item">
				@for (item of config.items; track $index) { @switch (item.type) { @case
				(FieldType.Group) {
				<app-field-group [config]="asFieldGroup(item)" />
				} @case (FieldType.Array) {
				<app-field-array [config]="asFieldArray(item)" />
				} @default {
				<app-field [config]="asField(item)" />
				} }
				<button type="button" (click)="remove($index)" class="remove-btn">Remove</button>
				}
			</div>
			<button type="button" (click)="add()" class="add-btn">Add</button>
		</div>
	`,
	styles: [
		`
			.array-field {
				margin-bottom: 1rem;
			}
			.array-item {
				display: flex;
				gap: 0.5rem;
				margin-bottom: 0.5rem;
				align-items: center;
			}
			.remove-btn {
				background: #dc3545;
				color: white;
				border: none;
				padding: 0.5rem;
				cursor: pointer;
			}
			.add-btn {
				background: #28a745;
				color: white;
				border: none;
				padding: 0.5rem 1rem;
				cursor: pointer;
			}
		`,
	],
})
export class FieldArrayComponent {
	@Input() config: FieldArray;

	// Expose FieldType enum to template
	FieldType = FieldType;

	ngOnInit() {
		// console.log('array', this.config);
	}

	asField(item: FieldConfig | FieldGroup | FieldArray): FieldConfig {
		return item as FieldConfig;
	}

	asFieldGroup(item: FieldConfig | FieldGroup | FieldArray): FieldGroup {
		return item as FieldGroup;
	}

	asFieldArray(item: FieldConfig | FieldGroup | FieldArray): FieldArray {
		return item as FieldArray;
	}

	add(): void {
		// todo
	}

	remove(index: number): void {
		// todo
	}
}
