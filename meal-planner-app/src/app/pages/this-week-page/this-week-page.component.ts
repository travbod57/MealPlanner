import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MealPlannerService } from '../../meal-planner.service';

@Component({
  selector: 'app-this-week-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './this-week-page.component.html',
  styleUrl: './this-week-page.component.scss',
})
export class ThisWeekPageComponent {
  readonly mealPlanner = inject(MealPlannerService);

  getMealIdForDay(index: number): string | null {
    return this.mealPlanner.thisWeekPlan?.mealIds[index] ?? null;
  }

  getDayDate(index: number): Date {
    return this.mealPlanner.getWeekDayDate(0, index);
  }

  isToday(index: number): boolean {
    return this.getDayDate(index).toDateString() === new Date().toDateString();
  }
}
