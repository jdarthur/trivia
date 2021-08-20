import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Button } from "antd"

const LogoutButton = (props) => {
    const { logout } = useAuth0();
    return (
        <Button danger style={{ paddingLeft: 10, paddingRight: 10 }} onClick={() => {
            props.set_token("");
            logout({returnTo: window.location.origin})
        }}>
            Log Out
        </Button>
    );
};

export default LogoutButton;