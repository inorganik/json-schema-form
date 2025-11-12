import { HttpClient } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { FieldContainerComponent } from '../form-components/field-container.component';
import { SchemaFieldGroup } from '../models/form-models';
import { SchemaFormService } from '../services/schema-form.service';

@Component({
	selector: 'app-if-then-else-test',
	imports: [FieldContainerComponent],
	providers: [SchemaFormService],
	template: `
		<app-field-container [config]="groupConfig" />
		<button type="button" (click)="handleFormSubmit()">Submit</button>
		<button type="button" (click)="testPatchValue()">Test patch value</button>
	`,
})
export class IfThenElseTestComponent implements OnInit {
	groupConfig: SchemaFieldGroup;
	private http = inject(HttpClient);
	private schemaService = inject(SchemaFormService);

	ngOnInit() {
		this.http.get('/if-then-else-schema.json').subscribe(schema => {
			this.groupConfig = this.schemaService.schemaToFieldConfig(schema);
			console.log('schema config', this.groupConfig);
		});
	}

	handleFormSubmit() {
		console.log('valid', this.groupConfig.groupRef.valid);
		console.log('form value', this.groupConfig.groupRef.value);
	}

	testPatchValue() {
		const value = {
			status: 'FLAG_CONTROLLED',
			flags: {
				and: [
					{
						ldFeatureFlag: {
							name: 'ld-flag-2',
							booleanEquals: true,
						},
					},
					{
						or: [{ productFlag: 'prod-1' }, { productFlag: 'prod-2' }],
					},
				],
			},
			title: 'foo',
			cost: 10,
			params: {
				foo: 'bar',
				baz: 'qux',
			},
		};
		this.schemaService.patchValue(this.groupConfig, value);
	}
}
