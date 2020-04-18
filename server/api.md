# API overview

## /game
### POST
takes
  - questionset_uuid: uuid from game editor (get the rounds/questions)
  - mod_uuid: uuid of moderator (this guy creates the game and validates answers)
  - name: descriptive name for game
returns:
  - game_uuid: uuid of game instance (this is what players reference)
  - mod_uuid: uuid of moderator (returned for convenience)

### GET: get game
 takes:
  - game_uuid: uuid of game instance
  - player_uuid: uuid of player or moderator
 returns:
  - players: list of team names
  - player_ids: list of team uuids (if player_uuid is moderator)


## /game/:uuid/team
### POST: create team 
 takes
  - team_name: string team name
 returns
  - team_uuid: id of team

### PUT: change team
 takes:
  - team_uuid: id of team
  - team_name: name of team

### DELETE: delete team
 takes:
  - team_uuid: id of team 

## /game/:uuid/question
### GET
 takes:
  - team_uuid: id of team
 returns:
   category: category of question
   question: question text
   question_id: question ID
   answer: answer (only returned if team_uuid is moderator or question is scored)

### POST (only functional if question_uuid is not scored)
  takes:
   - team_uuid: uuid of team
   - question_uuid: id of question
   - answer: answer for question
   - wager: amount to wager

### PUT (only functional if question_uuid is not scored)
  takes:
   - team_uuid: uuid of team
   - question_uuid: id of question
   - answer: answer for question
   - wager: amount to wager

### GET /game/:uuid/question/:question_uuid/status
  takes:
   - question_uuid: id of question
  returns (if not scored)
   - is_scored: false
   - status:
   		team_name1: 
   			answered: false
   		team_name2: true
   			answered: false
   		...

  returns (if scored)
   - is_scored: true
   - status:
   		team_name1: 
   			correct: false
   			answer: "not a correct answer"
   			wager: 1
   		team_name2: true
   			correct: true
   			answer: "the correct answer"
   			wager: 2
   		...

### POST /game/:uuid/question/:question_uuid/score
 takes:
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





