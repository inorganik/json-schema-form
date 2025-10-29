import { CommonModule } from '@angular/common';
import { Component, inject, Input } from '@angular/core';
import {
	SchemaFieldArray,
	SchemaFieldConfig,
	SchemaFieldGroup,
	SchemaFieldType,
} from '../models/form-models';
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
					@if (config.description) {
						<small>{{ config.description }}</small>
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
					@if (config.description) {
						<small>{{ config.description }}</small>
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

			fieldset small {
				display: block;
				margin-top: -0.5rem;
				margin-bottom: 0.75rem;
				color: #666;
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
	@Input() config!: SchemaFieldGroup | SchemaFieldArray;

	// Expose FieldType enum to template
	FieldType = SchemaFieldType;

	schemaService = inject(SchemaService);

	ngOnInit() {
		// console.log('field-container', this.config);
	}

	isGroup(config: SchemaFieldGroup | SchemaFieldArray): config is SchemaFieldGroup {
		return config?.type === SchemaFieldType.Group;
	}

	isArray(config: SchemaFieldGroup | SchemaFieldArray): config is SchemaFieldArray {
		return config?.type === SchemaFieldType.Array;
	}
	asField(item: SchemaFieldConfig | SchemaFieldGroup | SchemaFieldArray): SchemaFieldConfig {
		return item as SchemaFieldConfig;
	}

	asFieldGroup(item: SchemaFieldConfig | SchemaFieldGroup | SchemaFieldArray): SchemaFieldGroup {
		return item as SchemaFieldGroup;
	}

	asFieldArray(item: SchemaFieldConfig | SchemaFieldGroup | SchemaFieldArray): SchemaFieldArray {
		return item as SchemaFieldArray;
	}

	asGroupOrArray(
		item: SchemaFieldConfig | SchemaFieldGroup | SchemaFieldArray,
	): SchemaFieldGroup | SchemaFieldArray {
		return item as SchemaFieldGroup | SchemaFieldArray;
	}

	getGroupEntries(config: SchemaFieldGroup | SchemaFieldArray) {
		if (this.isGroup(config)) {
			return Object.entries(config.fields).map(([key, value]) => ({
				key,
				fieldConfig: value,
			}));
		}
		return [];
	}

	getArrayItems(config: SchemaFieldGroup | SchemaFieldArray) {
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
