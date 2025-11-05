import { CommonModule } from '@angular/common';
import { Component, inject, Input } from '@angular/core';
import {
	SchemaFieldArray,
	SchemaFieldConfig,
	SchemaFieldGroup,
	SchemaFieldType,
} from '../models/form-models';
import { SchemaFormService } from '../services/schema-form.service';
import { FieldComponent } from './field.component';

@Component({
	selector: 'app-field-container',
	imports: [CommonModule, FieldComponent],
	template: `
		@if (isGroup(config)) {
			<!-- Field Group -->
			@if (config.debug) {
				<code>group: {{ config.uniqueKey }}</code>
			}
			<div class="field-group">
				@if (config.renderFieldset) {
					<fieldset>
						@if (config.label) {
							<legend>{{ config.label }}</legend>
						}
						@if (config.description) {
							<small>{{ config.description }}</small>
						}
						<div class="group-fields">
							@for (field of getGroupEntries(config); track field.key) {
								@if (field.rule === 'above') {
									<hr />
								}
								@switch (field.type) {
									@case (FieldType.Group) {
										<app-field-container [config]="asGroupOrArray(field)" />
									}
									@case (FieldType.Array) {
										<app-field-container [config]="asGroupOrArray(field)" />
									}
									@default {
										<app-field [config]="asField(field)" />
									}
								}
								@if (field.rule === 'below') {
									<hr />
								}
							}
						</div>
					</fieldset>
				} @else {
					<div class="group-fields">
						@for (field of getGroupEntries(config); track field.key) {
							@if (field.rule === 'above') {
								<hr />
							}
							@switch (field.type) {
								@case (FieldType.Group) {
									<app-field-container [config]="asGroupOrArray(field)" />
								}
								@case (FieldType.Array) {
									<app-field-container [config]="asGroupOrArray(field)" />
								}
								@default {
									<app-field [config]="asField(field)" />
								}
							}
							@if (field.rule === 'below') {
								<hr />
							}
						}
					</div>
				}
			</div>
		} @else if (isArray(config)) {
			<!-- Field Array -->
			@if (config.debug) {
				<code>array: {{ config.uniqueKey }}</code>
			}
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
								@if (item.type === FieldType.Group) {
									<div class="item-number">{{ $index + 1 }}</div>
								}
								<div class="item-content">
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
								</div>
								<button
									type="button"
									(click)="remove($index)"
									title="Remove"
									[disabled]="!config.canRemoveItem()"
									class="add-remove-btn"
								>
									&minus;
								</button>
							</div>
						}
					</div>
					<button
						type="button"
						(click)="add()"
						title="Add"
						[disabled]="!config.canAddItem()"
						class="add-remove-btn"
					>
						+
					</button>
				</fieldset>
			</div>
		}
	`,
	styles: [
		`
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

			.array-item + .array-item {
				border-top: 1px #ccc solid;
				padding-top: 1rem;
			}

			.item-number {
				display: flex;
				align-items: center;
				justify-content: center;
				min-width: 2rem;
				height: 2rem;
				background: #e9ecef;
				border-radius: 50%;
				font-weight: bold;
				flex-shrink: 0;
			}

			.item-content {
				flex: 1;
			}

			.add-remove-btn {
				background: #fff;
				border: 1px #666 solid;
				width: 2rem;
				height: 2rem;
				border-radius: 50%;
				font-size: 1.5rem;
				line-height: 1;
				text-align: center;
				padding: 0;
				cursor: pointer;
				display: flex;
				align-items: center;
				justify-content: center;

				&[disabled] {
					border: 1px #ccc solid;
				}
			}
		`,
	],
})
export class FieldContainerComponent {
	@Input() config!: SchemaFieldGroup | SchemaFieldArray;

	// Expose FieldType enum to template
	FieldType = SchemaFieldType;

	schemaService = inject(SchemaFormService);

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
			return Object.values(config.fields).sort((a, b) =>
				a.uniqueKey.localeCompare(b.uniqueKey),
			);
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
