import React, { useEffect, useState } from "react";

import { Popover } from 'antd'
import { useAuth0 } from "@auth0/auth0-react";
import LogoutButton from "./Logout2";

const User = (props) => {

    const { user, getAccessTokenSilently } = useAuth0();
    useEffect(() => {
        const getEditorJwt = async () => {
          const domain = "borttrivia.us.auth0.com";

          try {
            const accessToken = await getAccessTokenSilently({
              audience: `https://borttrivia.com/editor`,
              scope: "read:current_user",
            });
            console.log(accessToken)
            props.set_token(accessToken)

          } catch (e) {
            console.log(e.message);
          }
        };

        getEditorJwt();
      }, [getAccessTokenSilently, user?.sub]);

    const { name, picture, email } = user;

    console.log(user)

    const content = <div style={{display: 'flex', flexDirection: 'row', justifyContent: 'center'}}>
        <LogoutButton set_token={props.set_token}/>
    </div>

    return (
        <Popover content={content} title={name} trigger="click" placement="right">
            <img src={picture} alt={name} style={{ width: 40, height: 40, cursor: 'pointer' }} />
        </Popover>

    );
};

export default User;