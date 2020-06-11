import React from 'react';
import './Modal.css';
import Modal from "./Modal"
import AddableQuestionsList from "../round/AddableQuestionsList"

class AddQuestionsModal extends React.Component {

    constructor(props) {
        super(props)
        this.state = {
            questions: [],
            selected_questions: [],
            is_open: false
        }
    }

    close_modal = () => {
        this.setState({ is_open: false })
    }

    open_modal = () => {
        this.setState({ is_open: true })
    }



    render() {
        if (this.state.is_open === true) {
            return (
                <Modal is_open={this.state.is_open}
                    close={this.close_modal} transitionName="modal-anim"
                    title="Add Questions">
                    <div className="body">
                        <AddableQuestionsList added_questions={this.props.questions}
                            add_questions={this.props.add_questions} />
                    </div>
                </Modal>
            );
        }
        else {
            return (<button onClick={this.open_modal}>Add questions</button>)
        }
    }
}

export default AddQuestionsModal;