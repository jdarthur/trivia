import React from 'react';
import '../homepage/Toolbar.css';


class ToolbarButton extends React.Component {

    select_self = () => {
        this.props.select(this.props.label)
    }

    render() {
        const cssClass = "toolbar-button" + (this.props.selected ? " selected-tab" : "")
        return (
            <div className={cssClass} onClick={this.select_self} >
                {this.props.label}
            </div>
        );
    }

}

export default ToolbarButton;