import { Component, Input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { SchemaFieldConfig } from '../models/form-models';

@Component({
	selector: 'app-toggle-field',
	imports: [ReactiveFormsModule],
	template: `
		<label class="toggle-switch">
			<input type="checkbox" [formControl]="config.controlRef" [name]="config.uniqueKey" />
			<span class="toggle-slider"></span>
			<span class="toggle-label">
				{{ config.controlRef.value ? 'On' : 'Off' }}
				@if (config.validations?.required) {
					<span class="required">*</span>
				}
			</span>
		</label>
		@if (config.description) {
			<small class="description">
				{{ config.description }}
			</small>
		}
	`,
	styles: [
		`
			:host {
				display: block;
			}

			.toggle-switch {
				display: inline-flex;
				align-items: center;
				cursor: pointer;
				user-select: none;
			}

			.toggle-switch input[type='checkbox'] {
				opacity: 0;
				width: 0;
				height: 0;
				position: absolute;
			}

			.toggle-slider {
				position: relative;
				width: 44px;
				height: 24px;
				background: #ccc;
				border-radius: 12px;
				transition: background 0.2s;
				box-sizing: border-box;
			}

			.toggle-slider::before {
				content: '';
				position: absolute;
				left: 2px;
				top: 2px;
				width: 20px;
				height: 20px;
				background: #fff;
				border-radius: 50%;
				transition:
					transform 0.2s,
					background 0.2s;
			}

			input[type='checkbox']:checked + .toggle-slider {
				background: #009327;
			}

			input[type='checkbox']:checked + .toggle-slider::before {
				transform: translateX(20px);
				background: #fff;
			}

			.toggle-label {
				margin-left: 12px;
				font-size: 1rem;
				color: #222;
			}

			.required {
				background: #dc3545;
				margin-left: 2px;
			}
		`,
	],
})
export class ToggleFieldComponent {
	@Input() config: SchemaFieldConfig;

	ngOnInit() {
		// console.log('toggle', this.config);
	}
}
