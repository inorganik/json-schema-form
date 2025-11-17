import { HttpClient } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { FieldContainerComponent } from '../form-components/field-container.component';
import { SchemaFieldGroup } from '../models/form-models';
import { SchemaFormService } from '../services/schema-form.service';

@Component({
	selector: 'app-mutually-exclusive-test',
	imports: [FieldContainerComponent],
	providers: [SchemaFormService],
	template: `
		<app-field-container [config]="groupConfig" />
		<button type="button" (click)="handleFormSubmit()">Submit</button>
	`,
})
export class MutuallyExclusiveTestComponent implements OnInit {
	groupConfig: SchemaFieldGroup;
	private http = inject(HttpClient);
	private schemaService = inject(SchemaFormService);

	ngOnInit() {
		this.http.get('/mutually-exclusive.json').subscribe(schema => {
			this.groupConfig = this.schemaService.schemaToFieldConfig({
				properties: {
					mainCourse: {
						title: 'Main Course',
						type: 'string',
					},
					soup: {
						title: 'Soup',
						type: 'string',
					},
					salad: {
						title: 'Salad',
						type: 'string',
					},
				},
				not: {
					required: ['soup', 'salad'],
				},
			});
			console.log('schema config', this.groupConfig);
		});
	}

	handleFormSubmit() {
		console.log('valid', this.groupConfig.groupRef.valid);
		const value = this.schemaService.getValue(this.groupConfig);
		console.log('form value', value);
	}
}
