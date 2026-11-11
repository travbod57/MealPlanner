import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from '@angular/fire/firestore';

import { environment } from '../environments/environment';

export type MealType = 'recipe' | 'takeaway' | 'eatingOut' | 'leftovers';
export type MealServings = 2 | 4;

export interface Meal {
  id: string;
  name: string;
  category: string;
  mealType: MealType;
  vegetarian: boolean | null;
  servings: MealServings;
  ingredients: string[];
  steps: string[];
  preparation: string[];
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
  generatedAt: string;
}

export interface MealFormState {
  id: string;
  name: string;
  category: string;
  mealType: MealType;
  vegetarian: boolean | null;
  servings: MealServings;
  ingredients: string;
  steps: string;
  preparation: string;
  notes: string;
  customTitle: string;
  starRating: number;
}

interface HouseholdData {
  meals: Meal[];
  plans: WeeklyPlan[];
  draftPlan: {
    weekStart: string;
    mealIds: Array<string | null>;
  };
  settings: {
    weekStartDay: number;
    maxVegetarianMeals: number;
  };
}

interface HouseholdMetadata {
  draftPlan: HouseholdData['draftPlan'];
  settings: HouseholdData['settings'];
}

interface LegacyHouseholdData extends HouseholdMetadata {
  meals?: Meal[];
  plans?: WeeklyPlan[];
}

const FIRESTORE_BATCH_SIZE = 450;
const MEAL_STORAGE_KEY = 'meal-planner-meals';
const PLAN_STORAGE_KEY = 'meal-planner-plans';
const DRAFT_PLAN_STORAGE_KEY = 'meal-planner-draft-plan';
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
  private draftMealIds: Array<string | null> = Array(7).fill(null);
  private draftPlanWeekStart = '';
  private firestoreWriteQueue: Promise<void> = Promise.resolve();
  private readonly firestoreMealSnapshots = new Map<string, string>();
  private readonly firestorePlanSnapshots = new Map<string, string>();
  private pendingFirestorePersistence = false;
  weekStartDay = 3;
  maxVegetarianMeals = 3;
  isReady = false;
  loadError: string | null = null;
  saveError: string | null = null;

  private readonly firestore = inject(Firestore, { optional: true });
  private readonly firestoreEnabled =
    !!this.firestore &&
    environment.useFirestore &&
    Boolean(environment.firebase?.projectId);
  private readonly householdKey = 'default-household';

  constructor() {
    if (this.firestoreEnabled) {
      console.info('MealPlannerService: using Firestore persistence');
      void this.loadFirestoreState()
        .then(() => {
          this.isReady = true;
          if (this.pendingFirestorePersistence) {
            this.pendingFirestorePersistence = false;
            this.persistAppState();
          }
        })
        .catch((error: unknown) => {
          console.error('Firestore state load failed.', error);
          this.loadError =
            'Saved data could not be loaded from Firestore. It has not been changed. Check your connection and refresh to try again.';
        });
      return;
    }

    console.info('MealPlannerService: using localStorage persistence');
    this.loadSettings();
    this.loadMeals();
    this.loadPlans();
    this.loadDraftPlan();
    this.seedDefaultMealsIfNeeded();
    this.isReady = true;
  }

  readonly WEEKDAY_OPTIONS = WEEKDAY_OPTIONS;

  get draftPlanMealIds(): Array<string | null> {
    if (this.ensureDraftPlanWindow()) {
      this.persistAppState();
    }
    return this.draftMealIds;
  }

  get DAY_LABELS(): string[] {
    return Array.from({ length: 7 }, (_, index) => {
      const value = (this.weekStartDay + index) % 7;
      return WEEKDAY_OPTIONS[value].label.slice(0, 3);
    });
  }

  get thisWeekPlan(): WeeklyPlan | null {
    if (this.ensureDraftPlanWindow()) {
      this.persistAppState();
    }
    const weekStart = this.currentWeekStart();
    return this.plans.find((plan) => plan.weekStart === weekStart) ?? null;
  }

  get historyPlans(): WeeklyPlan[] {
    if (this.ensureDraftPlanWindow()) {
      this.persistAppState();
    }
    return [...this.plans]
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

  getMealById(mealId: string | null): Meal | null {
    return this.meals.find((entry) => entry.id === mealId) ?? null;
  }

  isVegetarianMeal(mealId: string | null): boolean {
    return this.meals.some(
      (meal) => meal.id === mealId && meal.vegetarian === true,
    );
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
      this.draftMealIds = Array.from({ length: 7 }, (_, index) => {
        const weekday = (day + index) % 7;
        const oldIndex = (weekday - previousStartDay + 7) % 7;
        return existingDraft[oldIndex] ?? null;
      });
      this.weekStartDay = day;
      this.draftPlanWeekStart = this.nextWeekStart();
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

  saveMeal(form: MealFormState, editingMealId: string | null): boolean {
    const name = form.name.trim();
    if (
      !name ||
      this.isMealNameTaken(name, form.mealType, editingMealId) ||
      !form.category.trim() ||
      typeof form.vegetarian !== 'boolean' ||
      (form.mealType === 'leftovers' && !form.customTitle.trim())
    ) {
      return false;
    }

    const payload: Meal = {
      id: editingMealId ?? this.makeId(),
      name,
      category: form.category,
      mealType: form.mealType,
      vegetarian: form.vegetarian,
      servings: form.servings === 4 ? 4 : 2,
      ingredients: this.parseList(form.ingredients),
      steps: this.parseList(form.steps),
      preparation: this.parseList(form.preparation),
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
    return true;
  }

  isMealNameTaken(
    name: string,
    mealType: MealType,
    excludingMealId: string | null = null,
  ): boolean {
    const normalizedName = name.trim().toLocaleLowerCase();
    return this.meals.some(
      (meal) => {
        const oneIsLeftovers =
          (meal.mealType === 'leftovers') !== (mealType === 'leftovers');
        return (
          meal.id !== excludingMealId &&
          meal.name.trim().toLocaleLowerCase() === normalizedName &&
          !oneIsLeftovers
        );
      },
    );
  }

  editMeal(meal: Meal): MealFormState {
    return {
      id: meal.id,
      name: meal.name,
      category: meal.category,
      mealType: meal.mealType,
      vegetarian: meal.vegetarian ?? false,
      servings: meal.servings === 4 ? 4 : 2,
      ingredients: meal.ingredients.join('\n'),
      steps: meal.steps.join('\n'),
      preparation: meal.preparation.join('\n'),
      notes: meal.notes,
      customTitle: meal.customTitle ?? '',
      starRating: meal.starRating,
    };
  }

  deleteMeal(mealId: string): void {
    this.meals = this.meals.filter((meal) => meal.id !== mealId);
    this.draftMealIds = this.draftPlanMealIds.map((draftMealId) =>
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
    const randomizableMeals = this.meals.filter(
      (meal) => meal.mealType !== 'leftovers',
    );
    if (!randomizableMeals.length) {
      return;
    }

    const randomizedMealIds = [...this.draftPlanMealIds];
    const usedMealIds = new Set(
      randomizedMealIds.filter((mealId): mealId is string => Boolean(mealId)),
    );
    const openDays = randomizedMealIds
      .map((mealId, index) => (mealId ? -1 : index))
      .filter((index) => index >= 0);
    const vegetarianCapacity = Math.max(
      0,
      this.maxVegetarianMeals - this.getDraftVegetarianCount(),
    );
    const vegetarianMeals = this.shuffle(
      randomizableMeals.filter((meal) => meal.vegetarian !== false),
    );
    const otherMeals = this.shuffle(
      randomizableMeals.filter((meal) => meal.vegetarian === false),
    );
    const assignUniqueMeals = (
      meals: Meal[],
      dayIndexes: number[],
    ): number[] => {
      const availableMeals = meals.filter((meal) => !usedMealIds.has(meal.id));
      const assignedMeals = availableMeals.slice(0, dayIndexes.length);
      assignedMeals.forEach((meal, index) => {
        randomizedMealIds[dayIndexes[index]] = meal.id;
        usedMealIds.add(meal.id);
      });
      return dayIndexes.slice(assignedMeals.length);
    };

    const vegetarianDays = openDays.slice(
      0,
      Math.min(vegetarianCapacity, openDays.length),
    );
    const remainingVegetarianDays = assignUniqueMeals(
      vegetarianMeals,
      vegetarianDays,
    );
    const vegetarianMealsAssigned =
      vegetarianDays.length - remainingVegetarianDays.length;
    let remainingDays = [
      ...remainingVegetarianDays,
      ...openDays.slice(vegetarianDays.length),
    ];
    remainingDays = assignUniqueMeals(otherMeals, remainingDays);

    if (randomizableMeals.length < 7 && otherMeals.length > 0) {
      remainingDays.forEach((dayIndex, index) => {
        randomizedMealIds[dayIndex] = otherMeals[index % otherMeals.length].id;
      });
      remainingDays = [];
    }

    if (
      randomizableMeals.length < 7 &&
      remainingDays.length > 0 &&
      vegetarianMeals.length > 0
    ) {
      const remainingVegetarianCapacity =
        vegetarianCapacity - vegetarianMealsAssigned;
      remainingDays
        .slice(0, remainingVegetarianCapacity)
        .forEach((dayIndex, index) => {
          randomizedMealIds[dayIndex] =
            vegetarianMeals[index % vegetarianMeals.length].id;
        });
    }

    this.draftMealIds = randomizedMealIds;
    this.persistAppState();
  }

  shuffleDraftPlan(): void {
    this.draftMealIds = this.shuffle(this.draftPlanMealIds);
    this.persistAppState();
  }

  setDraftPlanMeal(dayIndex: number, mealId: string): void {
    if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= 7) {
      return;
    }

    if (!this.meals.some((meal) => meal.id === mealId)) {
      return;
    }

    this.ensureDraftPlanWindow();
    this.draftMealIds[dayIndex] = mealId;
    this.persistAppState();
  }

  reorderDraftPlan(fromIndex: number, toIndex: number): void {
    if (
      !Number.isInteger(fromIndex) ||
      !Number.isInteger(toIndex) ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= 7 ||
      toIndex >= 7 ||
      fromIndex === toIndex
    ) {
      return;
    }

    this.ensureDraftPlanWindow();
    const reorderedMealIds = [...this.draftMealIds];
    const [movedMealId] = reorderedMealIds.splice(fromIndex, 1);
    reorderedMealIds.splice(toIndex, 0, movedMealId ?? null);
    this.draftMealIds = reorderedMealIds;
    this.persistAppState();
  }

  reorderThisWeekPlan(fromIndex: number, toIndex: number): void {
    if (
      !Number.isInteger(fromIndex) ||
      !Number.isInteger(toIndex) ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= 7 ||
      toIndex >= 7 ||
      fromIndex === toIndex
    ) {
      return;
    }

    const currentPlan = this.thisWeekPlan;
    if (!currentPlan) {
      return;
    }

    const mealIds = [...currentPlan.mealIds];
    const [movedMealId] = mealIds.splice(fromIndex, 1);
    mealIds.splice(toIndex, 0, movedMealId ?? null);
    this.plans = this.plans.map((plan) =>
      plan.id === currentPlan.id ? { ...plan, mealIds } : plan,
    );
    this.persistAppState();
  }

  clearDraftPlanMeal(dayIndex: number): void {
    if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= 7) {
      return;
    }

    this.ensureDraftPlanWindow();
    if (!this.draftMealIds[dayIndex]) {
      return;
    }

    this.draftMealIds[dayIndex] = null;
    this.persistAppState();
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
    this.ensureDraftPlanWindow();
    this.draftMealIds = Array.from({ length: 7 }, () => null);
    this.draftPlanWeekStart = this.nextWeekStart();
    this.persistAppState();
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
        servings: 2,
        ingredients: ['spaghetti', 'mince', 'tomato sauce', 'onion'],
        steps: ['Cook the pasta', 'Brown the mince', 'Add sauce and simmer'],
        preparation: [],
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
        servings: 2,
        ingredients: ['chicken', 'veg', 'soy sauce'],
        steps: ['Cook chicken', 'Add veg', 'Toss with sauce'],
        preparation: [],
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
        servings: 2,
        ingredients: [],
        steps: [],
        preparation: [],
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
        servings: 2,
        ingredients: [],
        steps: [],
        preparation: [],
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

    this.draftPlanWeekStart = this.nextWeekStart();
    this.draftMealIds = Array.from({ length: 7 }, (_, index) => {
      const meal = sampleMeals[index % sampleMeals.length];
      return meal?.id ?? null;
    });
    this.persistAppState();
  }

  private loadMeals(): void {
    if (this.firestoreEnabled) {
      return;
    }

    const raw = localStorage.getItem(MEAL_STORAGE_KEY);
    const storedMeals: Meal[] = raw ? JSON.parse(raw) : [];
    this.meals = storedMeals.map((meal) => ({
      ...meal,
      vegetarian: meal.vegetarian ?? null,
      servings: meal.servings === 4 ? 4 : 2,
      preparation: meal.preparation ?? [],
    }));
  }

  private async loadFirestoreState(): Promise<void> {
    if (!this.firestoreEnabled || !this.firestore) {
      return;
    }

    const householdRef = doc(
      this.firestore,
      'households',
      this.householdKey,
    );
    const [householdSnapshot, mealSnapshot, planSnapshot] = await Promise.all([
      getDoc(householdRef),
      getDocs(collection(householdRef, 'meals')),
      getDocs(collection(householdRef, 'plans')),
    ]);
    const data = householdSnapshot.exists()
      ? (householdSnapshot.data() as Partial<LegacyHouseholdData>)
      : undefined;
    const firestoreMeals = mealSnapshot.docs.map((mealDoc) => {
      const meal = mealDoc.data() as Partial<Meal>;
      return {
        ...meal,
        id: meal.id ?? mealDoc.id,
        vegetarian: meal.vegetarian ?? null,
        servings: meal.servings === 4 ? 4 : 2,
        preparation: meal.preparation ?? [],
      } as Meal;
    });
    const firestorePlans = planSnapshot.docs.map((planDoc) => {
      const plan = planDoc.data() as Partial<WeeklyPlan>;
      return {
        ...plan,
        id: plan.id ?? planDoc.id,
      } as WeeklyPlan;
    });
    const legacyMeals = Array.isArray(data?.meals) ? data.meals : [];
    const legacyPlans = Array.isArray(data?.plans) ? data.plans : [];
    const loadedMeals = mergeRecordsById(legacyMeals, firestoreMeals);
    const loadedPlans = mergeRecordsById(legacyPlans, firestorePlans);
    const settings = (data?.settings ?? {}) as Partial<
      HouseholdData['settings']
    >;

    this.meals = loadedMeals.map((meal) => ({
      ...meal,
      vegetarian: meal.vegetarian ?? null,
      servings: meal.servings === 4 ? 4 : 2,
      preparation: meal.preparation ?? [],
    }));
    this.plans = loadedPlans;
    firestoreMeals.forEach((meal) => {
      this.firestoreMealSnapshots.set(meal.id, JSON.stringify(meal));
    });
    firestorePlans.forEach((plan) => {
      this.firestorePlanSnapshots.set(plan.id, JSON.stringify(plan));
    });

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
    this.restoreDraftPlan(data?.draftPlan);
    if (
      !householdSnapshot.exists() ||
      Array.isArray(data?.meals) ||
      Array.isArray(data?.plans)
    ) {
      this.pendingFirestorePersistence = true;
    }
  }

  private loadDraftPlan(): void {
    const raw = localStorage.getItem(DRAFT_PLAN_STORAGE_KEY);
    if (!raw) {
      this.restoreDraftPlan();
      return;
    }

    try {
      this.restoreDraftPlan(JSON.parse(raw) as HouseholdData['draftPlan']);
    } catch {
      this.restoreDraftPlan();
    }
  }

  private restoreDraftPlan(
    draftPlan?: HouseholdData['draftPlan'] | null,
  ): void {
    const upcomingWeekStart = this.nextWeekStart();
    if (
      draftPlan &&
      typeof draftPlan.weekStart === 'string' &&
      Array.isArray(draftPlan.mealIds) &&
      draftPlan.mealIds.length === 7
    ) {
      this.draftPlanWeekStart = draftPlan.weekStart;
      this.draftMealIds = [...draftPlan.mealIds];
      if (this.ensureDraftPlanWindow()) {
        this.persistAppState();
      }
      return;
    }

    const previousPlan = this.plans.find(
      (plan) => plan.weekStart === upcomingWeekStart,
    );
    this.draftPlanWeekStart = upcomingWeekStart;
    this.draftMealIds = previousPlan
      ? [...previousPlan.mealIds]
      : Array(7).fill(null);
    if (previousPlan) {
      this.plans = this.plans.filter(
        (plan) => plan.weekStart !== upcomingWeekStart,
      );
      this.persistAppState();
    }
  }

  private ensureDraftPlanWindow(): boolean {
    const upcomingWeekStart = this.nextWeekStart();
    if (this.draftPlanWeekStart !== upcomingWeekStart) {
      const draftWeekStart = this.draftPlanWeekStart;
      if (
        draftWeekStart &&
        draftWeekStart <= this.currentWeekStart() &&
        this.draftMealIds.some(Boolean)
      ) {
        const existingPlan = this.plans.find(
          (plan) => plan.weekStart === draftWeekStart,
        );
        const plan: WeeklyPlan = {
          id: this.makeId(),
          weekStart: draftWeekStart,
          mealIds: [...this.draftMealIds],
          generatedAt: new Date().toISOString(),
        };
        this.plans = [
          plan,
          ...this.plans.filter(
            (savedPlan) => savedPlan.weekStart !== draftWeekStart,
          ),
        ];
        if (!existingPlan) {
          this.meals.forEach((meal) => {
            if (plan.mealIds.includes(meal.id)) {
              meal.timesUsed += 1;
              meal.updatedAt = new Date().toISOString();
            }
          });
        }
      }
      this.draftMealIds = Array(7).fill(null);
      this.draftPlanWeekStart = upcomingWeekStart;
      return true;
    }
    return false;
  }

  private loadSettings(): void {
    if (this.firestoreEnabled) {
      return;
    }

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
    if (this.firestoreEnabled && !this.isReady) {
      this.pendingFirestorePersistence = true;
      return;
    }

    this.ensureDraftPlanWindow();
    const appState: HouseholdData = {
      meals: this.meals,
      plans: this.plans,
      draftPlan: {
        weekStart: this.draftPlanWeekStart,
        mealIds: this.draftMealIds,
      },
      settings: {
        weekStartDay: this.weekStartDay,
        maxVegetarianMeals: this.maxVegetarianMeals,
      },
    };

    if (!this.firestoreEnabled || !this.firestore) {
      localStorage.setItem(MEAL_STORAGE_KEY, JSON.stringify(appState.meals));
      localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(appState.plans));
      localStorage.setItem(
        DRAFT_PLAN_STORAGE_KEY,
        JSON.stringify(appState.draftPlan),
      );
      localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify(appState.settings),
      );
      return;
    }

    const stateToSave: HouseholdData = {
      ...appState,
      meals: appState.meals.map((meal) => ({
        ...meal,
        ingredients: [...meal.ingredients],
        steps: [...meal.steps],
        preparation: [...meal.preparation],
      })),
      plans: appState.plans.map((plan) => ({
        ...plan,
        mealIds: [...plan.mealIds],
      })),
      draftPlan: {
        ...appState.draftPlan,
        mealIds: [...appState.draftPlan.mealIds],
      },
      settings: { ...appState.settings },
    };
    this.firestoreWriteQueue = this.firestoreWriteQueue
      .then(async () => {
        const householdRef = doc(
          this.firestore!,
          'households',
          this.householdKey,
        );
        await this.syncFirestoreCollection(
          'meals',
          stateToSave.meals,
          this.firestoreMealSnapshots,
        );
        await this.syncFirestoreCollection(
          'plans',
          stateToSave.plans,
          this.firestorePlanSnapshots,
        );
        const metadata: HouseholdMetadata = {
          draftPlan: stateToSave.draftPlan,
          settings: stateToSave.settings,
        };
        await setDoc(householdRef, metadata);
      })
      .then(() => {
        this.saveError = null;
      })
      .catch((error: unknown) => {
        console.error('Firestore write failed.', error);
        this.saveError =
          'Changes could not be saved to Firestore. Keep this page open and check your connection before refreshing.';
      });
  }

  private async syncFirestoreCollection<T extends { id: string }>(
    collectionName: 'meals' | 'plans',
    records: T[],
    savedSnapshots: Map<string, string>,
  ): Promise<void> {
    const collectionRef = collection(
      this.firestore!,
      'households',
      this.householdKey,
      collectionName,
    );
    const recordsById = new Map(records.map((record) => [record.id, record]));
    const changes: Array<{ id: string; record: T | null }> = [];

    recordsById.forEach((record, id) => {
      if (savedSnapshots.get(id) !== JSON.stringify(record)) {
        changes.push({ id, record });
      }
    });
    savedSnapshots.forEach((_snapshot, id) => {
      if (!recordsById.has(id)) {
        changes.push({ id, record: null });
      }
    });

    for (let offset = 0; offset < changes.length; offset += FIRESTORE_BATCH_SIZE) {
      const batch = writeBatch(this.firestore!);
      const batchChanges = changes.slice(
        offset,
        offset + FIRESTORE_BATCH_SIZE,
      );
      batchChanges.forEach(({ id, record }) => {
        const recordRef = doc(collectionRef, id);
        if (record) {
          batch.set(recordRef, record);
        } else {
          batch.delete(recordRef);
        }
      });
      await batch.commit();
      batchChanges.forEach(({ id, record }) => {
        if (record) {
          savedSnapshots.set(id, JSON.stringify(record));
        } else {
          savedSnapshots.delete(id);
        }
      });
    }
  }

  private shuffle<T>(items: T[]): T[] {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [
        shuffled[swapIndex],
        shuffled[index],
      ];
    }
    return shuffled;
  }

  private saveMeals(): void {
    this.persistAppState();
  }

  private loadPlans(): void {
    if (this.firestoreEnabled) {
      return;
    }

    const raw = localStorage.getItem(PLAN_STORAGE_KEY);
    this.plans = raw ? JSON.parse(raw) : [];
  }

  private parseList(value: string): string[] {
    return value
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private makeId(): string {
    return `meal-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }
}

function mergeRecordsById<T extends { id: string }>(
  legacyRecords: T[],
  firestoreRecords: T[],
): T[] {
  const records = new Map(legacyRecords.map((record) => [record.id, record]));
  firestoreRecords.forEach((record) => records.set(record.id, record));
  return [...records.values()];
}
