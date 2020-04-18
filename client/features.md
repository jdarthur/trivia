## Create Game button
  - you must be signed in (?)
  - select a pre-existing game that you made in the game editor
  - confirm game metadata (features enabled?, name the game?)
  - click create
     - taken to a new page

## Lobby
  -> You are game creator/moderator (base.com/:game_uuid?id=:your_uuid)
  -> if :your_uuid == :game_uuid.creator_uuid, admin mode
     -> show start game button
     -> edit rules/features, team names, delete teams
  -> if not,
     -> edit your own team name
     -> see teams in lobby

## Game -- Admin
  -> See current question/answer 
  -> see answers/wagers that teams have given
     -> click correct/incorrect on each
  -> save/score is clickable when all answers are in and marked correct/incorrect
     -> this pushes data to clients scoreboard
  -> next is clickable when saved
     -> pushes next question out to clients

## Game -- Player
  -> Scoreboard -- see team names and scores
  -> Question text
  -> answer/wager button
     -> send button
     -> can edit & send again until saved
  -> see grey[---]/yellow[?] for each team if they have sent in an answer
  -> see green/red + answers for each team when scored

## Game -- spectator
  - base.com/:game_uuid with no player ID (when game is started)
  - same as player, but no answer/wager section


URLS
---------------------------
 base.com/
   -> sign in
   -> view games
   -> game/round editor
   -> play now
 base.com/:game_uuid
   -> in lobby, show join button + teams
   -> in game, show spectator mode
   -> after game, show archived game
base.com/:game_uuid?id=:uuid
   -> in lobby, show teams + edit team name area
   -> in game, regular gameplay
   -> after game, ignore id & show archived game

