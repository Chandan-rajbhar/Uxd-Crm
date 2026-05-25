import { configureStore } from '@reduxjs/toolkit';
import projectsReducer from './slices/projectsSlice';
import clientsReducer from './slices/clientsSlice';
import employeesReducer from './slices/employeesSlice';

import projectChatReducer from './slices/projectChatSlice';
import appsReducer from './slices/appsSlice';
import blogsReducer from './slices/blogsSlice';
import blogProjectsReducer from './slices/blogProjectsSlice';
import assetsReducer from './slices/assetsSlice';


import emailTemplatesReducer from './slices/emailTemplatesSlice';
import signaturesReducer from './slices/signaturesSlice';
import settingsReducer from './slices/settingsSlice';

export const store = configureStore({
    reducer: {
        projects: projectsReducer,
        clients: clientsReducer,
        employees: employeesReducer,

        projectChat: projectChatReducer,
        apps: appsReducer,
        blogs: blogsReducer,
        blogProjects: blogProjectsReducer,
        assets: assetsReducer,

        emailTemplates: emailTemplatesReducer,
        signatures: signaturesReducer,
        settings: settingsReducer,
    },
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
