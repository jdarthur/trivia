import React from "react";

import LoginButton from "./Login2";
import User from "./User.jsx"

import { useAuth0 } from "@auth0/auth0-react";

const AuthenticationButton = (props) => {
    const { isAuthenticated } = useAuth0();
    return <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center' }}>

        {isAuthenticated ?
            <User set_token={props.set_token} /> :
            <LoginButton set_token={props.set_token} />}

    </div>
};

export default AuthenticationButton