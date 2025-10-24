import { Component } from '@angular/core';
import { RouterModule, RouterOutlet } from '@angular/router';

@Component({
	selector: 'app-root',
	imports: [RouterOutlet, RouterModule],
	templateUrl: './app.component.html',
	styleUrl: './app.component.scss',
})
export class AppComponent {
	items = [
		{ title: 'If/then test', link: 'if-then-else' },
		{ title: 'Array test', link: 'array' },
	];
}
