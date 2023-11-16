import React, {useEffect} from "react";

import {Popover} from 'antd'
import LogoutButton from "./Logout2";
import {useAuth0} from "@auth0/auth0-react";


const User = () => {

    const {user} = useAuth0();
    const {name, picture} = user;

    const content = <div style={{display: 'flex', flexDirection: 'row', justifyContent: 'center'}}>
        <LogoutButton />
    </div>

    return (
        <Popover content={content} title={name} trigger="click" placement="bottomRight">
            <img src={picture} alt={name} style={{width: 40, height: 40, cursor: 'pointer'}}/>
        </Popover>

    );
};

export default User;