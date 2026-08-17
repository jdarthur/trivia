import React from "react";

import LoginButton from "./Login2";
import User from "./User.jsx"

import { useAuth0 } from "@auth0/auth0-react";
import {Spin} from "antd";

const AuthenticationButton = (props) => {

    const { isAuthenticated } = useAuth0();

    if (props.loading) {
        return <Spin size="small" />
    }

    if (isAuthenticated) {
        return <User />
    }
    return <LoginButton />
};

export default AuthenticationButton