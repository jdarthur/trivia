import React from 'react';
import './Lobby.css';

const INVITE_LINK = "inviteLink"
class InviteLink extends React.Component {

  copy_link = () => {
    var copyText = document.getElementById(INVITE_LINK);

    copyText.select();
    copyText.setSelectionRange(0, 99999); /*For mobile devices*/

    /* Copy the text inside the text field */
    document.execCommand("copy");
  }

  invite_link = () => {
    return window.location.href.split("?")[0] + "?session_id=" + this.props.session_id
  }

  render() {
    return (
      <div className="invite" >
        <input id={INVITE_LINK} readOnly value={this.invite_link()} />
        <button onClick={this.copy_link}>Copy</button>
      </div>
    );
  }
}

export default InviteLink;