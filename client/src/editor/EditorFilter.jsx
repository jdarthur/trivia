import React from 'react';
import './Editor.css';

class EditorFilter extends React.Component {

    set_unused_only = (event) => {
        const value = event.target.checked
        this.props.set_unused_only(value)
    }

    set_text_filter = (event) => {
        const value = event.target.value
        this.props.set_text_filter(value)
    }


    render() {
        return (
            <div className="filter_holder">
                <div className='filter'>
                    <div className="filter_subitem"> Text filters: </div>
                    <div className="filter_subitem">
                        <input name="text_filter" value={this.props.text_filter} onChange={this.set_text_filter} placeholder="Text filters" />
                    </div>
                </div>

                <div className="filter">
                    <div className="filter_subitem">  Unused {this.props.data_type} only </div>
                    <div className="filter_subitem">
                        <input type="checkbox" name="unused_only" checked={this.props.unused_only} onChange={this.set_unused_only} />
                    </div>
                </div>
            </div>
        );
    }
}

export default EditorFilter;