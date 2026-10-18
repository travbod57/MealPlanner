import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragEnter,
  CdkDragExit,
  CdkDropList,
} from '@angular/cdk/drag-drop';
import { RouterLink } from '@angular/router';

import { MealPlannerService } from '../../meal-planner.service';

@Component({
  selector: 'app-weekly-plan-page',
  standalone: true,
  imports: [CommonModule, RouterLink, CdkDropList, CdkDrag],
  templateUrl: './weekly-plan-page.component.html',
  styleUrl: './weekly-plan-page.component.scss',
})
export class WeeklyPlanPageComponent {
  readonly mealPlanner = inject(MealPlannerService);
  readonly dayDropListIds = Array.from(
    { length: 7 },
    (_, index) => `plan-day-${index}`,
  );
  isDraggingMeal = false;
  activeDropIndex: number | null = null;

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

  onMealDragStarted(): void {
    this.isDraggingMeal = true;
    this.activeDropIndex = null;
  }

  onMealDragEnded(): void {
    this.isDraggingMeal = false;
    this.activeDropIndex = null;
  }

  onDayDragEntered(event: CdkDragEnter<number, number>): void {
    this.activeDropIndex = event.container.data;
  }

  onDayDragExited(event: CdkDragExit<number, number>): void {
    if (this.activeDropIndex === event.container.data) {
      this.activeDropIndex = null;
    }
  }

  dropMeal(event: CdkDragDrop<number, number, string | null>): void {
    this.mealPlanner.reorderDraftPlan(
      event.previousContainer.data,
      event.container.data,
    );
    this.activeDropIndex = null;
  }
}
