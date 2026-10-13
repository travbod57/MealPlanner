import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { MealPlannerService } from '../../meal-planner.service';

@Component({
  selector: 'app-meal-picker-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './meal-picker-page.component.html',
  styleUrl: './meal-picker-page.component.scss',
})
export class MealPickerPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly mealPlanner = inject(MealPlannerService);

  dayIndex = -1;

  get dayLabel(): string {
    return this.mealPlanner.DAY_LABELS[this.dayIndex] ?? '';
  }

  ngOnInit(): void {
    const dayIndex = Number(this.route.snapshot.paramMap.get('dayIndex'));
    if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= 7) {
      void this.router.navigateByUrl('/plan-next-week');
      return;
    }

    this.dayIndex = dayIndex;
  }

  selectMeal(mealId: string): void {
    this.mealPlanner.draftPlanMealIds[this.dayIndex] = mealId;
    void this.router.navigateByUrl('/plan-next-week');
  }
}
