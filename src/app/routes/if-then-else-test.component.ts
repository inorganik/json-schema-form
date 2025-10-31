import { HttpClient } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { FieldContainerComponent } from '../form-components/field-container.component';
import { SchemaFieldGroup } from '../models/form-models';
import { SchemaService } from '../services/schema.service';

@Component({
	selector: 'app-if-then-else-test',
	imports: [FieldContainerComponent],
	providers: [SchemaService],
	template: `
		<app-field-container [config]="groupConfig" />
		<button type="button" (click)="handleFormSubmit()">Submit</button>
	`,
})
export class IfThenElseTestComponent implements OnInit {
	groupConfig: SchemaFieldGroup;
	private http = inject(HttpClient);
	private schemaService = inject(SchemaService);

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
}
