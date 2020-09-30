import React from 'react';
import { ExportOutlined } from '@ant-design/icons';

class ScorerLink extends React.Component {

    render() {
        const url = window.location.href.split("?")[0] + "?session_id=" +
            this.props.session_id + "&player_id=" + this.props.player_id
        return (
            <a href={url} target="_blank">
                <ExportOutlined style={{paddingLeft: 5}}/>
            </a>
        );
    }
}

export default ScorerLink;