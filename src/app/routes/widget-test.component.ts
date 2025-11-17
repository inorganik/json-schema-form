import { HttpClient } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { FieldContainerComponent } from '../form-components/field-container.component';
import { SchemaFieldGroup } from '../models/form-models';
import { SchemaFormService } from '../services/schema-form.service';

@Component({
	selector: 'app-widget-test',
	imports: [FieldContainerComponent],
	providers: [SchemaFormService],
	template: `
		<app-field-container [config]="groupConfig" />
		<button type="button" (click)="handleFormSubmit()">Submit</button>
		<button type="button" (click)="testPatchValue()">Test patch value</button>
	`,
})
export class WidgetTestComponent implements OnInit {
	groupConfig: SchemaFieldGroup;
	private http = inject(HttpClient);
	private schemaService = inject(SchemaFormService);

	ngOnInit() {
		this.http.get('/widget-schema.json').subscribe(schema => {
			this.groupConfig = this.schemaService.schemaToFieldConfig(schema);
			console.log('schema config', this.groupConfig);
		});
	}

	handleFormSubmit() {
		console.log('valid', this.groupConfig.groupRef.valid);
		console.log('form value', this.groupConfig.groupRef.value);
	}

	testPatchValue() {
		const actionTile = {
			widgetType: 'ACTION_TILE',
			action: {
				productNameTLS: 'idn',
				urlPathSpecifier: 'foo',
			},
			author: 'Account and Identity Management',
			authorities: ['sp:user'],
			datasource: { sourceName: 'MY_ACCESS' },
			description: 'bar',
			enablement: {
				status: 'FLAG_CONTROLLED',
				flags: {
					and: [
						{ ldFeatureFlag: { name: 'flag-1', booleanEquals: true } },
						{ ldFeatureFlag: { name: 'flag-2', booleanEquals: false } },
					],
				},
			},
			icon: 'key',
			productType: 'ISC',
			title: '{total} My Access',
		};
		const standard = {
			componentColumns: [
				{
					componentColumn: {
						components: ['fooName'],
					},
				},
			],
			components: [
				{
					component: {
						action: {
							productNameTLS: 'idn',
							urlPathSpecifier: '/foo/bar',
						},
						componentType: 'TABLE',
						componentUniqueName: 'fooName',
						columns: [
							{ column: { label: 'method1', valueField: 'METHOD2', sortable: true } },
							{ column: { label: 'method2', valueField: 'METHOD3', sortable: true } },
							{ column: { label: 'method3', valueField: 'METHOD4', sortable: true } },
						],
					},
				},
			],
			links: [
				{
					link: {
						action: { productNameTLS: 'idn', urlPathSpecifier: '/ui/search' },
						linkText: 'Create campaign',
					},
				},
			],
		};
		this.schemaService.patchValue(this.groupConfig, standard);
	}
}
