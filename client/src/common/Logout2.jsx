import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Button } from "antd"
import {useDispatch} from "react-redux";
import {logoutUser} from "../api/auth";

const LogoutButton = (props) => {
    const { logout } = useAuth0();
    const dispatch = useDispatch()


    const handleLogout = () => {
        dispatch(logoutUser())
        if (props.mock) {
            // Mock mode has no Auth0 session to end. Drop the mockUser param
            // too, so a reload doesn't log straight back in.
            const url = new URL(window.location.href);
            url.searchParams.delete("mockUser");
            window.history.replaceState({}, "", url.toString());
            return
        }
        logout({logoutParams: {returnTo: window.location.origin}})
    }

    return (
        <Button danger style={{ paddingLeft: 10, paddingRight: 10 }}
                onClick={handleLogout} >
            Log Out
        </Button>
    );
};

export default LogoutButton;