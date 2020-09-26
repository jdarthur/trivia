import React from 'react';
import './Homepage.css';

import GameName from "./GameName"

class GameNames extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      games: []
    }
  }

  componentDidMount() {
    this.get_games()
  }

  select_game = (game_id) => {
    this.props.select(game_id)
  }

  get_games = () => {
    let url = "/editor/games"
    fetch(url)
      .then(response => response.json())
      .then(state => {
        console.log(state.games)
        this.setState({ games: state.games })
      })
  }

  render() {
    const games = this.state.games.map((game) => (
      <GameName key={game.id} id={game.id} name={game.name}
        select={this.select_game} selected={this.props.selected === game.id}
        round_count={game.rounds.length} create_date={game.create_date}/>
    ))

    return (
      <div className="rem-question-list">
        {games}
      </div>
    )
  }
}

export default GameNames;