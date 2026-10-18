import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { MealFormState, MealPlannerService } from '../../meal-planner.service';

@Component({
  selector: 'app-meal-form-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './meal-form-page.component.html',
  styleUrl: './meal-form-page.component.scss',
})
export class MealFormPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly mealPlanner = inject(MealPlannerService);

  editingMealId: string | null = null;
  mealForm: MealFormState = this.createEmptyForm();
  submitted = false;

  get isEditing(): boolean {
    return this.editingMealId !== null;
  }

  ngOnInit(): void {
    const mealId = this.route.snapshot.paramMap.get('id');
    if (!mealId) {
      return;
    }

    const meal = this.mealPlanner.meals.find((entry) => entry.id === mealId);
    if (!meal) {
      void this.router.navigateByUrl('/meals');
      return;
    }

    this.editingMealId = mealId;
    this.mealForm = this.mealPlanner.editMeal(meal);
  }

  onSubmitMeal(): void {
    this.submitted = true;
    if (
      !this.mealForm.name.trim() ||
      !this.mealForm.category.trim() ||
      this.mealForm.vegetarian === null ||
      (this.mealForm.mealType === 'leftovers' &&
        !this.mealForm.customTitle.trim())
    ) {
      return;
    }

    this.mealPlanner.saveMeal(this.mealForm, this.editingMealId);
    void this.router.navigateByUrl('/meals');
  }

  cancel(): void {
    void this.router.navigateByUrl('/meals');
  }

  private createEmptyForm(): MealFormState {
    return {
      id: '',
      name: '',
      category: 'Dinner',
      mealType: 'recipe',
      vegetarian: false,
      servings: 2,
      ingredients: '',
      steps: '',
      preparation: '',
      notes: '',
      customTitle: '',
      starRating: 7,
    };
  }
}
