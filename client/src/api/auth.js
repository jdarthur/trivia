import { createSlice } from '@reduxjs/toolkit';
import {useSelector} from "react-redux";
import {useMemo} from "react";

const slice = createSlice({
    name: 'auth',
    initialState: { token: null },
    reducers: {
        setToken: (state, { payload: { authToken } }) => {
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

export const selectCurrentAuth = (state) => state.auth;