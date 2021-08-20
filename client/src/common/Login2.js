import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Button } from "antd"

const LoginButton = () => {
    const { loginWithRedirect } = useAuth0();

    return (
        <Button style={{ paddingLeft: 10, paddingRight: 10 }} onClick={() => {
            loginWithRedirect()}

            }>
            Log In
        </Button>
    );
};

export default LoginButton;
