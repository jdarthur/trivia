import React from 'react';
import '../modal/Modal.css';
import { Modal, Button } from 'antd';

import RoundInGame from "./RoundInGame"

class AddRoundsModal extends React.Component {

    constructor(props) {
        super(props)
        this.state = {
            rounds: [],
            selected_rounds: [],
            is_open: false
        }
    }

    componentDidMount() {
        this.get_rounds()
    }

    get_rounds = () => {
        let url = "/editor/rounds?unused_only=true"
        fetch(url)
            .then(response => response.json())
            .then(state => {
                console.log("got rounds in addable rounds")
                console.log(state)
                this.setState({ rounds: state.rounds })
            })
    }


    close_modal = () => {
        this.setState({ is_open: false, selected_rounds: [], })
    }

    open_modal = () => {
        this.setState({ is_open: true }, () => {
            this.get_rounds()
        })
    }

    select_item = (round_id) => {
        const index = this.state.selected_rounds.indexOf(round_id)
        if (index === -1) {
            this.state.selected_rounds.push(round_id)
        }
        else {
            this.state.selected_rounds.splice(index, index + 1)
        }
        this.setState({ selected_rounds: this.state.selected_rounds })
    }

    add_rounds_and_close = () => {
        this.props.add_rounds(this.state.selected_rounds)
        this.close_modal()
    }

    render() {
        if (this.state.is_open === true) {

            const rounds = []
            for (let i = 0; i < this.state.rounds.length; i++) {
                const round = this.state.rounds[i];
                if (this.props.rounds.indexOf(round.id) === -1) {
                    rounds.push(<RoundInGame key={round.id} id={round.id}
                        select={this.select_item} selected={this.state.selected_rounds.indexOf(round.id) !== -1}
                        index={this.state.selected_rounds.indexOf(round.id)} show_title={true} />)
                }
            }
            return (
                // <Modal is_open={this.state.is_open}
                //     close={this.close_modal} transitionName="modal-anim"
                //     title="Add Rounds" save_label="Add" save={this.add_rounds_and_close}>
                //     <div className="body">
                //         <div className="question-list">
                //             {rounds}
                //         </div>
                //     </div>
                // </Modal>

                <Modal
                    title="Add Rounds"
                    visible={this.state.is_open}
                    onOk={this.add_rounds_and_close}
                    okText="Add"
                    onCancel={this.close_modal}
                    width="50vw">

                    <div className="rem-question-list">
                        {rounds}

                    </div>

                </Modal>
            );
        }
        else {
            return (
                <Button type="primary" onClick={this.open_modal}>
                    Add rounds
                </Button>)
        }
    }
}

export default AddRoundsModal;