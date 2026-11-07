import { Routes } from '@angular/router';

import { MealFormPageComponent } from './pages/meal-form-page/meal-form-page.component';
import { MealDetailPageComponent } from './pages/meal-detail-page/meal-detail-page.component';
import { MealLibraryPageComponent } from './pages/meal-library-page/meal-library-page.component';
import { MealPickerPageComponent } from './pages/meal-picker-page/meal-picker-page.component';
import { SettingsPageComponent } from './pages/settings-page/settings-page.component';
import { ThisWeekPageComponent } from './pages/this-week-page/this-week-page.component';
import { WeeklyPlanPageComponent } from './pages/weekly-plan-page/weekly-plan-page.component';

export const routes: Routes = [
  { path: '', redirectTo: 'this-week', pathMatch: 'full' },
  { path: 'this-week', component: ThisWeekPageComponent, title: 'This Week | whats4dinnerDF' },
  { path: 'plan-next-week', component: WeeklyPlanPageComponent, title: 'Plan Next Week | whats4dinnerDF' },
  { path: 'settings', component: SettingsPageComponent, title: 'Settings | whats4dinnerDF' },
  {
    path: 'plan-next-week/:dayIndex/choose',
    component: MealPickerPageComponent,
    title: 'Choose a Meal | whats4dinnerDF',
  },
  { path: 'meals', component: MealLibraryPageComponent, title: 'Saved Meals | whats4dinnerDF' },
  { path: 'meals/new', component: MealFormPageComponent, title: 'Add a Meal | whats4dinnerDF' },
  { path: 'meals/:id/edit', component: MealFormPageComponent, title: 'Edit Meal | whats4dinnerDF' },
  { path: 'meals/:id', component: MealDetailPageComponent, title: 'Meal Details | whats4dinnerDF' },
  { path: '**', redirectTo: 'this-week' },
];
