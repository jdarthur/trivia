import React from "react";

import LoginButton from "./Login2";
import LogoutButton from "./Logout2";
import User from "./User.jsx"

import { useAuth0 } from "@auth0/auth0-react";

const AuthenticationButton = () => {
    const { isAuthenticated } = useAuth0();

    return <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center' }}>

        {isAuthenticated ? <User /> : <LoginButton />}

    </div>
};

export default AuthenticationButton