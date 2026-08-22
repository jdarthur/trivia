import React from 'react';
import './Modal.css';

interface Props {
    title: React.ReactNode
    close: () => void
    save: () => void
    save_label: React.ReactNode
    children?: React.ReactNode
}

class Modal extends React.Component<Props> {

    render() {
        return (
            <div className="modal">
                <div className="modal-title">
                    <div></div>
                    <div>{this.props.title}</div>
                    <div className="modal-close" onClick={this.props.close}>x</div>
                </div>

                {this.props.children}

                <div className="modal-footer">
                    <button className="footer-button" onClick={this.props.save}>
                        {this.props.save_label}
                    </button>

                </div>

            </div>
        );
    }
}

export default Modal;
