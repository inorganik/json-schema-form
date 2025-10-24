import { Routes } from '@angular/router';
import { ArrayComponent } from './routes/array.component';
import { IfThenElseComponent } from './routes/if-then-else.component';

export const routes: Routes = [
	{
		path: '',
		redirectTo: 'if-then-else',
		pathMatch: 'full',
	},
	{
		path: 'if-then-else',
		component: IfThenElseComponent,
	},
	{
		path: 'array',
		component: ArrayComponent,
	},
];
