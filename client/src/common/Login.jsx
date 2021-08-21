import React from "react";
import { Auth0Lock } from 'auth0-lock';
import { Button, Modal, Input } from "antd"

const domain = "borttrivia.us.auth0.com"
const clientId = "03cLv60jN7hC79K8oUXHDF1wsenRTMx5"

const options = {
    additionalSignUpFields: [{
      name: "full_name",
      placeholder: "Enter your full name"
    }]
  }

class Login extends React.Component {


    state = {
        open: false,
        token: null,
        user: null
    }

    componentDidMount() {
        this.lock = new Auth0Lock(clientId, domain, options);
        this.onAuthenticated();
        console.log(this.lock)
        //this.lock.checkSession();
    }

    open = () => { this.lock.show() }
    close = () => { this.setState({ open: false }) }

    onAuthenticated() {
        console.log()
        this.lock.on('authenticated', (authResult) => {
            this.lock.getUserInfo(authResult.accessToken, (error, profileResult) => {
                if (error) {
                    // Handle error
                    console.log(error)
                    return;
                }

                const profile = profileResult;
                console.log(authResult.accessToken, profile)
                this.setState({ token: authResult.accessToken, user: profile }, () => this.lock.hide())
            });
        });
    }

    render() {
        return ((this.state.token === null) ?
            <Button onClick={this.open}>Log In</Button> :
            <div style={{display: 'flex', justifyContent: 'center', flexDirection: 'row'}}>
                <img src={this.state.user?.picture} style={{width: 40, height: 40}} />
            </div>
             )

    }

};

export default Login;
