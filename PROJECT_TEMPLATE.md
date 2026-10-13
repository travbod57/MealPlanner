# Meal Planner App Project Brief

## Project Overview
Build a low-friction meal planner for one household. It manages a shared meal library, plans seven consecutive days of meals, tracks global household usage, and stores one shared 1-to-10 star rating per meal.

The current prototype is an Angular 17 single-page app using Angular Material and browser `localStorage`. Firebase/Firestore and Firebase Hosting remain a possible hosted release target, not a claim about the current prototype. Authentication is deferred to Phase 2.

## Goals
- Make everyday meal planning quick and easy for a single household
- Plan seven days starting on a configurable weekday
- Support manual selection and randomized plans with a configurable vegetarian limit
- Track meal usage globally for the household
- Keep authentication out of Phase 1; avoid approval steps when locking a plan
- Keep the implementation maintainable and responsive
- Preserve Firebase Hosting, Firestore, and GitHub Actions as deployment/persistence options for a later hosted release

## Current Product Decisions
- The main meal is dinner. Do not add a breakfast/lunch/snack taxonomy in the initial scope.
- Meal type is one of recipe, take away, eating out, or leftovers. Leftovers have an editable description/title.
- Ingredients are optional. Recipe steps are optional for every meal type.
- Meal name, category, and vegetarian status are required. Vegetarian defaults to No. The leftovers description is shown and required only for leftovers.
- A meal has one shared household star rating from 1 to 10, with 10 best. Do not calculate or display an average rating.
- Meal usage counts and ratings are global for the household, not per person.
- The seven-day period starts Wednesday by default and can be changed in Settings.
- The randomizer vegetarian maximum is configurable from 0 to 7 and defaults to 3.
- Locking has no approval workflow. It requires all seven days to be selected and enforces the configured vegetarian maximum.
- Phase 1 has no sign-in requirement. Authentication is a possible Phase 2 feature.

## Navigation and Pages
- A persistent header has This Week, Plan Next Week, and Meal Library navigation, plus a settings cog at the top right. This Week is the landing route.
- This Week shows the seven dated day tiles for the current period. Highlight the current date with a distinct border. A tile with a meal links to its read-only meal detail page; an empty day is not clickable.
- Plan Next Week shows seven dated tiles in the configured weekday order. Each tile has a Choose action that opens a day-specific meal list.
- The meal picker has breadcrumbs back to Plan Next Week. Each meal name opens meal detail; a separate Choose action assigns that meal to the selected day and returns to the planner.
- Meal detail shows the meal card information, recipe data, and rating. Breadcrumbs return to This Week when opened from a current-week tile, or to the correct day-specific picker when opened during planning. Provide an Edit action.
- Meal Library lists saved meal cards and has an Add meal action. Edit opens the same form used for adding. Delete requires a confirmation dialog.
- Meal Library cards show category, meal type, vegetarian status, and times used. Ingredients and steps are behind a per-card show/hide panel with a slide animation. Keep Edit/Delete actions at the lower right of each card.
- Settings has separate Meal plan week and Randomiser panels. One Save settings button below both saves all settings together.

## Meal Form and Validation
- Add and edit share one routed form. Preserve saved meal values when editing.
- Required: meal name, category, and vegetarian Yes/No. The vegetarian selector defaults to No.
- Recipe steps and ingredients are optional. Do not block saving a meal with no steps.
- Only show the leftovers title field when meal type is leftovers; require its value in that case.
- Use Angular Material outlined fields, visible labels, and inline Material errors for form validation. Do not use browser alert dialogs.
- Use Angular Material snackbars for transient validation/action feedback and an Angular Material confirmation dialog for destructive meal deletion.

## Core Features

### 1. Meal Management
- Add a meal with a name
- Require a category and vegetarian Yes/No status; default vegetarian status to No
- Optionally capture ingredients and step-by-step recipe instructions
- Add a take-away, eating-out, or leftovers option as a meal-type replacement
- Show an editable leftovers description only for leftovers and require it for that meal type
- Optionally store notes
- Edit an existing meal
- Confirm before deleting a meal
- View a list of all meals
- Expand/collapse ingredients and steps on saved meal cards with a slide animation
- Open a meal detail page from meal cards and planner tiles
- Allow a selected meal slot to be replaced with a take-away, eating-out, or leftovers option without requiring recipe steps

### 2. Weekly Meal Planning
- A complete locked plan contains exactly 7 meals; a draft may have unfilled days
- Allow the user to create a plan manually by selecting meals already saved in the meal library
- Provide a day-specific Choose flow to select a meal from a simplified meal list
- Allow the user to randomize the selection from the list of meals while respecting the vegetarian maximum
- Fill remaining randomizer slots from non-vegetarian meals, reusing them if needed; if none are available, leave unfillable days empty and explain why
- Allow the user to review the randomized plan and edit it by swapping individual meals with other stored meals
- Start each seven-day period on the configured weekday (Wednesday by default)
- Configure the maximum number of vegetarian meals from 0 to 7 (default 3)
- Save the weekly plan persistently
- Allow the user to lock in the final plan for the week without any approval step
- Show dated day tiles in This Week and Plan Next Week; highlight today's tile on This Week
- Allow planned This Week tiles to open meal detail
- Show a history view of previous weekly plans from the past so users can review old meal selections

### 3. Frequency Tracking
- Track how many times each meal has been used
- Track use history over time
- Optionally prefer meals with lower recent usage when generating a plan

### 4. Rating System
- Store one global household meal rating on a 1 to 10 star scale based on personal preference or "favourite" level
- Treat 10 as the strongest favourite and 1 as the least preferred
- Display the saved rating using stars
- Do not store, calculate, or display an average rating

### 5. Storage and Persistence
- Current prototype persists meals, weekly plans, settings, usage counts, and ratings in browser `localStorage`
- A future hosted release may migrate persistence to Firestore
- Prefer simple, lightweight data structures
- Keep the data model easy to understand and maintain

### 6. Authentication and Access Control
- Authentication is not part of Phase 1
- Consider Firebase Authentication and access control in Phase 2 if cloud persistence or broader sharing is introduced

## Proposed Data Model

### Meal
- id: string
- name: string
- category: string
- mealType: "recipe" | "takeaway" | "eatingOut" | "leftovers"
- vegetarian: boolean (required for current/new meals; default false)
- ingredients: string[]
- steps: string[] (optional)
- createdAt: timestamp
- updatedAt: timestamp
- timesUsed: number
- starRating: number
- notes: string | null
- customTitle: string | null  // used for leftovers or custom meal names

### WeeklyPlan
- id: string
- weekStart: date
- mealIds: string[]
- isLocked: boolean
- generatedAt: timestamp
- lockedAt: timestamp | null

### Settings
- weekStartDay: number (0 Sunday through 6 Saturday; default 3 Wednesday)
- maxVegetarianMeals: number (0 through 7; default 3)

Legacy meal records without a vegetarian value are treated conservatively as vegetarian by the randomizer until classified.

### MealHistory (optional but useful)
- id: string
- mealId: string
- dateUsed: date
- planId: string | null

## Functional Requirements
- The app must support separate This Week, Plan Next Week, Meal Library, Settings, day-specific meal picker, meal detail, and add/edit meal routes.
- This Week is the landing page. Its dated tiles follow the configured week start day; today's tile has a distinct border. Planned tiles navigate to meal details.
- Plan Next Week must show seven dated day tiles. Each Choose action opens the meal picker for that day; selecting a meal returns to the planner with that day assigned.
- Picker and detail navigation must have contextual breadcrumbs so users can return to the correct planner/picker.
- Meal forms must require name, category, and vegetarian status. Steps and ingredients are optional. Leftovers title is conditional and required only for leftovers.
- The randomizer must produce up to seven selected days while never exceeding the vegetarian maximum. Fill remaining slots with non-vegetarian meals, reusing them if needed. Unclassified legacy meals count conservatively as vegetarian until classified. If there are no non-vegetarian meals to fill remaining slots, leave those days empty and explain this with a Material snackbar.
- Plan locking must not require approval. It must reject incomplete plans and plans above the vegetarian maximum, with Material snackbar feedback.
- Save the week-start day and vegetarian maximum together from Settings. Defaults are Wednesday and three vegetarian meals.
- Track household-global meal usage and a single household-global 1-to-10 star rating. Do not implement average ratings.
- Persist v1 data in localStorage. Do not require authentication in Phase 1.

## Non-Functional Requirements
- Simple and easy to understand architecture
- Current localStorage prototype with a clear future migration path to Firebase/Firestore
- Low-cost and low-maintenance
- Responsive mobile and desktop UI with no field/card overflow
- Clear separation between frontend logic and data access
- Easy to extend later with authentication, shopping lists, meal prep tracking, or a cloud data store
- Prefer Angular Material components over adding Tailwind for this focused Angular application

## Preferred Technology Stack

### Recommended default stack
- Frontend: Angular 17 (current implementation baseline)
- UI components: Angular Material, using outlined fields
- Routing: Angular Router with standalone page components
- Current persistence: browser localStorage behind a shared planner service
- Future hosted persistence/hosting: Firestore and Firebase Hosting
- Future deployment automation: GitHub Actions and Firebase CLI
- Authentication: deferred to Phase 2

Do not introduce Tailwind for the current scope. Use focused component SCSS and shared/global sizing rules.

## Firebase Strategy
Firebase is a future hosted-release option, not required by the current Phase 1 prototype. If adopted, use Firebase Hosting and Firestore; add Authentication only in Phase 2. Keep Cloud Functions out unless server-side logic becomes necessary.

### Authentication and session approach
- No login or approval flow in Phase 1. Keep the app low-friction for one household.
- Decide access control, session duration, and any abuse protection if Phase 2 introduces cloud storage or multi-household access.

### Design intent
Keep the frontend-first prototype lightweight. The shared planner service owns persistence and planning rules; page components own UI behavior. Preserve a future Firestore migration path without adding backend complexity now.

## Deployment Requirements
Future hosted releases may support automated deployment to Firebase using GitHub Actions. This is not part of the current localStorage prototype scope.

### Expected automation
- Trigger deployment on pushes to the main branch
- Build the frontend app automatically
- Deploy the production build to Firebase Hosting
- Use Firebase project configuration via environment variables or GitHub secrets
- Keep deployment steps simple and repeatable

### Required GitHub Actions workflow behavior
- Install dependencies
- Build the application
- Authenticate to Firebase
- Deploy to Firebase Hosting
- Fail clearly if build or deployment steps fail

### Firebase deployment considerations
- Use a Firebase project configured for hosting
- Store Firebase service account credentials securely in GitHub Secrets
- Keep environment-specific configuration separate from source code
- Ensure the app can run in both local development and CI/CD deployment modes

## Security and Configuration
- Do not commit secrets or Firebase keys directly to the repository
- Use environment variables for client configuration
- Use GitHub Actions secrets for Firebase deploy credentials
- `localStorage` persists per browser and does not synchronize the household's meals across devices; use a cloud data store if shared cross-device access becomes a requirement
- If/when Firestore is introduced, define rules for the single-household access model
- Authentication and write restrictions are Phase 2 decisions, not Phase 1 requirements
- Avoid adding approval gates or moderation steps before a user can lock in a meal plan

## Acceptance Criteria
The project is considered successful when:
- A user can add meals to the system
- A user can add/edit meals with required name, category, and vegetarian status; recipe steps remain optional
- A user can configure the week-start weekday and maximum vegetarian meals
- A user can choose meals for specific days, navigate to detail, and return through breadcrumbs
- Randomized plans respect the vegetarian cap; incomplete plans cannot be locked
- Meal Library cards clearly show household usage and dietary status, with animated ingredient/step disclosure
- Destructive deletion requires confirmation
- Meal usage is tracked and incremented when used
- Meals have one household-global 1-to-10 star rating; no average rating is needed
- Phase 1 data persists in localStorage
- The Angular app builds successfully
- Firebase deployment and CI/CD are release targets only if the hosted version is brought into scope

## Answered Questions
- One household is the initial audience; there is no multi-user/account model in Phase 1.
- Ratings and meal frequency are household-global.
- The app focuses on dinner; meal types include recipe, take away, eating out, and leftovers.
- Leftovers have an editable title; recipe steps are optional.
- Authentication is deferred to Phase 2.
- Week starts Wednesday by default, configurable in Settings.
- Maximum vegetarian meals defaults to three and is configurable from zero to seven.
- Average rating is not needed; keep the single star rating only.
- Locking requires no approval.

## Suggested Initial Implementation Scope
For version 1, keep the scope focused on:
- Add/edit meals with required name, category, and vegetarian status (default No); optional ingredients and steps; conditional leftovers title
- Meal Library with usage/diet facts, add/edit navigation, delete confirmation, and animated detail disclosure
- Dated This Week and Plan Next Week routes, configurable week start, day-specific Choose/picker/detail/breadcrumb flow
- Randomize with configurable vegetarian cap; manually choose and lock without approval, while enforcing plan constraints
- Settings panels for week start and vegetarian limit with one save action
- Household-global usage count and one 1-to-10 star rating
- Browser localStorage persistence
- Responsive Angular Material UI with inline Material validation and snackbar feedback
- Keep Firebase, CI/CD, and authentication outside Phase 1 implementation unless explicitly requested

## Notes for Future Expansion
This project can later expand to include:
- authentication and household access control (Phase 2)
- Firestore persistence and Firebase Hosting deployment
- GitHub Actions deployment
- shopping list generation
- ingredient tracking
- meal prep planning
- recurring meal plans
- nutrition tracking
- calendar integration
- meal history dashboard

## Instructions to the AI Assistant
Use this document as the project context for planning and implementation.

When creating implementation plans or code generation tasks, maintain the following goals:
- Treat Current Product Decisions, Navigation and Pages, and Functional Requirements as authoritative over generic suggestions in future planning sections.
- Keep the Angular 17/Angular Material implementation simple and maintainable; do not add Tailwind for the current scope.
- Keep page navigation, shared planner state, and persistence clearly separated.
- Use outlined Material fields, responsive layouts, inline field errors, snackbars, and confirmation dialogs. Do not use browser alerts.
- Preserve localStorage for the Phase 1 prototype; do not add authentication or Firebase integration unless Phase 2 is explicitly started.
