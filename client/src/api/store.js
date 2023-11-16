import { configureStore } from '@reduxjs/toolkit';
import storage from 'redux-persist/lib/storage';
import { combineReducers } from '@reduxjs/toolkit';
import { persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import authReducer from './auth.js';
import { createReduxHistoryContext } from 'redux-first-history';
import { createBrowserHistory } from 'history';
import {baseQuery, mainApi} from './main';
import {createApi} from "@reduxjs/toolkit/query/react";

export const api = createApi({
    reducerPath: 'authApi',
    baseQuery: baseQuery,
    endpoints: (builder) => ({
        login: builder.mutation({
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

export const history = createReduxHistory(store);
