import { Routes } from '@angular/router';
import { ArrayTestComponent } from './routes/array-test.component';
import { IfThenElseTestComponent } from './routes/if-then-else-test.component';

export const routes: Routes = [
	{
		path: '',
		redirectTo: 'if-then-else',
		pathMatch: 'full',
	},
	{
		path: 'if-then-else',
		component: IfThenElseTestComponent,
	},
	{
		path: 'array',
		component: ArrayTestComponent,
	},
];
