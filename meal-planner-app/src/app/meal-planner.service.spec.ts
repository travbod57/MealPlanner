import { TestBed } from '@angular/core/testing';

import {
  Meal,
  MealFormState,
  MealPlannerService,
} from './meal-planner.service';

describe('MealPlannerService randomizePlan', () => {
  let service: MealPlannerService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [MealPlannerService] });
    service = TestBed.inject(MealPlannerService);
    service.meals = [
      createMeal('vegetarian-1', true),
      createMeal('vegetarian-2', true),
      createMeal('other-1', false),
      createMeal('other-2', false),
    ];
    service.maxVegetarianMeals = 3;
    service.clearDraftPlan();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  it('reuses meals for a small library without changing chosen days', () => {
    const chosenMealId = service.meals[0].id;
    service.setDraftPlanMeal(0, chosenMealId);

    service.randomizePlan();

    const plannedMealIds = service.draftPlanMealIds.filter(
      (mealId): mealId is string => Boolean(mealId),
    );
    expect(service.draftPlanMealIds[0]).toBe(chosenMealId);
    expect(plannedMealIds.length).toBe(7);
    expect(service.getDraftVegetarianCount()).toBeLessThanOrEqual(3);
    expect(new Set(plannedMealIds).size).toBeLessThan(7);
  });

  it('keeps all meals unique when the library has at least seven meals', () => {
    service.meals = [
      ...service.meals,
      createMeal('other-3', false),
      createMeal('other-4', false),
      createMeal('other-5', false),
    ];

    service.randomizePlan();

    const plannedMealIds = service.draftPlanMealIds.filter(
      (mealId): mealId is string => Boolean(mealId),
    );
    expect(plannedMealIds.length).toBe(7);
    expect(new Set(plannedMealIds).size).toBe(7);
  });

  it('reorders meals into the dropped day and persists the shifted plan', () => {
    service.meals.forEach((meal, index) => {
      service.setDraftPlanMeal(index, meal.id);
    });

    service.reorderDraftPlan(0, 3);

    expect(service.draftPlanMealIds).toEqual([
      service.meals[1].id,
      service.meals[2].id,
      service.meals[3].id,
      service.meals[0].id,
      null,
      null,
      null,
    ]);
    expect(
      JSON.parse(localStorage.getItem('meal-planner-draft-plan') ?? '{}')
        .mealIds,
    ).toEqual(service.draftPlanMealIds);
  });

  it('moves the saved draft into This Week when its week begins', () => {
    const upcomingWeekStart = service.nextWeekStart();
    const chosenMealId = service.meals[0].id;
    service.setDraftPlanMeal(0, chosenMealId);

    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(`${upcomingWeekStart}T12:00:00`));
    try {
      expect(service.thisWeekPlan?.weekStart).toBe(upcomingWeekStart);
      expect(service.thisWeekPlan?.mealIds[0]).toBe(chosenMealId);
      expect(service.draftPlanMealIds).toEqual(Array(7).fill(null));
      expect(service.meals[0].timesUsed).toBe(1);
      expect(service.plans.length).toBe(1);
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('saves and edits preparation steps as a numbered list', () => {
    const form: MealFormState = {
      ...service.editMeal(createMeal('prep-meal', false)),
      name: 'Prepared meal',
      category: 'Dinner',
      vegetarian: false,
      servings: 4,
      preparation: 'Chop vegetables\nMarinate overnight',
    };

    service.saveMeal(form, null);

    const meal = service.meals.find((entry) => entry.name === 'Prepared meal');
    expect(meal?.preparation).toEqual([
      'Chop vegetables',
      'Marinate overnight',
    ]);
    expect(meal?.servings).toBe(4);
    expect(meal && service.editMeal(meal).servings).toBe(4);
    expect(meal && service.editMeal(meal).preparation).toBe(
      'Chop vegetables\nMarinate overnight',
    );
  });

  it('loads older meals without preparation steps', () => {
    const {
      preparation: _preparation,
      servings: _servings,
      ...legacyMeal
    } = createMeal(
      'legacy-meal',
      false,
    );
    localStorage.setItem('meal-planner-meals', JSON.stringify([legacyMeal]));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [MealPlannerService] });
    const freshService = TestBed.inject(MealPlannerService);
    expect(freshService.meals[0].preparation).toEqual([]);
    expect(freshService.meals[0].servings).toBe(2);
  });
});

function createMeal(id: string, vegetarian: boolean): Meal {
  return {
    id,
    name: id,
    category: 'Dinner',
    mealType: 'recipe',
    vegetarian,
    servings: 2,
    ingredients: [],
    steps: [],
    preparation: [],
    createdAt: '',
    updatedAt: '',
    timesUsed: 0,
    averageRating: 0,
    ratingCount: 0,
    starRating: 0,
    notes: '',
    customTitle: null,
  };
}
