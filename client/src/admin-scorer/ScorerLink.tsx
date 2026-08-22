import React from 'react';
import { ExportOutlined } from '@ant-design/icons';

interface Props {
    session_id: string
    player_id: string
}

class ScorerLink extends React.Component<Props> {

    render() {
        const url = window.location.href.split("?")[0] + "?session_id=" +
            this.props.session_id + "&player_id=" + this.props.player_id
        return (
            <a href={url} target="_blank"  rel="noopener noreferrer">
                <ExportOutlined style={{paddingRight: 5}}/>
            </a>
        );
    }
}

export default ScorerLink;
