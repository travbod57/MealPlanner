import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MealPlannerService } from '../../meal-planner.service';

@Component({
  selector: 'app-weekly-plan-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './weekly-plan-page.component.html',
  styleUrl: './weekly-plan-page.component.scss',
})
export class WeeklyPlanPageComponent {
  readonly mealPlanner = inject(MealPlannerService);

  randomizePlan(): void {
    this.mealPlanner.randomizePlan();
  }

  clearDraftPlan(): void {
    this.mealPlanner.clearDraftPlan();
  }

  clearMealChoice(dayIndex: number): void {
    this.mealPlanner.clearDraftPlanMeal(dayIndex);
  }

  getMealNameById(mealId: string | null): string {
    return this.mealPlanner.getMealNameById(mealId);
  }

  getDayDate(index: number): Date {
    return this.mealPlanner.getWeekDayDate(1, index);
  }
}
