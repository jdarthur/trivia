import { createSlice } from '@reduxjs/toolkit';

const slice = createSlice({
    name: 'auth',
    initialState: { token: null },
    reducers: {
        setToken: (state, { payload: { token } }) => {
            console.log(token)
            state.token = token;
        },
        logoutUser: (state) => {
            state.token = null;
        }
    }
});

export const { setToken, logoutUser } = slice.actions;

export default slice.reducer;