import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { MealPlannerService } from '../../meal-planner.service';

@Component({
  selector: 'app-weekly-plan-page',
  standalone: true,
  imports: [CommonModule, RouterLink, MatSnackBarModule],
  templateUrl: './weekly-plan-page.component.html',
  styleUrl: './weekly-plan-page.component.scss',
})
export class WeeklyPlanPageComponent {
  readonly mealPlanner = inject(MealPlannerService);
  private readonly snackBar = inject(MatSnackBar);

  randomizePlan(): void {
    this.mealPlanner.randomizePlan();
    if (this.mealPlanner.draftPlanMealIds.some((mealId) => !mealId)) {
      this.snackBar.open(
        'The vegetarian maximum leaves days open. Add non-vegetarian meals or raise the maximum.',
        'Dismiss',
        { duration: 5000, verticalPosition: 'bottom' },
      );
    }
  }

  lockPlan(): void {
    if (!this.mealPlanner.lockPlan()) {
      const message = this.mealPlanner.draftPlanMealIds.some(
        (mealId) => !mealId,
      )
        ? 'Choose a meal for every day before locking the plan.'
        : `Choose no more than ${this.mealPlanner.maxVegetarianMeals} vegetarian meals.`;
      this.snackBar.open(message, 'Dismiss', {
        duration: 4000,
        verticalPosition: 'bottom',
      });
    }
  }

  clearDraftPlan(): void {
    this.mealPlanner.clearDraftPlan();
  }

  getMealNameById(mealId: string | null): string {
    return this.mealPlanner.getMealNameById(mealId);
  }

  getDayDate(index: number): Date {
    return this.mealPlanner.getWeekDayDate(1, index);
  }
}
