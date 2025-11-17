import { Routes } from '@angular/router';
import { ArrayTestComponent } from './routes/array-test.component';
import { IfThenElseTestComponent } from './routes/if-then-else-test.component';
import { MutuallyExclusiveTestComponent } from './routes/mutually-exclusive-test.component';
import { WidgetTestComponent } from './routes/widget-test.component';

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
	{
		path: 'mutually-exclusive',
		component: MutuallyExclusiveTestComponent,
	},
	{
		path: 'widget',
		component: WidgetTestComponent,
	},
];
