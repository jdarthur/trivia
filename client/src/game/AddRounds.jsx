import React from 'react';
import '../modal/Modal.css';

import RoundInGame from "./RoundInGame"
class AddRounds extends React.Component {

    constructor(props) {
        super(props)
        this.state = {
            rounds: []
        }
    }

    componentDidMount() {
        this.get_rounds()
    }

    get_rounds = () => {
        let url = "/editor/rounds?unused_only=true"
        fetch(url, {headers:{"borttrivia-token": this.props.token}})
            .then(response => response.json())
            .then(state => {
                this.setState({rounds: state.rounds})
            })
    }

    select_item = (round_id) => {
        const current = [...this.props.selected_rounds]
        const index = current.indexOf(round_id)
        if (index === -1) {
            current.push(round_id)
        } else {
            current.splice(index, index + 1)
        }

        this.props.set_rounds(current)
    }

    render() {
        const rounds = []
        for (let i = 0; i < this.state.rounds?.length; i++) {
            const round = this.state.rounds[i];
            if (this.props.rounds.indexOf(round.id) === -1) {
                rounds.push(<RoundInGame key={round.id} id={round.id}
                                         select={this.select_item}
                                         selected={this.props.selected_rounds.indexOf(round.id) !== -1}
                                         index={this.props.selected_rounds.indexOf(round.id)} show_title={true}
                                         addable={true} token={this.props.token}/>)
            }
        }
        return (
            <div style={{display: "flex", flexDirection: "row", flexWrap: "wrap"}}> {rounds} </div>
        );
    }
}

export default AddRounds