import { TestBed } from '@angular/core/testing';

import { SchemaFormService } from './schema-form.service';

describe('SchemaFormService', () => {
	let service: SchemaFormService;

	beforeEach(() => {
		TestBed.configureTestingModule({});
		service = TestBed.inject(SchemaFormService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});
});
