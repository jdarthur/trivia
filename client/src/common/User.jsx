import React, {useEffect} from "react";

import {Popover} from 'antd'
import {useAuth0} from "@auth0/auth0-react";
import LogoutButton from "./Logout2";

import {useDispatch} from 'react-redux';
import {setToken} from '../api/auth';

const User = (props) => {

    const {user, getAccessTokenSilently} = useAuth0();

    const dispatch = useDispatch();

    const userSub = user?.sub
    useEffect(() => {
        const getEditorJwt = async () => {

            try {
                const token = await getAccessTokenSilently({
                    audience: `https://borttrivia.com/editor`,
                    scope: "read:current_user",

                });
                dispatch(setToken({token}));
                props.set_token(token)
            } catch (e) {
                console.log(e.message);
            }
        };

        getEditorJwt();
    }, [getAccessTokenSilently, userSub]); // eslint-disable-line react-hooks/exhaustive-deps

    const {name, picture} = user;

    const content = <div style={{display: 'flex', flexDirection: 'row', justifyContent: 'center'}}>
        <LogoutButton set_token={props.set_token}/>
    </div>

    return (
        <Popover content={content} title={name} trigger="click" placement="bottomRight">
            <img src={picture} alt={name} style={{width: 40, height: 40, cursor: 'pointer'}}/>
        </Popover>

    );
};

export default User;