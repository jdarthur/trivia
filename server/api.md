# API overview
Main sections:

 - Gameplay
 - Editor

# Gameplay
## /game
### POST
takes
```
questionset_uuid: uuid from game editor (get the rounds/questions)
mod_uuid: uuid of moderator (this guy creates the game and validates answers)
name: descriptive name for game
```
returns:
```
game_uuid: uuid of game instance (this is what players reference)
mod_uuid: uuid of moderator (returned for convenience)
```

### GET: get game
 takes:
```
game_uuid: uuid of game instance
player_uuid: uuid of player or moderator
```
 returns:
```
players: list of team names
player_ids: list of team uuids (only returned if player_uuid is moderator)
game: list of all questions and answers (only returned if player_uuid is moderator)
```


## /game/:uuid/team
### POST: create team 
 takes
```
team_name: string team name
```
 returns
```
team_uuid: id of team
```

### PUT: change team
 takes:
```
team_uuid: id of team
team_name: name of team
```
### DELETE: delete team
 takes:
```
team_uuid: id of team 
```

## /game/:uuid/question
### GET
 takes:
```
team_uuid: id of team
```
 returns:
``` 
   category: category of question
   question: question text
   question_id: question ID
   answer: answer (only returned if team_uuid is moderator or question is scored)
```

### POST (only functional if question_uuid is not scored)
takes:
```
team_uuid: uuid of team
question_uuid: id of question
answer: answer for question
wager: amount to wager
```

### PUT (only functional if question_uuid is not scored)
takes:
```
team_uuid: uuid of team
question_uuid: id of question
answer: answer for question
wager: amount to wager
```

### GET /game/:uuid/question/:question_uuid/status
  takes:
```
game_uuid: id of game
question_uuid: id of question
```
returns (if not scored)
```
is_scored: false
status:
 	team_name1: 
   		answered: false
   	team_name2: true
   		answered: false
   	...
```
returns (if scored)
```
is_scored: true
status:
   	team_name1: 
   		correct: false
   		answer: "not a correct answer"
   		wager: 1
    team_name2: true
   		correct: true
   		answer: "the correct answer"
   		wager: 2
   	...
```
### POST /game/:uuid/question/:question_uuid/score
takes:
```
team_uuid: uuid of player -- must be mod
score:
    team_uuid1: 
   		correct: false
   		answer: "not a correct answer"
   		wager: 1
   	team_uuid2:
   		correct: true
   		answer: "the correct answer"
   		wager: 2
   	...

```
returns: 
```
   success only if player UUID is the mod and question ID is valid
```

### PUT /game/:uuid/set-question
 takes:
``` 
   question_uuid: ID of question to change to
   player_uuid: UUID of player
```
 returns: 
```
   success only if player UUID is the mod and question ID is valid
```
### GET /game/:uuid/scoreboard
returns:
```
scoreboard	
    team_name1: 22
    team_name2: 33
    ...
```



# Editor
## /editor/game
create, edit or delete a game

### GET /editor/games
returns list of all games

### GET /editor/game/:id
returns 
```
name: name of the game
rounds: list of round IDs
```

### POST /editor/game
takes:
```
name: name of the game
rounds: list of round IDs
```
returns:
```
game_uuid: id of game
```

### PUT /editor/game
takes:
```
game_uuid: ID of game
name: name of the game
rounds: 
	- name: round1
	  id: round ID
	- name: round2
	  id: round ID2
	- name: bonus round
	  id: round ID3
```

### DELETE /editor/game
takes:
```
game_uuid: ID of game
```



## /editor/round
create, edit or delete a round

### GET /editor/rounds
returns list of all rounds

### GET /editor/round/:id
returns 
```
name: name of the round
questions: list of question IDs
wagers: list of available wagers
```

### POST /editor/round
takes:
```
name: name of the round
questions: list of question IDs
wagers: list of available wagers (must be same size as questions list!)
```
returns:
```
round_uuid: id of round
```

### PUT /editor/game
takes:
```
name: name of the round
questions: list of question IDs
wagers: list of available wagers (must be same size as questions list!)
```

### DELETE /editor/round
takes:
```
round_uuid: ID of round
```



## /editor/question
create, edit or delete a question

### GET /editor/questions
returns list of all questions

### GET /editor/question/:id
returns 
```
category: category of question
question: question text
answer: answer for question
answer_count: number (default 1)
```

### POST /editor/question
takes:
```
category: category of question
question: question text
answer: answer for question
answer_count: number (default 1)
```
returns:
```
question_uuid: id of question
```

### PUT /editor/question
takes:
```
question_id: ID of question
category: category of question
question: question text
answer: answer for question
answer_count: number (default 1)
```

### DELETE /editor/question
takes:
```
question_uuid: ID of question
```


