import { Routes } from '@angular/router';
import { EnablementComponent } from './enablement/enablement.component';

export const routes: Routes = [
	{
		path: '',
		redirectTo: 'enablement',
		pathMatch: 'full',
	},
	{
		path: 'enablement',
		component: EnablementComponent,
	},
];
