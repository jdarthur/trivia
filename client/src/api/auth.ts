import { createSlice } from '@reduxjs/toolkit';
import {useSelector} from "react-redux";
import {useMemo} from "react";
import type { RootState } from './store';

export interface AuthState {
  token: string | null;
}

const slice = createSlice({
    name: 'auth',
    initialState: { token: null } as AuthState,
    reducers: {
        setToken: (state, { payload: { authToken } }: { payload: { authToken: string } }) => {
            state.token = authToken;
        },
        logoutUser: (state) => {
            state.token = null;
        }
    }
});

export const useAuth = () => {
    const auth = useSelector(selectCurrentAuth);

    return useMemo(() => {
        return { ...auth };
    }, [auth]);
};


export const { setToken, logoutUser } = slice.actions;

export default slice.reducer;

export const selectCurrentAuth = (state: RootState) => state.auth;
