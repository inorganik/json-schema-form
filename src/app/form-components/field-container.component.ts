import { CommonModule } from '@angular/common';
import { Component, inject, Input } from '@angular/core';
import { FieldArray, FieldConfig, FieldGroup, FieldType } from '../models/form-models';
import { SchemaService } from '../services/schema.service';
import { FieldComponent } from './field.component';

@Component({
	selector: 'app-field-container',
	imports: [CommonModule, FieldComponent],
	template: `
		@if (isGroup(config)) {
			<!-- Field Group -->
			<div class="field-group">
				<fieldset>
					@if (config.label) {
						<legend>{{ config.label }}</legend>
					}
					<div class="group-fields">
						@for (field of getGroupEntries(config); track field.key) {
							@switch (field.fieldConfig.type) {
								@case (FieldType.Group) {
									<app-field-container
										[config]="asGroupOrArray(field.fieldConfig)"
									/>
								}
								@case (FieldType.Array) {
									<app-field-container
										[config]="asGroupOrArray(field.fieldConfig)"
									/>
								}
								@default {
									<app-field [config]="asField(field.fieldConfig)" />
								}
							}
						}
					</div>
				</fieldset>
			</div>
		} @else if (isArray(config)) {
			<!-- Field Array -->
			<div class="field-array">
				<fieldset>
					@if (config.label) {
						<legend>{{ config.label }}</legend>
					}
					<div class="array-items">
						@for (item of getArrayItems(config); track $index) {
							<div class="array-item">
								@switch (item.type) {
									@case (FieldType.Group) {
										<app-field-container [config]="asGroupOrArray(item)" />
									}
									@case (FieldType.Array) {
										<app-field-container [config]="asGroupOrArray(item)" />
									}
									@default {
										<app-field [config]="asField(item)" />
									}
								}
								<button type="button" (click)="remove($index)" class="remove-btn">
									Remove
								</button>
							</div>
						}
					</div>
					<button type="button" (click)="add()" class="add-btn">Add</button>
				</fieldset>
			</div>
		}
	`,
	styles: [
		`
			.field-group {
				margin-bottom: 1rem;
			}

			.group-fields {
				display: flex;
				flex-direction: column;
				gap: 0.5rem;
			}

			.field-array {
				margin-bottom: 1rem;
			}

			.array-items {
				display: flex;
				flex-direction: column;
				gap: 0.5rem;
			}

			.array-item {
				display: flex;
				gap: 0.5rem;
				margin-bottom: 0.5rem;
				align-items: flex-start;
			}

			.array-item > *:first-child {
				flex: 1;
			}

			.remove-btn {
				background: #dc3545;
				color: white;
				border: none;
				padding: 0.5rem;
				cursor: pointer;
				flex-shrink: 0;
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
export class FieldContainerComponent {
	@Input() config!: FieldGroup | FieldArray;

	// Expose FieldType enum to template
	FieldType = FieldType;

	schemaService = inject(SchemaService);

	ngOnInit() {
		// console.log('field-container', this.config);
	}

	isGroup(config: FieldGroup | FieldArray): config is FieldGroup {
		return config?.type === FieldType.Group;
	}

	isArray(config: FieldGroup | FieldArray): config is FieldArray {
		return config?.type === FieldType.Array;
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

	asGroupOrArray(item: FieldConfig | FieldGroup | FieldArray): FieldGroup | FieldArray {
		return item as FieldGroup | FieldArray;
	}

	getGroupEntries(config: FieldGroup | FieldArray) {
		if (this.isGroup(config)) {
			return Object.entries(config.fields).map(([key, value]) => ({
				key,
				fieldConfig: value,
			}));
		}
		return [];
	}

	getArrayItems(config: FieldGroup | FieldArray) {
		if (this.isArray(config)) {
			return config.items;
		}
		return [];
	}

	add(): void {
		if (this.isArray(this.config)) {
			this.schemaService.addArrayItem(this.config);
		}
	}

	remove(index: number): void {
		if (this.isArray(this.config)) {
			this.schemaService.removeArrayItem(this.config, index);
		}
	}
}
