import React from 'react';
import './Modal.css';

class Modal extends React.Component {

    render() {
        if (this.props.is_open) {
            return (
                    <div className="modal">
                        <div className="modal-title">
                            <div></div>
                            <div>{this.props.title}</div>
                            <div className="modal-close" onClick={this.props.close}>x</div>
                        </div>
                        {this.props.children}
                    </div>
            );
        }
        else {
            return null;
        }
    }
}

export default Modal;