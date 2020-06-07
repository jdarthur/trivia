import React from 'react';
import '../homepage/Toolbar.css';
import ToolbarButton from "./ToolbarButton"

class GenericToolbar extends React.Component {

    select = (value) => {
        this.props.select(value)
    }

    render() {
        const buttons = this.props.labels.map( (label) => (
            <ToolbarButton key={label} label={label} 
             select={this.select} selected={this.props.selected === label}/> 
        ))
        return (
            <div className="toolbar">
                {buttons}
            </div>
        );
    }

}

export default GenericToolbar;