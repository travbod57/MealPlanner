import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';

import { environment } from '../environments/environment';

export type MealType = 'recipe' | 'takeaway' | 'eatingOut' | 'leftovers';

export interface Meal {
  id: string;
  name: string;
  category: string;
  mealType: MealType;
  vegetarian: boolean | null;
  ingredients: string[];
  steps: string[];
  createdAt: string;
  updatedAt: string;
  timesUsed: number;
  averageRating: number;
  ratingCount: number;
  starRating: number;
  notes: string;
  customTitle: string | null;
}

export interface WeeklyPlan {
  id: string;
  weekStart: string;
  mealIds: Array<string | null>;
  isLocked: boolean;
  generatedAt: string;
  lockedAt: string | null;
}

export interface MealFormState {
  id: string;
  name: string;
  category: string;
  mealType: MealType;
  vegetarian: boolean | null;
  ingredients: string;
  steps: string;
  notes: string;
  customTitle: string;
  starRating: number;
}

interface HouseholdData {
  meals: Meal[];
  plans: WeeklyPlan[];
  settings: {
    weekStartDay: number;
    maxVegetarianMeals: number;
  };
}

const MEAL_STORAGE_KEY = 'meal-planner-meals';
const PLAN_STORAGE_KEY = 'meal-planner-plans';
const SETTINGS_STORAGE_KEY = 'meal-planner-settings';

const WEEKDAY_OPTIONS = [
  { label: 'Sunday', value: 0 },
  { label: 'Monday', value: 1 },
  { label: 'Tuesday', value: 2 },
  { label: 'Wednesday', value: 3 },
  { label: 'Thursday', value: 4 },
  { label: 'Friday', value: 5 },
  { label: 'Saturday', value: 6 },
];

@Injectable({ providedIn: 'root' })
export class MealPlannerService {
  meals: Meal[] = [];
  plans: WeeklyPlan[] = [];
  draftPlanMealIds: Array<string | null> = Array(7).fill(null);
  weekStartDay = 3;
  maxVegetarianMeals = 3;

  private readonly firestore = inject(Firestore, { optional: true });
  private readonly firestoreEnabled =
    !!this.firestore &&
    environment.useFirestore &&
    Boolean(environment.firebase?.projectId);
  private readonly householdKey = 'default-household';

  constructor() {
    this.loadSettings();
    this.loadMeals();
    this.loadPlans();

    if (this.firestoreEnabled) {
      void this.loadFirestoreState();
      return;
    }

    this.seedDefaultMealsIfNeeded();
  }

  readonly WEEKDAY_OPTIONS = WEEKDAY_OPTIONS;

  get DAY_LABELS(): string[] {
    return Array.from({ length: 7 }, (_, index) => {
      const value = (this.weekStartDay + index) % 7;
      return WEEKDAY_OPTIONS[value].label.slice(0, 3);
    });
  }

  get thisWeekPlan(): WeeklyPlan | null {
    const weekStart = this.currentWeekStart();
    return (
      this.plans.find(
        (plan) => plan.isLocked && plan.weekStart === weekStart,
      ) ?? null
    );
  }

  get nextWeekPlan(): WeeklyPlan | null {
    const weekStart = this.nextWeekStart();
    return (
      this.plans.find(
        (plan) => plan.isLocked && plan.weekStart === weekStart,
      ) ?? null
    );
  }

  get historyPlans(): WeeklyPlan[] {
    return [...this.plans]
      .filter((plan) => plan.isLocked)
      .filter((plan) => plan.weekStart < this.currentWeekStart())
      .sort(
        (a, b) =>
          new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime(),
      );
  }

  getMealNameById(mealId: string | null): string {
    const meal = this.meals.find((entry) => entry.id === mealId);
    if (!meal) {
      return 'Choose a meal';
    }

    return meal.customTitle || meal.name;
  }

  getWeekDayDate(weekOffset: number, dayIndex: number): Date {
    const today = new Date();
    const daysSinceWeekStart = (today.getDay() - this.weekStartDay + 7) % 7;
    return new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - daysSinceWeekStart + weekOffset * 7 + dayIndex,
    );
  }

  setWeekStartDay(day: number): void {
    if (!Number.isInteger(day) || day < 0 || day > 6) {
      return;
    }

    const previousStartDay = this.weekStartDay;
    if (previousStartDay !== day) {
      const existingDraft = [...this.draftPlanMealIds];
      this.draftPlanMealIds = Array.from({ length: 7 }, (_, index) => {
        const weekday = (day + index) % 7;
        const oldIndex = (weekday - previousStartDay + 7) % 7;
        return existingDraft[oldIndex] ?? null;
      });
      this.weekStartDay = day;
    }

    this.saveSettings();
  }

  setMaxVegetarianMeals(count: number): void {
    if (!Number.isInteger(count) || count < 0 || count > 7) {
      return;
    }

    this.maxVegetarianMeals = count;
    this.saveSettings();
  }

  getMealTypeLabel(type: MealType): string {
    switch (type) {
      case 'leftovers':
        return 'Leftovers';
      case 'takeaway':
        return 'Take away';
      case 'eatingOut':
        return 'Eating out';
      default:
        return 'Recipe';
    }
  }

  getStarDisplay(value: number): string {
    return (
      '★'.repeat(Math.max(0, Math.min(10, value))) +
      '☆'.repeat(Math.max(0, 10 - Math.min(10, value)))
    );
  }

  saveMeal(form: MealFormState, editingMealId: string | null): void {
    const name = form.name.trim();
    if (
      !name ||
      !form.category.trim() ||
      typeof form.vegetarian !== 'boolean' ||
      (form.mealType === 'leftovers' && !form.customTitle.trim())
    ) {
      return;
    }

    const payload: Meal = {
      id: editingMealId ?? this.makeId(),
      name,
      category: form.category,
      mealType: form.mealType,
      vegetarian: form.vegetarian,
      ingredients: this.parseList(form.ingredients),
      steps: this.parseList(form.steps),
      createdAt: editingMealId
        ? (this.meals.find((meal) => meal.id === editingMealId)?.createdAt ??
          new Date().toISOString())
        : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timesUsed: editingMealId
        ? (this.meals.find((meal) => meal.id === editingMealId)?.timesUsed ?? 0)
        : 0,
      averageRating: editingMealId
        ? (this.meals.find((meal) => meal.id === editingMealId)
            ?.averageRating ?? 0)
        : 0,
      ratingCount: editingMealId
        ? (this.meals.find((meal) => meal.id === editingMealId)?.ratingCount ??
          0)
        : 0,
      starRating: form.starRating,
      notes: form.notes.trim(),
      customTitle: form.customTitle.trim() || null,
    };

    const existingIndex = this.meals.findIndex(
      (meal) => meal.id === payload.id,
    );
    if (existingIndex >= 0) {
      this.meals[existingIndex] = payload;
    } else {
      this.meals.push(payload);
    }

    this.saveMeals();
  }

  editMeal(meal: Meal): MealFormState {
    return {
      id: meal.id,
      name: meal.name,
      category: meal.category,
      mealType: meal.mealType,
      vegetarian: meal.vegetarian ?? false,
      ingredients: meal.ingredients.join(', '),
      steps: meal.steps.join('\n'),
      notes: meal.notes,
      customTitle: meal.customTitle ?? '',
      starRating: meal.starRating,
    };
  }

  deleteMeal(mealId: string): void {
    this.meals = this.meals.filter((meal) => meal.id !== mealId);
    this.draftPlanMealIds = this.draftPlanMealIds.map((draftMealId) =>
      draftMealId === mealId ? null : draftMealId,
    );
    this.saveMeals();
  }

  updateMealRating(mealId: string, rating: number): void {
    const meal = this.meals.find((entry) => entry.id === mealId);
    if (!meal) {
      return;
    }

    const currentTotal = meal.averageRating * meal.ratingCount;
    const nextCount = meal.ratingCount + 1;
    meal.averageRating = Number(
      ((currentTotal + rating) / nextCount).toFixed(1),
    );
    meal.ratingCount = nextCount;
    meal.starRating = rating;
    meal.updatedAt = new Date().toISOString();
    this.saveMeals();
  }

  randomizePlan(): void {
    if (!this.meals.length) {
      return;
    }

    const vegetarianMeals = this.shuffle(
      this.meals.filter((meal) => meal.vegetarian !== false),
    );
    const otherMeals = this.shuffle(
      this.meals.filter((meal) => meal.vegetarian === false),
    );
    const selectedMealIds = vegetarianMeals
      .slice(0, this.maxVegetarianMeals)
      .map((meal) => meal.id);
    const otherMealSlots = 7 - selectedMealIds.length;

    if (otherMeals.length > 0) {
      for (let index = 0; index < otherMealSlots; index += 1) {
        selectedMealIds.push(otherMeals[index % otherMeals.length].id);
      }
    } else if (vegetarianMeals.length > 0) {
      const vegetarianSlots = Math.min(7, this.maxVegetarianMeals);
      for (
        let index = selectedMealIds.length;
        index < vegetarianSlots;
        index += 1
      ) {
        selectedMealIds.push(
          vegetarianMeals[index % vegetarianMeals.length].id,
        );
      }
    }

    const randomizedMealIds = this.shuffle(selectedMealIds);
    this.draftPlanMealIds = Array.from(
      { length: 7 },
      (_, index) => randomizedMealIds[index] ?? null,
    );
  }

  lockPlan(): boolean {
    if (this.draftPlanMealIds.some((mealId) => !mealId)) {
      return false;
    }

    if (this.getDraftVegetarianCount() > this.maxVegetarianMeals) {
      return false;
    }

    const weekday = this.nextWeekStart();
    const plan: WeeklyPlan = {
      id: this.makeId(),
      weekStart: weekday,
      mealIds: [...this.draftPlanMealIds],
      isLocked: true,
      generatedAt: new Date().toISOString(),
      lockedAt: new Date().toISOString(),
    };

    this.plans = [
      plan,
      ...this.plans.filter((savedPlan) => savedPlan.weekStart !== weekday),
    ];
    this.savePlans();

    this.meals.forEach((meal) => {
      if (this.draftPlanMealIds.includes(meal.id)) {
        meal.timesUsed += 1;
        meal.updatedAt = new Date().toISOString();
      }
    });

    this.saveMeals();
    this.clearDraftPlan();
    return true;
  }

  getDraftVegetarianCount(): number {
    return this.draftPlanMealIds.filter((mealId) => {
      if (!mealId) {
        return false;
      }

      const meal = this.meals.find((entry) => entry.id === mealId);
      return meal?.vegetarian !== false;
    }).length;
  }

  clearDraftPlan(): void {
    this.draftPlanMealIds = Array.from({ length: 7 }, () => null);
  }

  currentWeekStart(): string {
    const now = new Date();
    const daysSinceWeekStart = (now.getDay() - this.weekStartDay + 7) % 7;
    return this.toDateKey(
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - daysSinceWeekStart,
      ),
    );
  }

  nextWeekStart(): string {
    const nextStart = new Date(`${this.currentWeekStart()}T00:00:00`);
    nextStart.setDate(nextStart.getDate() + 7);
    return this.toDateKey(nextStart);
  }

  seedDefaultMealsIfNeeded(): void {
    if (environment.production) {
      return;
    }

    if (this.meals.length > 0 || this.plans.length > 0) {
      return;
    }

    const sampleMeals: Meal[] = [
      {
        id: this.makeId(),
        name: 'Spaghetti Bolognese',
        category: 'Dinner',
        mealType: 'recipe',
        vegetarian: false,
        ingredients: ['spaghetti', 'mince', 'tomato sauce', 'onion'],
        steps: ['Cook the pasta', 'Brown the mince', 'Add sauce and simmer'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timesUsed: 0,
        averageRating: 0,
        ratingCount: 0,
        starRating: 7,
        notes: '',
        customTitle: null,
      },
      {
        id: this.makeId(),
        name: 'Chicken Stir-Fry',
        category: 'Dinner',
        mealType: 'recipe',
        vegetarian: false,
        ingredients: ['chicken', 'veg', 'soy sauce'],
        steps: ['Cook chicken', 'Add veg', 'Toss with sauce'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timesUsed: 0,
        averageRating: 0,
        ratingCount: 0,
        starRating: 7,
        notes: '',
        customTitle: null,
      },
      {
        id: this.makeId(),
        name: 'Takeaway Curry',
        category: 'Dinner',
        mealType: 'takeaway',
        vegetarian: false,
        ingredients: [],
        steps: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timesUsed: 0,
        averageRating: 0,
        ratingCount: 0,
        starRating: 7,
        notes: 'Quick dinner option',
        customTitle: null,
      },
      {
        id: this.makeId(),
        name: 'Leftover Pasta',
        category: 'Dinner',
        mealType: 'leftovers',
        vegetarian: false,
        ingredients: [],
        steps: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timesUsed: 0,
        averageRating: 0,
        ratingCount: 0,
        starRating: 7,
        notes: '',
        customTitle: 'Leftover Pasta',
      },
    ];

    this.meals = sampleMeals;
    this.weekStartDay = 3;
    this.maxVegetarianMeals = 3;

    const starterPlan: WeeklyPlan = {
      id: this.makeId(),
      weekStart: this.nextWeekStart(),
      mealIds: Array.from({ length: 7 }, (_, index) => {
        const meal = sampleMeals[index % sampleMeals.length];
        return meal?.id ?? null;
      }),
      isLocked: true,
      generatedAt: new Date().toISOString(),
      lockedAt: new Date().toISOString(),
    };

    this.plans = [starterPlan];
    this.saveMeals();
    this.savePlans();
  }

  private loadMeals(): void {
    const raw = localStorage.getItem(MEAL_STORAGE_KEY);
    const storedMeals: Meal[] = raw ? JSON.parse(raw) : [];
    this.meals = storedMeals.map((meal) => ({
      ...meal,
      vegetarian: meal.vegetarian ?? null,
    }));
  }

  private async loadFirestoreState(): Promise<void> {
    if (!this.firestoreEnabled || !this.firestore) {
      return;
    }

    const snapshot = await getDoc(
      doc(this.firestore, 'households', this.householdKey),
    );
    if (!snapshot.exists()) {
      if (this.meals.length === 0) {
        this.seedDefaultMealsIfNeeded();
      }
      this.persistAppState();
      return;
    }

    const data = snapshot.data() as Partial<HouseholdData> | undefined;
    const loadedMeals = Array.isArray(data?.meals) ? data!.meals : [];
    const loadedPlans = Array.isArray(data?.plans) ? data!.plans : [];
    const settings = (data?.settings ?? {}) as Partial<
      HouseholdData['settings']
    >;

    this.meals = loadedMeals.map((meal) => ({
      ...meal,
      vegetarian: meal.vegetarian ?? null,
    }));
    this.plans = loadedPlans;

    if (
      typeof settings.weekStartDay === 'number' &&
      Number.isInteger(settings.weekStartDay) &&
      settings.weekStartDay >= 0 &&
      settings.weekStartDay <= 6
    ) {
      this.weekStartDay = settings.weekStartDay;
    }

    if (
      typeof settings.maxVegetarianMeals === 'number' &&
      Number.isInteger(settings.maxVegetarianMeals) &&
      settings.maxVegetarianMeals >= 0 &&
      settings.maxVegetarianMeals <= 7
    ) {
      this.maxVegetarianMeals = settings.maxVegetarianMeals;
    }
  }

  private loadSettings(): void {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return;
    }

    try {
      const settings = JSON.parse(raw) as {
        weekStartDay?: number;
        maxVegetarianMeals?: number;
      };
      const day = settings.weekStartDay;
      if (
        typeof day === 'number' &&
        Number.isInteger(day) &&
        day >= 0 &&
        day <= 6
      ) {
        this.weekStartDay = day;
      }
      const maxVegetarianMeals = settings.maxVegetarianMeals;
      if (
        typeof maxVegetarianMeals === 'number' &&
        Number.isInteger(maxVegetarianMeals) &&
        maxVegetarianMeals >= 0 &&
        maxVegetarianMeals <= 7
      ) {
        this.maxVegetarianMeals = maxVegetarianMeals;
      }
    } catch {
      this.weekStartDay = 3;
    }
  }

  private toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private saveSettings(): void {
    this.persistAppState();
  }

  private persistAppState(): void {
    const appState: HouseholdData = {
      meals: this.meals,
      plans: this.plans,
      settings: {
        weekStartDay: this.weekStartDay,
        maxVegetarianMeals: this.maxVegetarianMeals,
      },
    };

    localStorage.setItem(MEAL_STORAGE_KEY, JSON.stringify(appState.meals));
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(appState.plans));
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify(appState.settings),
    );

    if (!this.firestoreEnabled || !this.firestore) {
      return;
    }

    void setDoc(
      doc(this.firestore, 'households', this.householdKey),
      appState,
    ).catch(() => {
      // Keep the browser localStore fallback if Firestore is temporarily unavailable.
    });
  }

  private shuffle<T>(items: T[]): T[] {
    return [...items].sort(() => Math.random() - 0.5);
  }

  private saveMeals(): void {
    this.persistAppState();
  }

  private loadPlans(): void {
    const raw = localStorage.getItem(PLAN_STORAGE_KEY);
    this.plans = raw ? JSON.parse(raw) : [];
  }

  private savePlans(): void {
    this.persistAppState();
  }

  private parseList(value: string): string[] {
    return value
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private makeId(): string {
    return `meal-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }
}
