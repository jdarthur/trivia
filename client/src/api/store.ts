import { configureStore } from '@reduxjs/toolkit';
import storage from 'redux-persist/lib/storage';
import { combineReducers } from '@reduxjs/toolkit';
import { persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import authReducer from './auth';
import { createReduxHistoryContext } from 'redux-first-history';
import { createBrowserHistory } from 'history';
import {baseQuery, mainApi} from './main';
import {createApi} from "@reduxjs/toolkit/query/react";
import type { Session } from '../types/models';

export const api = createApi({
    reducerPath: 'authApi',
    baseQuery: baseQuery,
    endpoints: (builder) => ({
        login: builder.mutation<Session, Partial<Session>>({
            query: (credentials) => ({
                url: 'session',
                method: 'POST',
                body: credentials
            })
        })
    })
});

const { createReduxHistory, routerMiddleware, routerReducer } = createReduxHistoryContext({
    history: createBrowserHistory()
});

const reducers = combineReducers({
    router: routerReducer,
    [api.reducerPath]: api.reducer,
    [mainApi.reducerPath]: mainApi.reducer,
    auth: authReducer,
});

const persistConfig = {
    key: 'borttrivia',
    storage,
    whitelist: ['auth']
};

const persistedReducer = persistReducer(persistConfig, reducers);

export const store = configureStore({
    reducer: persistedReducer,
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER]
            }
        }).concat(api.middleware, mainApi.middleware, routerMiddleware)
});

// The single history instance for the app. This is the redux-enhanced history,
// so it must be what <HistoryRouter> navigates with -- otherwise the router and
// the `router` slice of the store track two different histories.
export const history = createReduxHistory(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
