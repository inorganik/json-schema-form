import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FieldConfig, FieldType } from '../models/form-models';
import { CheckboxFieldComponent } from './checkbox-field.component';
import { RadioFieldComponent } from './radio-field.component';
import { SelectFieldComponent } from './select-field.component';
import { TextInputFieldComponent } from './text-input-field.component';

@Component({
	selector: 'app-field',
	imports: [
		CommonModule,
		CheckboxFieldComponent,
		TextInputFieldComponent,
		SelectFieldComponent,
		RadioFieldComponent,
	],
	template: `
		@switch (config.type) { @case (FieldType.Select) {
		<app-select-field [config]="config" />
		} @case (FieldType.Radio) {
		<app-radio-field [config]="config" />
		} @case (FieldType.Text) {
		<app-text-input-field [config]="config" />
		} @case (FieldType.Number) {
		<app-text-input-field [config]="config" />
		} @case (FieldType.Checkbox) {
		<app-checkbox-field [config]="config" />
		} }
	`,
	styles: [],
})
export class FieldComponent {
	@Input() config: FieldConfig;

	// Expose FieldType enum to template
	FieldType = FieldType;

	ngOnInit() {
		// console.log('field', this.config);
	}
}
