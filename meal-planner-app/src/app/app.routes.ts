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
  { path: 'this-week', component: ThisWeekPageComponent },
  { path: 'plan-next-week', component: WeeklyPlanPageComponent },
  { path: 'settings', component: SettingsPageComponent },
  {
    path: 'plan-next-week/:dayIndex/choose',
    component: MealPickerPageComponent,
  },
  { path: 'meals', component: MealLibraryPageComponent },
  { path: 'meals/new', component: MealFormPageComponent },
  { path: 'meals/:id/edit', component: MealFormPageComponent },
  { path: 'meals/:id', component: MealDetailPageComponent },
  { path: '**', redirectTo: 'this-week' },
];
