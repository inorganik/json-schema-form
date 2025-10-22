import { HttpClient } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { FieldGroupComponent } from '../form-components/field-group.component';
import { FieldGroup } from '../models/form-models';
import { SchemaService } from '../services/schema.service';

@Component({
	selector: 'app-enablement',
	imports: [FieldGroupComponent],
	templateUrl: './enablement.component.html',
	styleUrl: './enablement.component.scss',
})
export class EnablementComponent implements OnInit {
	groupConfig: FieldGroup;
	private http = inject(HttpClient);
	private schemaService = inject(SchemaService);

	ngOnInit() {
		this.http.get('/enablement-schema.json').subscribe(schema => {
			this.groupConfig = this.schemaService.schemaToFieldConfig(schema);
			console.log('group config', this.groupConfig);
		});
	}
}
