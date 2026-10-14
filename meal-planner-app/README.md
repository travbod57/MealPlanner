# MealPlannerApp

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 17.3.17.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Deployment

This app is configured for Firebase Hosting deployments with GitHub Actions.

1. Create a Firebase project and enable Hosting.
2. Update the project ID in `.firebaserc` to match your Firebase project name.
3. Add a GitHub secret named `FIREBASE_SERVICE_ACCOUNT_MEAL_PLANNER_APP` with the Firebase service account JSON.
4. Push to `main` to deploy to production, or open a pull request for a preview deployment.

The workflow files live in `.github/workflows` and will run `npm ci`, build the Angular app, and deploy it to Firebase Hosting when the conditions are met.

## Optional Firestore persistence

The app keeps browser `localStorage` as the default persistence layer, and it also includes a Firestore-ready path for a shared household state.

To enable it:

1. Fill in the Firebase config values in `src/environments/environment.ts` and `src/environments/environment.prod.ts`.
2. Set `useFirestore` to `true` in the active environment file.
3. Ensure the Firebase project has Firestore enabled.
4. Deploy the Firestore rules with `firebase deploy --only firestore:rules`.

When the toggle is off, the app continues to use local browser storage so the prototype remains simple and independent of auth or backend setup.

### Single-household Firestore model

The cloud version stores a single document at `households/default-household`.

```json
{
  "meals": [
    {
      "id": "meal-123",
      "name": "Spaghetti Bolognese",
      "category": "Dinner",
      "mealType": "recipe",
      "vegetarian": false,
      "ingredients": ["spaghetti", "mince", "tomato sauce"],
      "steps": ["Cook the pasta", "Brown the mince"],
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z",
      "timesUsed": 0,
      "averageRating": 0,
      "ratingCount": 0,
      "starRating": 7,
      "notes": "",
      "customTitle": null
    }
  ],
  "plans": [
    {
      "id": "plan-123",
      "weekStart": "2026-01-05",
      "mealIds": ["meal-123", null, null, null, null, null, null],
      "generatedAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "settings": {
    "weekStartDay": 3,
    "maxVegetarianMeals": 3
  }
}
```

This keeps the Phase 1 architecture intentionally simple: one household, one shared document, no multi-user auth yet.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.
