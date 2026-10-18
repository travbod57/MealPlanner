import { ApplicationConfig, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  FirebaseApp,
  initializeApp,
  provideFirebaseApp,
} from '@angular/fire/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  provideFirestore,
} from '@angular/fire/firestore';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { environment } from '../environments/environment';
import { routes } from './app.routes';

const firebaseProviders = environment.useFirestore
  ? [
      provideFirebaseApp(() => initializeApp(environment.firebase)),
      provideFirestore(() =>
        initializeFirestore(inject(FirebaseApp), {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
        }),
      ),
    ]
  : [];

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimationsAsync(),
    ...firebaseProviders,
  ],
};
