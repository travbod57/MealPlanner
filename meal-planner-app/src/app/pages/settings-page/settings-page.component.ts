import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { MealPlannerService } from '../../meal-planner.service';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSnackBarModule,
  ],
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.scss',
})
export class SettingsPageComponent {
  readonly mealPlanner = inject(MealPlannerService);
  private readonly snackBar = inject(MatSnackBar);

  selectedWeekStartDay = this.mealPlanner.weekStartDay;
  selectedMaxVegetarianMeals = this.mealPlanner.maxVegetarianMeals;

  saveSettings(): void {
    this.mealPlanner.setWeekStartDay(this.selectedWeekStartDay);
    this.mealPlanner.setMaxVegetarianMeals(this.selectedMaxVegetarianMeals);
    this.snackBar.open('Settings saved.', 'Dismiss', {
      duration: 2500,
      verticalPosition: 'bottom',
    });
  }
}
