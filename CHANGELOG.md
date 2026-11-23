# Changelog

## Hunt: jail fixes, slower monster strikes, smoother movement

Files changed: `hunt.js`.

- Bug: the move into the jail cell (and back out) ran only in `applyState`, when a state message from the host changed `jailed`. The host never receives its own state, so a host who was caught as a survivor stayed free (counted as jailed, so the monster could not catch them: "invincible"). When freed, they stayed inside the cell. The move now runs in `step()` every frame from `L.myJ`: a jailed survivor is always put inside the cell, and a freed one is put outside the door. A free survivor found inside the cell after it opens is put outside.
- Escaping the jail alone takes 2 minutes (was 90 s), with a countdown in the jailed player's hint line.
- Monster strike cooldown 1.1 → 1.7 s (slower than the 1.2 s crossbow).
- Remote players: their drawn position glides to the predicted one (smoothing small corrections instead of jumping), and prediction stops after 3.2 s without news, so a stalled player is not run off into the distance and then snapped back.

## Fix: stuck in place after "이야기 이어하기" (story mode)

Files changed: `mansion.js`, `hunt.js`.

- Bug: `saveNow()` saved `ST` but never updated `ST.x/ST.y`. They stayed at the new-game spot in the hall. If the tab or app was closed without the 나가기 button, the save kept that position. On resume you stood at the hall's coordinates in another room, often inside a wall, and could only turn on the spot. `saveNow()`/`snapshot()` now record where you really stand (in front of the furniture while hidden).
- `unstick()`: after loading a room, resuming or restoring, and every frame if you are inside a wall or furniture, the player steps to the nearest free spot. Old broken saves are repaired the same way.
- Hunt: the same safety in `step()`. A player inside a wall or furniture (after a knock-back, a teleport or a bad sync) is moved to the nearest free spot.

## Hunt, round 3: new map layouts, the floating face, secret passages, energy drinks, fixes

Files changed: `hunt.js`, `mansion.js`, `index.html` (the previous hunt patch, with the aim stick and the map-sync fix, had not been uploaded; it is included).

- Bug: a movement key held while clicking into the chat box stayed "held", because its keyup was ignored while typing. Now a keyup always clears the key, and `releaseKeys()` runs on window blur, on focus moving into an input, and when the tab is hidden.
- Hiding/unhiding with Enter checked on a non-host survivor: hides at once on every screen, comes out in front of the furniture, and can walk away.
- Maps (`genMap`): 5x3 cells (66x36 tiles) instead of 4x3 small rooms joined by narrow tunnels. Room kinds: plain, small closet, pillared hall, courtyard with a block in the middle, L-shaped, and long two-cell galleries with pillar rows. Corridors are 2 or 3 tiles wide, with extra loops. Still only the seeded `R`. Flood-filled: every key/ladder/spawn/hide/drink/passage point is reachable from the cell door.
- New: two **secret passages** per map (`M.passages`; a bookcase with a purple glint, survivors only, Enter teleports to the far bookcase, 6 s cooldown), and three **⚡ energy drinks** (`G.boost`; walk over one for 1.4x speed for 4 s, back after 25 s). Both show on the survivors' minimap only.
- The monster's minimap no longer shows the ladder pieces (it never showed survivors).
- Monsters: four looks, picked at random each game (two monsters never share one); there is no lobby picker. `LOOK` in `hunt.js` holds each look's hit box and label heights.
  - `crawl` 거미손: the crawler.
  - `face` 떠도는 얼굴: the screaming face from the user's art, floating with bob, sway, flicker and after-images (`drawFace`).
  - `hand` 바닥손 and `eye` 핏눈알 use 8- and 10-frame sprite sheets cut from the user's reference sheet (`HAND_SHEET`, `EYE_SHEET`), plus states drawn in code.
    - Hand: IDLE writhes between frames on random holds. CRAWL advances one frame per 4.4 px moved (3.2 px when close). SCRATCH flicks two frames and leaves scratch marks. TWITCH pushes one band sideways. SPREAD flings the fingers open when close. The wrist sits in a blood pool and a broken hole and never bobs.
    - Eye: ROLL turns frames with the signed distance rolled (faster movement means faster spin, backwards when going left). STOP snaps a dark-red iris to the front, and its pupil follows `opt.look` (the player). TWITCH (when close) shudders the ball and darts the pupil. It leaves a blood smear.
    - Sounds near survivors: nails scratching (hand), a wet roll (eye), skittering (crawler).
  - All four are drawn by `drawMon` in `mansion.js`. `monOpts()` in `hunt.js` passes `look` (who the eye stares at) and `rage` (within 90 px).
- Balance: bolt cooldown 2.5 → 1.2 s, stun 2 → 0.8 s (with 1 s of immunity after it), monster HP 30 → 60 (more arrows now), bolt hit boxes are wider (crawler ±25 px, face ±17 px).

## Hunt balance patch, phone aim stick, stun, seeing the monster, a map sync fix

Files changed: `hunt.js`, `index.html`. No SQL.

- **Bug (old): screens built different maps.** `genMap` used `shuffle()` and `pick()` (Math.random) for wall decorations. Each client placed hiding spots and furniture in different places, so the host rejected hides ("too far"), people walked through furniture on other screens, and hiding or coming out seemed to fail. Map generation now uses only the seeded `R` (`shuffleR`). Checked: three separate page loads produce identical maps, and all three maps are still fully connected.
- Hiding/unhiding takes effect at once on your own screen (`keepMine` keeps that answer against a host state that was sent just before the host heard you). Coming out puts you on the nearest free spot in front of the hiding place (`stepOut`); before, you came out inside the solid furniture.
- Phones: the 🏹 button is now an aim stick (`aimStick`). Drag to aim (a dotted line shows the shot), let go to fire; a quick tap auto-aims at the nearest visible target. Monsters use it to strike. On a computer, clicking the game fires towards the mouse, and Space now snaps onto a target within about 30° of where you face (`aimDir`).
- Phone layout: the sticks are drawn over the game instead of under it. The view stretches to the screen's shape (`VW`/`VH` set in `fit()`, at most 440 world px), so nothing is cut off. The hint line moves above the sticks on narrow screens.
- Arrows stun: `G.stun[id]` holds when the stun ends. A hit stuns for 2 s (`STUN_MS`), and the monster cannot be stunned again for 1.5 s after it wakes (`STUN_IMMUNE`). A stunned monster cannot move or strike, and spinning stars and "💫 기절" show over it.
- Seeing the monster: the survivor light is 118 (was 92) and the monster light 100 (was 106). Within 260 px (`SENSE_R`), survivors see the monster's red eyes in the dark, a blinking red dot on the minimap, and a red arrow with a distance at the edge of the screen.
- Ladder pieces are on the map from the start.
- Balance: monster HP 50 → 30, bolt cooldown 3 → 2.5 s, monster strike cooldown 0.9 → 1.1 s, strike reach 24 → 20. Survivor speed 66 → 68. The monster speeds up +3% a minute (was +4% every 40 s), at most +12% (was +28%). Ladder install 3 → 2 s. The key comes back after 8 s (was 15). Anyone in the jail for 45 s gets out on their own (`SELF_FREE_MS`), so camping the jail does not win.

## Fix: clicking did nothing outside (plaza, forest paths, mansion yard)

Files changed: `app.js`.

- Spots with no `item` and no `hit` (the forest path exits) had no click box, so `spots.find(sp => … sp.hit[0] …)` threw on every click and every mouse move in those scenes. Click-to-walk and click-to-use both broke. Spot setup now gives such spots a default box around `x, y, r`.

## Longer story: the clinic, the moonlight greenhouse, Yuri turns; back-to-plaza button

Files changed: `mansion.js`, `app.js`, `index.html`. No SQL.

- Jump scares now happen only when you are caught. The crawler and the other monsters no longer flash a face when they appear.
- `#plazaBtn` (🏙️ 광장으로) sits in the action bar on every scene past the plaza (`PAST_PLAZA`: forest1, forest2, mansion) and goes straight to the plaza. Add new outside scenes to `PAST_PLAZA`.
- The story has a new second half after the basement chase:
  - The crawler takes Yuri to the new **지하 처치실** (`clinic`, through the south door of `b1hall`), not to the jail. The guard's desk now also gives the `clinicKey`, and her empty cell has her hairpin.
  - On the clinic's operating table she wakes up infected (`yuriInfected`). She follows you but looks grey-blue (`drawPerson` with `opt.blue`), twitches and says wrong things. The last lab page (`labNotes2`) explains the cure.
  - The cure needs a book from the attic trunk, put back into the library's gap shelf (`greenhouseOpen`). That opens the **달빛 온실** (`greenhouse`). Its lily blooms with a 4-moon dial (`leverPuzzle` now takes options; answer `2310`, from the child's room moon drawing). Jar 14 comes from the study (`dialPuzzle` now takes any length). The two are mixed at the lab table into the `antidote`.
  - Carrying the lily while infected Yuri follows makes her turn (`yuriTurns()`) in the next room. It starts a crawler chase from about 96px away. Hun-i and Cheol-su flee to the hall.
  - Playing the child's music box with the antidote draws her in slowly (`opt.calm` monsters creep at 0.32x and never catch you). Next to you, you choose: give the antidote (cured), or run (a normal chase, and you can try the music box again). If you made the antidote before she turned, you can also give it to her by talking to her.
  - In the hall the group comes back together (`regroup`).
- Endings: the true ending (everyone, including cured Yuri), the new **엔딩 C** (leave with Hun-i and Cheol-su but not Yuri), and B (alone). An infected Yuri does not count as rescued.
- New floor `grass`, wall `glass`, furniture `opTable`, `ivStand`, `lilyStand`, `moonbeam`, `pot`, painting art `moons`.

## New crawler art and motion, jump scares, how-to-play guide

Files changed: `mansion.js`, `hunt.js`, `index.html`. No SQL.

- 거미손 (`crawl`) now uses the user's new crawler art: `CRAWL_SHEET` is a 44x36, 5-frame sheet per direction (down, left, right, up), cut from their drawing, with holes filled and the black background removed. `FACE_SRC` holds four close-up faces from their art (the crawler's portrait, plus faces A, C and D from their concept sheet for 물끄러미, 히죽이 and 아우성).
- `drawMon()` was rewritten so the monsters no longer glide. Each monster keeps state through `opt.key` (the `mon` object in the story, `'h' + id` in the hunt). Frames advance unevenly, with skips and long holds. Every 0.6–2.3 s one horizontal third of the sprite jumps sideways for a blink, more often when it is close (`rage`). Fast movement leaves after-images. The walkers rock on a stiff limp, and their head (top 27% of the sprite) snaps to one side around the neck now and then.
- In the story, the crawler moves in bursts: a 1.85x lunge for 380 ms, a 240 ms frozen beat, then normal speed. On average it is as fast as before. Every monster waits 0.7 s after it appears before it moves. Moving monsters make sound: skittering for the crawler, uneven thuds for the walkers, and a throat croak when they are near. `jumpScare(kind)` shows the face full-screen with a flicker and a scream when a chase starts (or when the monster comes through the door), and a longer one when you are caught.
- `showGuide()` shows a how-to-play panel once, right after the opening scene of a new story, and from a 📜 button in the bag. Enter or Space closes it.
- Hunt: the crawler's name label and hit box are adjusted to the new sprite size.

## Fix: could not climb to the attic

Files changed: `mansion.js`.

- With the ladder down, standing under it and looking up hit the hatch first (objects were checked in list order and the first match won), and the hatch did nothing once open. `interact()` and the bubble highlight now use `pickAt()`, which takes the touching object whose middle is closest, and the open hatch itself climbs to the attic.

## Sound warnings, dress-shoe steps, story music and "…" bubbles

Audience: the developer and the developer's AI agent.

Files changed: `app.js`, `mansion.js`. No SQL.

- The plaza's forest exit opens `openForestWarn()` first (sound warning, solo path) instead of walking straight in. The mansion door's story buttons show a horror/jump-scare/sound warning before `openStory()`.
- Rain is about half as loud. Footsteps (lounge `footstep()` and story `SFX.step`) are a heel click plus a sole slap 75 ms later, one step per 380 ms. The safe dial uses a separate `tick` sound.
- `mansion.js` `bgm()`: a drone (55 Hz with a tritone), filtered wind, and a detuned music box every 6–15 s. It starts with the story, stops on close or when sound is turned off, and drops to a quarter of its volume while `chaseMusic` plays.
- Story mode draws a "…" bubble over every object with a `use` (door bars only on the cell doors) and every NPC who is not following you, within 78px. The one you are facing turns yellow. Bubbles are drawn under the darkness, so unlit rooms still hide them.

## Rain, footsteps, walking the forest alone

Audience: the developer and the developer's AI agent.

Files changed: `app.js`. No SQL.

- `forest1`, `forest2` and `mansion` have rain: `drawRain()` draws streaks and splashes over the scene, and `ambTick()` (called from `drawWorld`) keeps a looped pink-noise bed (hiss + low rumble), random drop clicks, thunder after the mansion's lightning (and now and then in `forest2`), and a heel "tock" for each step of anyone walking within 150px. The rain is muffled while the story or the hunt is open (indoors) and goes silent when the tab is hidden. It follows the 🔊 button.
- `SOLO = { forest1, forest2 }`: on those scenes `sceneTopic()` returns `lounge:<scene>-<uid>`, so each person walks the forest in a private copy (still matches the `lounge:%` channel policy). The chat feed and history are skipped there and the chat box is locked (`chatLock()`). Everyone is visible again in `mansion`.

## Outside: plaza, forest paths, the mansion (story + hunt), app install

Audience: the developer and the developer's AI agent.

Files changed: `app.js`, `games.js`, `index.html`, `setup.sql`, `update-rooms.sql`, `README.md`. Files added: `mansion.js`, `hunt.js` (and earlier `manifest.json`, `sw.js`, icons).

### New scenes

- `plaza`, `forest1`, `forest2`, `mansion` in `SCENES`, reached from the 1F hall's outside door. The plaza's other exits are locked spots. The forests are drawn by `forestScene()` with a `decay` value that runs from 0 to 1 along the path. `scene.fx(b, now)` is a new per-frame overlay hook in `drawWorld` (darkness, fog, lightning). `spot.go = [scene, spawnKey]` moves between scenes.
- These four scenes, plus `f1r4`, are added to the chat whitelist in `messages_before_insert`. `f1r4` was missing, so chat in the wilderness room was being refused.

### `mansion.js` – story mode

- Solo, no network. 16 rooms, ASCII maps on 16px tiles, BFS chasing monsters, hiding places, three puzzles, two endings. Save in `localStorage` (`onl_mansion_story_v1`). `ONL_MANSION.kit` exposes the drawing/collision helpers that `hunt.js` reuses.

### `hunt.js` – multiplayer

- Registered with the table framework (`window.ONL_TG`, exported from `games.js`). `MAX_PLAYERS = 6` because Supabase Free allows 100 messages/s and each broadcast counts N+1. On Pro it can go to 10.
- Each client owns its own position and sends `hm` only when its direction changes (at most every 180 ms) plus a 2.5 s heartbeat; others dead-reckon with the same collision. The host is the referee for `ha` actions (hit, catch, pick up, free, install, escape), and the action carries the sender's position. The host pushes `hs` state on change or every 3 s. Measured: six players moving at random use about 10 broadcasts/s, about 60/s counted by Supabase.
- Maps are generated from fixed seeds, so every client builds the same map without sending it. All three are checked with a flood fill: every floor tile, key point, ladder point, spawn and hiding place is reachable from the cell door.

### Other

- `games.js`: the lobby now draws its chat (`drawChat()` at the end of `render()`); before, the placeholder stayed on "구경 중".

## Wilderness, spectating, turn clock, hand-drawn digits

Audience: the developer and the developer's AI agent.

Files changed: `app.js`, `games.js`, `index.html`, `wilderness.js`, `setup.sql`. File added: `scores.sql`.

### Faults fixed

- **Spectating did nothing.** The "구경하기" button on a table that was already playing called `joinTable()`, which asks the host for a seat; the host refuses a started game, so the click went nowhere. It now calls `watchTable()`, which just starts listening to the state the host is already broadcasting.
- **The wilderness never opened.** `wilderness.js` captured `const O = window.ONL` at load time, but it is loaded before `app.js`, so `O` was always undefined and `open()` returned on its first line. It now resolves the lounge API lazily.
- **Tile numbers 2 and 5 looked the same.** They were drawn with Pixelify Sans, whose 2 and 5 are near-identical squiggles at that size. `DIGITS` is a hand-drawn 4x7 bitmap per digit and `pixNum()` draws it, so the numbers are unambiguous at any board size.

### Catan turn clock

`TURN_MS` gives a window per phase (setup 60 s, roll 45 s, main 100 s, robber and discard 45 s each) measured from `G.x.actAt`, which already tracked the last action. When it runs out the host plays the simplest legal move for whoever is holding things up — the same `cAuto` path that covers an absent player. A countdown appears in the header once under 30 seconds and turns red under 10.

### Drawing quiz words

617 words in three baskets (231 easy, 219 middling, 167 hard), up from about 440, with trendy and brand words in the hard basket. `D.used` is no longer cleared at the start of each game, so words do not come round again after a few rounds; it is trimmed to the last 120 once it passes 220.

### The wilderness leaderboard needs SQL

`app.js` calls `submit_score`, `top_scores` and `my_score`, and none of them existed. `scores.sql` adds `public.scores` (one row per player per game, RLS on, no direct grants) and those three SECURITY DEFINER functions: submit keeps the better of the old and new score and returns the rank, top returns the first ten with names from `profiles` and an `is_me` flag, my returns the player's own best. Submitting is rate-limited to 30 a minute per player through the existing `guard_hit`. The same block is appended to `setup.sql` for a fresh install. **The live project needs `scores.sql` run once or the records board stays empty.**

### Tested

Playwright against the mock: a third person pressing 구경하기 on a running game and seeing the board, the log and a chat they cannot type into; two tables at once; ten chat messages each visible as they arrive; the wilderness opening, scrolling and counting height; Catan, chess, drawing quiz, soccer, gomoku. `scores.sql` run twice on a scratch PostgreSQL 16, then three players setting records — a worse score does not overwrite a better one, ranks and `is_me` come out right.

## Several tables per room, chat fixes, rooftop dust, soccer again

Audience: the developer and the developer's AI agent.

Files changed: `app.js`, `games.js`, `index.html`.

### Chat

Two faults, both from the chat pane being borrowed into the game card.

- **Lines stopped appearing and then arrived all at once.** `log()` decided whether to follow the newest line with `scrollHeight - scrollTop - clientHeight < 60`. Re-parenting an element resets `scrollTop` to 0, so once the pane moved into the card and the log was longer than the box, that sum was large and every later line counted as "the reader has scrolled up". Nothing scrolled until something else called `scrollTop = scrollHeight`, and then the whole backlog appeared at once. `log()` now also treats a pane with no laid-out height as being at the bottom, and `chatHold()` scrolls to the newest line after the move (and again on the next frame, once layout has settled).
- **What you were typing was lost when somebody joined or left.** The card used to be rebuilt with `root.innerHTML = ''` on every table change, which moved the pane and blurred the input. The card is now built once (`ensureCard`) and only the body is replaced, so the pane never moves while the overlay is open.

### Several tables in one room

`TABLES` is a registry of every open table in the room, keyed by table id, refreshed by the host's `tbl` broadcast and pruned when a host goes quiet. `T` is the table I am sitting at, or null while browsing the list. Two people creating a table at the same moment now simply get two tables instead of one of them winning; the lobby lists them with who is sitting at each. Game traffic already carried `tid`, so a message for another table is ignored.

### Rooftop dust

- `WX.aqi` (US AQI, Open-Meteo) is drawn on the sign as a coloured bar under the weather picture, and the interaction reads it out in words.
- Above AQI 150 everyone standing on the roof coughs: a `콜록!` floater every 5 seconds and a short rasp through the synth (`sfx('cough')`). It stops when the air is clean or you leave the roof. There is no cough pose in the sprite sheet, so it is the bubble and the sound only.

### Soccer

The ball used to be worked out from the dribbler's character as it appeared on the watcher's screen, and that position only arrived every 170 ms, so the ball stuttered a step behind whoever was running with it. Now whoever has the ball at their feet sends the ball themselves every 85 ms, and watchers ease onto that instead (`ball.ownAt` marks how fresh it is; the feet are still the fallback after 500 ms). Ownership is still handed around by the host alone. Positions on the pitch go out every 110 ms rather than 170 ms, and the shot assist only straightens onto the goal within about 38 degrees instead of 50, so a pass sideways stays a pass.

A note for later: there is no drop-in open-source football to borrow here. The physics is a dozen lines; what makes it feel wrong is network timing, which is specific to how this lounge sends state.

### Catan

The wood resource is now a wooden stick rather than a log block.

### Tested

Playwright against the mock with the presence limit and 150-180 ms lag: two tables created at the same instant and both running games side by side; typed chat text surviving a join, a leave and an incoming message; ten messages in a row each visible as it arrives, at 390 px and 1440 px; coughing on the roof with the air forced to AQI 212; soccer possession, kicks, crowding and a full match; plus the Catan, chess, drawing-quiz, gomoku and reconnect tests.

## Chess, Catan computer players, resource panel, soccer team sizes

Audience: the developer and the developer's AI agent.

Files changed: `app.js`, `games.js`, `index.html`. File added: `chess.js`.

### Chess (`chess.js` + `GAMES.chess`)

- 0x88 board, full rules: castling, en passant, promotion, check, checkmate, stalemate, the 50-move rule, threefold repetition and insufficient material. Verified by perft from the start position: 20 / 400 / 8902 / 197281 at depths 1-4, and Kiwipete 48 / 2039 at depths 1-2.
- Engine: negamax with alpha-beta, MVV-LVA ordering, a short quiescence search, material plus piece-square tables. `easy` plays near-random but takes a free piece about half the time; `mid` searches 2 ply with noise; `hard` searches 3 ply. Worst case measured about 0.7 s in a sharp middlegame.
- Lives in room2 (the pantry) through the existing table framework, so it gets the lobby, host migration and chat for free. Gomoku is untouched and keeps its own button. There is also a chess table in the room with a spot to walk up to.
- Colours are drawn at random when the game starts. The whole game object is broadcast, so a new host can carry on.
- Pieces are drawn from `PIECE_SPANS`: a list of horizontal spans per piece, with the 1-pixel outline worked out from the shape itself. Hand-placed rectangles made all six look alike at 16 px.

### Catan

- **Computer players.** The table host adds them from the lobby and sets 상/중/하 each. They are ordinary players with `bot: true`, so the game survives the host leaving. `botTurn` picks by priority: city, then settlement, then a road only when there is no legal settlement spot left (building roads for their own sake used up all 15 pieces and stalled the game), then a development card, then a bank trade toward the next goal. `vScore` ranks a corner by the pips around it plus a bonus for covering different resources; `easy` picks at random from the legal set, `mid` from the top few, `hard` the best. They answer trade offers and move the robber onto the leader.
- Bots run on a separate 200 ms timer (`fastTick`); on the old 1 s table timer they moved once a second and a game never finished.
- `cWaiting`/`C.absent` no longer auto-plays for a bot, and bots count as present for the trade-offer timeout and for starting a game.
- **Resource panel.** Each player now has a card with their own character in the middle, three icons on the left (나무, 밀, 발전 카드) and three on the right (벽돌, 철, 양털), each with a count. Note this shows everyone's hand, not just your own — it is what was asked for, and the full state was already being broadcast, but it does remove the hidden-information part of the game.
- The icons are pixel art drawn in `ICON_DRAW` at 16x16, in the same style as the rooms, so no image files are needed.

### Soccer

- Team sizes are now 1:1 up to 4:4 (`FB_MODES = [1, 2, 3, 4]`, default 2).
- `startPractice()` drops you onto the pitch alone for 10 minutes with no opponents. `m.practice` skips the "a team is empty, end the match" check and changes the kick-off and final messages.

### Waiting room

The lobby card was 420 px wide and the chat took 270 of it, which cut the text and buttons off. It is now 900 px and 640 px tall on screens 900 px and wider, with the chat at 300 px; on a phone the chat still slides over the card.

### Tested

Playwright against the mock with the presence limit and 180 ms lag: a full Catan game of one human and three computers to a win; computer lobby add/remove/difficulty; the resource panel at 390 px and 1440 px; chess vs computer to checkmate on phone and desktop; chat inside every game, including handing the pane back; plus the existing soccer, gomoku, party, drawing-quiz and channel-recovery tests.

## Soccer rewrite, chat during games, screen sizes

Audience: the developer and the developer's AI agent.

Files changed: `app.js`, `games.js`, `index.html`.

### Soccer: why kicks were swallowed and the ball jumped about

Three faults, all in the old `hostStep`/`kick` pair:

1. **The host validated kicks against its own ball position.** A kicker sent `px,py`; the host measured from ITS ball to that point and dropped the kick when the distance was over `KICK_R + 8`. With any lag the host's ball had already moved, so the kick was thrown away. The player saw nothing happen.
2. **Every player within `DRIB_R` pushed the ball every frame.** With several players around the ball the last one in the loop won each frame, so the ball shot off in random directions. The push also overwrote the direction of a kick that had just been made.
3. **The kicker's own prediction was overwritten** by the next host packet, which did not yet contain the kick, so the ball snapped back.

New model in `app.js`:

- **Possession.** `ball.own` holds one player id. The ball rides at that player's feet (`ballHome`, `HOLD_AT`) on every screen, so dribbling has no lag and a crowd cannot make the ball jitter. Only the host takes the ball off a player (`stepBall(dt, now, host)`); other clients would decide from positions that run behind and would flicker.
- **The kicker is authoritative.** `kick()` sets the ball locally and broadcasts `{t:'kick', ks, x, y, vx, vy}`. Everyone, host included, applies it. `ks` is a counter; a kick with a lower `ks` is ignored, and ties are settled by comparing the sender id, the same way on every client. A host `ball` packet with an older `ks` does not touch the ball, so a kick is never undone.
- **Taking the ball.** The host picks the closest player within `TAKE_R`, with 2 px of hysteresis against the current owner, and never within `KICK_CD` (420 ms) of a kick. A client grabs locally the moment the ball reaches its own feet and sends `grab`; it holds that for up to 900 ms while waiting for the host to agree.
- **Aim.** `aimDir()` takes the direction you are running (keys or path), else the way you face, and straightens onto the goal mouth when that is within about 50°. Shots work on a phone, where you cannot hold a direction key.
- **The shoot button.** `punchBtn` becomes `⚽ 슛` with a `Space` hint on the pitch (`kickBtnLabel`), styled `.kick-btn`. Before this it still read `👊 펀치` with an `F` hint, which is why phone players said they could not shoot.
- A gold ring under the ball shows it is at my feet. Position broadcasts on the pitch went from 300 ms to 170 ms. A non-host eases onto the host's ball, or jumps when more than 24 px out.

Measured with 180 ms of simulated one-way lag, 4 players: ball positions agree within 17 px during play, kicks are never lost, the ball does not move at all under a crowd (it used to fly), goals and the final score agree on all screens.

### Chat during a game

The game overlay used to cover the chat, so people had to fold the game to talk. `games.js` now borrows the real `.chat-pane` element from the side panel, puts it inside the game card, and puts it back on fold, leave, or re-render (`chatHold` / `chatBack`). It is the same box and the same history, not a copy. On screens 900 px and wider it sits beside the board; narrower, a `💬 대화` button slides it over the game and carries an unread badge fed by `TG.onChat`, which `log()` in `app.js` calls.

Every path that empties the overlay calls `chatBack()` first. Forgetting one would detach `#log` and lose chat for the rest of the session.

### Drawing quiz

- The board is wiped at the start of every turn: `dApply` now calls `dRedraw()` on the `pick` phase. It cleared the stroke list before but never repainted, so the previous drawing stayed on screen.
- `WORD_SETS` holds three baskets (easy, middling, hard). Each turn offers one word from each, shuffled, so the drawer cannot tell which is which.

### Screen sizes

- The Catan board is sized from the space available in both directions, not width alone, and sets its own CSS size; the `ResizeObserver` watches the container, not the canvas, to avoid a feedback loop. Wide screens: board left, fixed 330 px column right, log fills the height. Phones: everything fits without scrolling.
- The drawing quiz gives the guess list the leftover height on a phone and caps the side column at 300 px on a desktop.
- Development cards now carry their effect and whether they can be played on the card itself. The effect used to be in a `title` tooltip, invisible on a phone.

### Tested

Playwright against the mock, with the presence limit and 180 ms lag modelled: soccer possession, non-host kicks, crowding, goals and a full match; chat inside both games at 390 px and 1440 px, including putting the pane back; Catan to the end with 3, 4 and 6 players, host leaving, a silent player; drawing quiz turns, guesses, scoring, drawer leaving; gomoku, party, channel recovery.

## Realtime without presence, Catan and drawing rooms

Audience: the developer and the developer's AI agent.

Files changed: `app.js`, `index.html`, `setup.sql`, `README.md`. Files added: `games.js`, `catan-rules.js`, `LICENSE-catan.md`, `update-rooms.sql`.

### Why people were thrown out of rooms

- The Supabase Realtime server allows one client 5 presence changes per 30 seconds per channel. Over that limit it closes the channel for that client (`ClientPresenceRateLimitReached`, see `presence_handler.ex` and `realtime_channel.ex` in supabase/realtime).
- The old client called `track()` on every state change. In the locker room each party update (every 3 seconds) made every member call `track()`. Members hit the limit seconds after joining a party. Their channel closed, so the host saw them vanish while their own screen stayed in the room.

### What changed in `app.js`

- No presence at all. `track()` and `presenceState()` are gone.
- Room channel: `st` broadcast carries the state. Every client sends a full `st` (name and look included) every 8 seconds as a heartbeat. `hello` on join asks the others for a full `st`. `bye` on leave. A remote is removed on `bye` or after 32 seconds of silence.
- Lobby channel (people counter, one session per account): `here` every 20 seconds and on room change, `who` on join, `gone` on leave. An entry expires after 70 seconds.
- A channel that reports `CLOSED`, `CHANNEL_ERROR` or `TIMED_OUT` is joined again. Remotes stay on screen during the rejoin, so a gomoku game, a soccer party or a table game is not cancelled by a short drop. A watchdog recreates a channel that stays down.
- `chSend` sends only on a joined channel. supabase-js would otherwise fall back to HTTP.
- Soccer: ball packets every 120 ms (was 90), keyboard movement packets every 300 ms on the pitch.
- New scenes `f1r2` (island) and `f1r3` (graffiti alley). `window.ONL` is the small API that `games.js` uses.

### `games.js`

- One table per room. Event name `tg` on the room channel. The table host is the referee. Players send intents; the host validates and broadcasts the state.
- Host loss: the first member still in the room takes over with its copy of the state. If two clients both claim the host role, the one with the higher game sequence keeps it.
- Catan: rules from `catan-rules.js` (`server/gameLogic.js` of Viral-Doshi/catan, MIT, unchanged except for the module wrapper). The full game object is broadcast so that any member can take over as host. Hidden cards are hidden by the UI only. The upstream rules do not check turn order for placement; `cDo2` in `games.js` does. A player who is not in the room is auto-played after 6 seconds. 5 or 6 players use the extended board without the special build phase.
- Drawing quiz: the host holds the word. Strokes go from the drawer to everyone in batches every 110 ms. A new host that does not know the word ends the current turn.

### Database

- `messages_before_insert` accepts the scenes `f1r2` and `f1r3`. On a live project run `update-rooms.sql` once (or all of `setup.sql`).

### How it was tested

- Mock realtime in a browser (Playwright), with the presence limit modelled. Old `app.js`: party members' channels are closed. New `app.js`: zero presence calls.
- Channel killed by the server, silent client, room change, duplicate session, soccer party and match, gomoku.
- Catan: 3, 5 and 6 robot players to the end of a game, host leaving, a silent player for 50 seconds and its return.
- Drawing quiz: 3 players, pick, draw, wrong and right guesses, scoring, drawer leaving.
- `setup.sql` and `update-rooms.sql` each run twice on a scratch PostgreSQL 16.

### Not tested

- No run against a real Supabase project. Message rate limits of the plan were read from the server source, not measured.

### Known limits

- Broadcast senders are still not verified by the server (same as before). A modified client can read the other players' Catan cards from the state or fake a move.
- Clients that still run the old `app.js` do not send heartbeats. A new client drops them after 32 seconds without movement. A page reload fixes it.

## Security hardening: invite gate, anonymous prayers, trusted chat sender

Audience: the developer and the developer's AI agent. This entry lists what changed, why, how, how it was tested, and what to know before you touch this code again.

Files changed: `setup.sql`, `app.js`, `index.html`. File added: `backport.js`.

### Deploy order (read first)

1. Deploy the client (`app.js`, `backport.js`, `index.html`). It also works against the OLD database.
2. Set the invite code secret (see "Invite gate"). Do this BEFORE step 3. Without a secret, new sign-ups are refused.
3. Run the new `setup.sql` in the Supabase SQL Editor. It is safe to run more than once.
4. Reload any page that was open during step 3. A page keeps its old behaviour until it reloads.
5. Run `alter table public.settings drop column invite_code;` to remove the old plaintext code.
6. In the next deploy, remove the backport (see "Removing backport.js").

`setup.sql` migrates data in place. There is no down migration. The `prayers.author` column is dropped for good. Take a backup first if you need a way back.

### What changed and why

| Area | Before | After | Why |
|---|---|---|---|
| Invite code | Default code `onlounge2026` written in `setup.sql`, also in git history | No code in the repo. Read from Vault, then from a DB setting. Missing or empty = sign-up closed | A default code can be used by mistake. A shipped code is public |
| Invite guessing | `check_invite` was open to `anon` with no limit | Failures are counted per IP and globally. Repeated failures are banned in the database | Stop brute force. The check runs in the DB, so a client cannot skip it |
| Prayer ownership | `prayers.author` stored the user id | No author. Each prayer has its own password (hash only). Edit and delete need the password | The author link let a DB reader find who wrote a prayer |
| Prayer limit | 5 per day per author, enforced in SQL | Removed from the server. The client warns from `localStorage` only | No author exists to count by. The owner chose a soft warning |
| Chat sender | The client sent `name` and `user_id` checks only covered `user_id` | A trigger sets `user_id` and `name` from the session and the profile. Clients may only send `body` and `scene` | Never trust the client about who wrote a message |
| Chat delivery | Client-to-client `chat` broadcast plus a DB insert | Clients listen to `INSERT` on `public.messages` (`postgres_changes`) | The row is already stored. The broadcast let a client fake a sender name |
| Chat flood | None | At most 5 messages per 10 seconds per member | Stop spam |

### How it was changed

#### Invite gate (`setup.sql`)

- `settings` is now a single row with `attempts jsonb`. The old `invite_code` column is no longer read. The script makes it nullable so old data does not block the script.
- `invite_secret()` returns the code. It reads Vault (`vault.decrypted_secrets`, name `invite_code`) first. It then reads `current_setting('app.invite_code', true)`. It returns `''` if neither exists. The Vault lookup runs through `execute` and `to_regclass`, so the script works on a project without Vault.
- `client_ip()` returns the LAST entry of `x-forwarded-for`, or `'unknown'`. Supabase documents the FIRST entry in its examples. We use the last entry on purpose. Supabase documentation does not say whether the proxy appends to or replaces this header. Treat the IP as a hint.
- `guard_hit(key, limit, window_seconds, record)` is the counter. Each key holds `n` (count), `w` (window start), `l` (ban level), `u` (banned until), `t` (last change). Reaching the limit bans for 1 hour. Each repeat doubles the ban, up to 24 hours. Entries idle for 24 hours are dropped. The map is capped at 200 keys.
- `invite_gate(code)` returns `'ok'`, `'wrong'`, `'closed'`, or `'banned:<seconds>'`. Limits: 5 failures per 15 minutes per IP, and 30 failures per hour for the shared key `'*'`. The shared key covers a spoofed IP header.
- An empty or null code returns `'wrong'` and is NOT counted.
- `check_invite(code)` changed from `boolean` to `text`. It is `security definer` and granted to `anon` and `authenticated`.
- `join_lounge(code, name, look)` changed from `void` to `text`. It returns the gate status. It no longer raises on a wrong code.
- Why return a status instead of raising: a raised exception rolls back the transaction, and the failure count is rolled back with it. Do not change this back to `raise exception`.
- `invite_secret`, `client_ip`, `guard_hit`, `invite_gate` are internal. They are revoked from `public`, `anon`, and `authenticated`.

Set the secret with one of these. Vault is read first.

```sql
select vault.create_secret('<your code>', 'invite_code');
-- or
alter database postgres set app.invite_code = '<your code>';
```

The Vault option may not exist on every plan. The DB setting is not a protected store: any role that can call `current_setting` can read it. Prefer Vault.

#### Anonymous prayers (`setup.sql`)

- New columns: `pw_hash text`, `pw_pre boolean default true`.
- New rows store `bcrypt(sha256_hex(password))`. The SHA-256 step makes passwords of any length count in full. bcrypt alone ignores everything after 72 bytes. There is no length limit and no complexity rule by owner decision.
- Legacy rows store `pw_pre = false`. Their `pw_hash` is a copy of the author's `auth.users.encrypted_password`. The author's account password opens them. The one-time migration then drops `prayers.author`.
- Legacy rows whose author had no password hash get `pw_hash = null`. Only an admin can delete those.
- `prayer_pw_ok(pid, pw)` checks a password. It is internal. An empty or null password never matches.
- `add_prayer(body, pw)` returns the new id. An empty password is refused. The old `add_prayer(text)` is dropped.
- `update_prayer(pid, pw, new_body)` is new. It returns `false` on a wrong password.
- `delete_prayer(pid, pw default null)` returns `boolean`. Admins delete without a password.
- `list_prayers()` no longer returns `mine`. The client keeps "my prayer" ids in `localStorage` (`onl-my-prayers`, last 200). They only decide whether the manage panel starts open. The server always checks the password.
- There is no limit on password attempts for prayers (owner decision). A member can try passwords on any prayer id without a limit. This is a known weakness. Add a counter with `guard_hit` if it matters.

#### Chat (`setup.sql`, `app.js`)

- `messages_before_insert()` (before-insert trigger, `security definer`) sets `user_id := auth.uid()` and `name` from `profiles`. It rejects non-members, scenes outside `sanctuary, hall, room1..room4`, and a 6th message within 10 seconds. Update the scene list when you add a room.
- `messages` grants: `select, delete` stay. `insert` is revoked, then granted for `(body, scene)` only.
- New index `messages_user_idx (user_id, created_at desc)` for the flood check.
- `messages` is added to the `supabase_realtime` publication. The script checks first, so it can run twice.
- `app.js`: `joinChatDb()` subscribes to `postgres_changes` for the current scene. `showChat()` shows a line from someone else and ignores your own line. The sender sees their own line at once from local code.
- The `chat` broadcast listener and sender are removed. They remain only as `BACKPORT` lines.

#### Client (`app.js`)

- `sbRaw` is the real Supabase client. `sb` is the wrapped one. All app code uses `sb`.
- `inviteMsg(status)` maps `wrong`, `closed`, `banned:<s>` to Korean user messages.
- Prayer form: new password field. A `confirm()` appears after 5 posts in 24 hours on this device (`onl-pr-day`). It is a warning, not a limit.
- Each prayer card has a "manage" panel: password field, edit, delete. Edit uses `prompt()` for the new text.

#### `backport.js`

Purpose: the client can be deployed before `setup.sql` runs. It wraps the Supabase client in a `Proxy`.

- It sends one probe at start: `rpc('check_invite', { code: '' })`. A `boolean` answer means an old database (`ONL_BACKPORT.legacy = true`). A `text` answer, an error, or a network failure means a new database.
- On an old database it translates calls:
  - `check_invite`: boolean to `'ok'` or `'wrong'`.
  - `join_lounge`: the exception `wrong invite code` becomes `'wrong'`; success becomes `'ok'`.
  - `add_prayer`: sends only `body`. The password is dropped.
  - `delete_prayer`: sends only `pid`. It reports success without proof, because the old function returns nothing.
  - `update_prayer`: returns `false`.
  - `messages.insert`: adds `name` from `ctx.name()`.
- Every `rpc` waits for the probe. The probe also runs on a new database. That is one extra call per page load.
- In legacy mode `app.js` also sends and listens to the `chat` broadcast, and hides the prayer password field. These lines carry the `BACKPORT` marker.

### Removing backport.js

1. Delete `backport.js`.
2. Delete `<script src="backport.js"></script>` in `index.html`.
3. In `app.js`, find every line with `BACKPORT`: `grep -n BACKPORT app.js`.
   - Delete the `BP` constant and the `sb` wrapper line. Rename `sbRaw` back to `sb`.
   - Delete the `chat` broadcast listener and the legacy `netSend('chat', ...)` line.
   - In `joinChatDb()`, delete the `if (BP.legacy) return;` line.
   - In `openPrayers()` and `renderPrayers()`, replace `LIVE && !BP.legacy` with `LIVE`. Keep the code in the block. Delete the old delete-button branch only if you no longer need the demo mode, which still uses it.
4. Run `node --check app.js`.

### How it was tested

Test code is NOT in the repo. It was in a temporary folder and is gone or will be pruned. Rebuild it if you need to rerun.

- SQL (62 checks, all passed). Real PostgreSQL 18 with `pgcrypto` built from source. The old `setup.sql` (from `git show HEAD:setup.sql`) was applied first and filled with sample data. The new `setup.sql` was then applied twice. Checked:
  - migration: `author` dropped, legacy hash copied, a row without hash stays unusable;
  - invite: closed without a secret, Vault wins over the DB setting, empty and null codes, 5-failure ban, doubling to 2 hours, the 200-key cap, the global bucket against 250 spoofed IPs, failures committed (not rolled back);
  - chat: `user_id` and `name` forced, client-sent `name` and `user_id` refused, bad scene, flood limit, non-member refused;
  - prayers: 1-character password, long password where only the first 72 bytes match (must fail), edit, wrong, empty and null passwords, admin delete, hashes are bcrypt with a different salt per row;
  - privileges: internal functions not callable by `authenticated`, `anon` blocked from prayers, `list_prayers`, and `join_lounge`, `messages` in the realtime publication.
- `backport.js`: a mock client in Node. Covered old database translation, new database pass-through, and a failed probe.
- `node --check` passed for `app.js` and `backport.js`.

### Not tested

- No browser run. The prayer manage panel, the chat feed, and the sign-up messages were never seen on screen.
- No real Supabase project. The mock schemas for `auth`, `realtime`, and `vault` were hand-written. Not verified there: Vault on the free plan, `ALTER DATABASE ... SET app.invite_code`, the `x-forwarded-for` behaviour, `postgres_changes` filtering with RLS, and the realtime publication change.
- Realtime `postgres_changes` DELETE events are not filtered by RLS (Supabase documentation). The app does not use DELETE events for chat.

### Known limits and risks

- Not fixed on purpose: presence name tags and the `st`, `emote`, `hit`, `gm` broadcasts. The server cannot verify the sender of these. A client can fake a name tag, including an admin look.
- Login password guessing is not handled in SQL. Use the Supabase Auth settings: rate limits, CAPTCHA, and MFA for admins.
- The copied legacy hash is byte-identical to `auth.users.encrypted_password`. Anyone who can read the auth schema can link a legacy prayer to an account. New prayers use a new salt and cannot be linked.
- `guard_hit` locks the `settings` row on each recorded failure. Under attack, sign-up attempts queue behind each other. Existing members are not affected.
- During an attack on the global key, new sign-ups are refused for up to 24 hours.
- The prayer limit of 5 per day is a client warning only. Anyone can clear `localStorage` or call the RPC directly.
- Old CSP, `?debug`, and QR-image issues from the review are not part of this change.

### Rules for future edits

- Keep failure counting in functions that RETURN a status. A raised exception undoes the count.
- Keep new internal helper functions revoked from `public`, `anon`, and `authenticated`.
- Do not add `user_id` or `name` back to the `messages` insert grant.
- Do not store a plaintext invite code or prayer password anywhere in the repo, in logs, or in the database.
- Run `setup.sql` twice on a copy before you ship a change to it.
