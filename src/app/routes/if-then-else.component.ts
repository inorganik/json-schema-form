import { HttpClient } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { FieldGroupComponent } from '../form-components/field-group.component';
import { FieldGroup } from '../models/form-models';
import { SchemaService } from '../services/schema.service';

@Component({
	selector: 'app-if-then-else',
	imports: [FieldGroupComponent],
	template: `
		<app-field-group [config]="groupConfig" />
		<button type="button" (click)="handleFormSubmit()">Submit</button>
	`,
})
export class IfThenElseComponent implements OnInit {
	groupConfig: FieldGroup;
	private http = inject(HttpClient);
	private schemaService = inject(SchemaService);

	ngOnInit() {
		this.http.get('/if-then-else-schema.json').subscribe(schema => {
			this.groupConfig = this.schemaService.schemaToFieldConfig(schema);
			console.log('group config', this.groupConfig);
		});
	}

	handleFormSubmit() {
		console.log('valid', this.groupConfig.groupRef.valid);
		console.log('form value', this.groupConfig.groupRef.value);
	}
}
