import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { animate, style, transition, trigger } from '@angular/animations';
import { MatIconModule } from '@angular/material/icon';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

import { Meal, MealPlannerService, MealType } from '../../meal-planner.service';

@Component({
  selector: 'app-confirm-meal-delete-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>Delete meal?</h2>
    <mat-dialog-content>
      <strong>{{ data.mealName }}</strong> will be removed from your meal
      library.
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false">Cancel</button>
      <button mat-flat-button color="warn" [mat-dialog-close]="true">
        Delete meal
      </button>
    </mat-dialog-actions>
  `,
})
class ConfirmMealDeleteDialogComponent {
  readonly data = inject(MAT_DIALOG_DATA) as { mealName: string };
}

@Component({
  selector: 'app-meal-library-page',
  standalone: true,
  imports: [CommonModule, RouterLink, MatDialogModule, MatIconModule],
  animations: [
    trigger('slidePanel', [
      transition(':enter', [
        style({
          height: 0,
          opacity: 0,
          transform: 'translateY(-8px)',
          overflow: 'hidden',
        }),
        animate(
          '220ms ease-out',
          style({ height: '*', opacity: 1, transform: 'translateY(0)' }),
        ),
      ]),
      transition(':leave', [
        style({ overflow: 'hidden' }),
        animate(
          '180ms ease-in',
          style({ height: 0, opacity: 0, transform: 'translateY(-8px)' }),
        ),
      ]),
    ]),
  ],
  templateUrl: './meal-library-page.component.html',
  styleUrl: './meal-library-page.component.scss',
})
export class MealLibraryPageComponent {
  readonly mealPlanner = inject(MealPlannerService);
  private readonly dialog = inject(MatDialog);
  private expandedMealIds = new Set<string>();

  isDetailsExpanded(mealId: string): boolean {
    return this.expandedMealIds.has(mealId);
  }

  toggleDetails(mealId: string): void {
    const expandedMealIds = new Set(this.expandedMealIds);
    if (expandedMealIds.has(mealId)) {
      expandedMealIds.delete(mealId);
    } else {
      expandedMealIds.add(mealId);
    }
    this.expandedMealIds = expandedMealIds;
  }

  getMealTypeLabel(type: MealType): string {
    return this.mealPlanner.getMealTypeLabel(type);
  }

  getStarDisplay(value: number): string {
    return this.mealPlanner.getStarDisplay(value);
  }

  getMealNameById(mealId: string | null): string {
    return this.mealPlanner.getMealNameById(mealId);
  }

  deleteMeal(meal: Meal): void {
    this.dialog
      .open(ConfirmMealDeleteDialogComponent, {
        data: { mealName: meal.customTitle || meal.name },
        width: 'min(420px, calc(100vw - 32px))',
      })
      .afterClosed()
      .subscribe((confirmed: boolean | undefined) => {
        if (confirmed) {
          this.mealPlanner.deleteMeal(meal.id);
        }
      });
  }
}
