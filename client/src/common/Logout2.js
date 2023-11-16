import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Button } from "antd"
import {useDispatch} from "react-redux";
import {setToken} from "../api/auth";

const LogoutButton = (props) => {
    const { logout } = useAuth0();
    const dispatch = useDispatch()


    const handleLogout = () => {
        const token = ""
        dispatch(setToken({token}))
        logout({returnTo: window.location.origin})
    }

    return (
        <Button danger style={{ paddingLeft: 10, paddingRight: 10 }}
                onClick={handleLogout} >
            Log Out
        </Button>
    );
};

export default LogoutButton;