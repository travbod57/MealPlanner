import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { Meal, MealPlannerService } from '../../meal-planner.service';

@Component({
  selector: 'app-meal-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './meal-detail-page.component.html',
  styleUrl: './meal-detail-page.component.scss',
})
export class MealDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly mealPlanner = inject(MealPlannerService);

  meal: Meal | null = null;
  dayIndex: number | null = null;

  get dayLabel(): string {
    return this.dayIndex === null
      ? ''
      : this.mealPlanner.DAY_LABELS[this.dayIndex];
  }

  ngOnInit(): void {
    const dayIndex = this.route.snapshot.queryParamMap.get('dayIndex');
    if (dayIndex !== null) {
      const parsedDayIndex = Number(dayIndex);
      if (
        Number.isInteger(parsedDayIndex) &&
        parsedDayIndex >= 0 &&
        parsedDayIndex < this.mealPlanner.DAY_LABELS.length
      ) {
        this.dayIndex = parsedDayIndex;
      }
    }

    const mealId = this.route.snapshot.paramMap.get('id');
    this.meal =
      this.mealPlanner.meals.find((entry) => entry.id === mealId) ?? null;

    if (!this.meal) {
      void this.router.navigateByUrl('/meals');
    }
  }
}
