import { HttpClient } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';

@Component({
	selector: 'app-enablement',
	imports: [],
	templateUrl: './enablement.component.html',
	styleUrl: './enablement.component.scss',
})
export class EnablementComponent implements OnInit {
	private http = inject(HttpClient);
	schema: any;

	ngOnInit() {
		this.http.get('/enablement-schema.json').subscribe(schema => {
			this.schema = schema;
			console.log('Schema loaded:', schema);
		});
	}
}
