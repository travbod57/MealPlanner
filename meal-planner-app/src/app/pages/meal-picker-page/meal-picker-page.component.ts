import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { Meal, MealPlannerService } from '../../meal-planner.service';

type MealSortOrder =
  | 'name-asc'
  | 'name-desc'
  | 'rating-asc'
  | 'rating-desc'
  | 'times-used-asc'
  | 'times-used-desc';

@Component({
  selector: 'app-meal-picker-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './meal-picker-page.component.html',
  styleUrl: './meal-picker-page.component.scss',
})
export class MealPickerPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly mealPlanner = inject(MealPlannerService);

  dayIndex = -1;
  searchTerm = '';
  sortOrder: MealSortOrder = 'name-asc';
  isThisWeek = false;

  get filteredMeals(): Meal[] {
    const query = this.searchTerm.trim().toLocaleLowerCase();
    return this.mealPlanner.meals
      .filter(
        (meal) =>
          !query ||
          (meal.customTitle || meal.name)
            .toLocaleLowerCase()
            .includes(query),
      )
      .sort((a, b) => {
        const direction = this.sortOrder.endsWith('asc') ? 1 : -1;
        if (this.sortOrder.startsWith('rating')) {
          return direction * (a.starRating - b.starRating);
        }
        if (this.sortOrder.startsWith('times-used')) {
          return direction * (a.timesUsed - b.timesUsed);
        }
        return (
          direction *
          (a.customTitle || a.name).localeCompare(b.customTitle || b.name)
        );
      });
  }

  get dayLabel(): string {
    return this.mealPlanner.DAY_LABELS[this.dayIndex] ?? '';
  }

  get planUrl(): string {
    return this.isThisWeek ? '/this-week' : '/plan-next-week';
  }

  ngOnInit(): void {
    this.isThisWeek = this.route.snapshot.data['planType'] === 'this-week';
    const dayIndex = Number(this.route.snapshot.paramMap.get('dayIndex'));
    if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= 7) {
      void this.router.navigateByUrl(this.planUrl);
      return;
    }

    this.dayIndex = dayIndex;
  }

  selectMeal(mealId: string): void {
    if (this.isThisWeek) {
      this.mealPlanner.setThisWeekPlanMeal(this.dayIndex, mealId);
    } else {
      this.mealPlanner.setDraftPlanMeal(this.dayIndex, mealId);
    }
    void this.router.navigateByUrl(this.planUrl);
  }
}
