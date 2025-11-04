import { JsonPipe, KeyValuePipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

@Component({
	selector: 'app-form-error',
	imports: [KeyValuePipe, JsonPipe, ReactiveFormsModule],
	template: `
		@if (controlRef.touched && controlRef.errors) {
			@for (error of controlRef.errors | keyvalue; track $index) {
				@switch (error.key) {
					@case ('required') {
						<span class="error-item">This field is required</span>
					}
					@case ('pattern') {
						<span class="error-item">
							Invalid value for pattern {{ error.value.requiredPattern }}
						</span>
					}
					@case ('minlength') {
						<span class="error-item">
							Must have minimum length of {{ error.value.requiredLength }}
						</span>
					}
					@case ('maxlength') {
						<span class="error-item">
							Cannot exceepd maximum length of {{ error.value.requiredLength }}
						</span>
					}
					@case ('min') {
						<span class="error-item">
							Must have minimum value of {{ error.value.min }}
						</span>
					}
					@case ('max') {
						<span class="error-item">
							Cannot exceed maximum value of {{ error.value.max }}
						</span>
					}
					@default {
						<span class="error-item"
							>Error: {{ error.key }}: {{ error.value | json }}</span
						>
					}
				}
			}
		}
	`,
	styles: [],
})
export class FormErrorComponent {
	@Input() controlRef: FormControl;
}
