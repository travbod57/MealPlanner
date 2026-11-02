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
  selector: 'app-this-week-page',
  standalone: true,
  imports: [CommonModule, RouterLink, CdkDropList, CdkDrag],
  templateUrl: './this-week-page.component.html',
  styleUrl: './this-week-page.component.scss',
})
export class ThisWeekPageComponent {
  readonly mealPlanner = inject(MealPlannerService);
  readonly dayDropListIds = Array.from(
    { length: 7 },
    (_, index) => `this-week-day-${index}`,
  );
  isDraggingMeal = false;
  activeDropIndex: number | null = null;

  getMealIdForDay(index: number): string | null {
    return this.mealPlanner.thisWeekPlan?.mealIds[index] ?? null;
  }

  getDayDate(index: number): Date {
    return this.mealPlanner.getWeekDayDate(0, index);
  }

  isToday(index: number): boolean {
    return this.getDayDate(index).toDateString() === new Date().toDateString();
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
    this.mealPlanner.reorderThisWeekPlan(
      event.previousContainer.data,
      event.container.data,
    );
    this.activeDropIndex = null;
  }
}
