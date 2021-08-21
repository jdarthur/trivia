import React from "react";

import LoginButton from "./Login2";
import User from "./User.jsx"

import { useAuth0 } from "@auth0/auth0-react";

const AuthenticationButton = (props) => {
    const { isAuthenticated } = useAuth0();
    if (isAuthenticated) {
        return <User set_token={props.set_token} />
    }
    return <LoginButton set_token={props.set_token} />
};

export default AuthenticationButton