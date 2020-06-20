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
        this.setState({ games: state.games })
      })
  }

  render() {
    const games = this.state.games.map((game) => (
      <GameName key={game.id} id={game.id} name={game.name}
        select={this.select_game} selected={this.props.selected === game.id}/>
    ))

    // const games = this.state.games.map((game, index) => (
    //   <Game key={game.id} id={game.id} name={game.name} create_date={game.create_date}
    //       rounds={game.rounds} round_names={game.round_names}
    //       selected={(this.state.selected === game.id) ? true : false}
    //       set_selected={this.set_selected} delete={this.delete} />))

    return (
      <div>
        {games}
      </div>
    )
  }
}

export default GameNames;