# ON-Lounge

청년부 픽셀 라운지. 2층(본당·복도·ROOM 1~4), 3층 옥상(실시간 베이징 날씨), 1층(로비·락커룸·축구장·카탄 섬·낙서 골목·광야)과 1층 밖(광장·숲길·저택)을 엘리베이터로 오가며 실시간으로 대화하고 놀아요. 방마다 대화가 따로예요.

## 파일 안내

모든 파일이 폴더 없이 한곳에 있어요. GitHub에는 **전부 한꺼번에** 끌어다 놓으면 돼요.

| 파일 | 하는 일 |
|---|---|
| `index.html` | 화면 |
| `config.js` | Supabase 연결 정보 (여기만 고치면 돼요) |
| `app.js`, `sprite.js`, `parse.js` | 공간·실시간 기능, 캐릭터 그림, QT 본문표 읽기 |
| `games.js`, `catan-rules.js`, `chess.js` | 1층 ROOM 2 카탄, ROOM 3 그림 퀴즈, 2층 탕비실 체스. 카탄 규칙(`catan-rules.js`)은 Viral Doshi의 MIT 공개 코드예요 (`LICENSE-catan.md`) |
| `wilderness.js` | 1층 ROOM 4 광야 (점프해서 올라가는 1인 기록 게임) |
| `mansion.js` | 1층 밖 저택: 혼자 하는 이야기 모드 (철수·훈이·유리와 탈출) |
| `hunt.js` | 1층 밖 저택: 3~6명 술래잡기 (괴물 대 생존자, 석궁·감옥·열쇠·사다리) |
| `race.js`, `pad.html` | 광장 동쪽 레이싱 서킷: 카트 레이싱 1~6명 (맵 18개, 맵별 기록), `pad.html`은 QR로 여는 폰 컨트롤러 화면 (실제로는 VPN 없이 열리도록 공개 저장소 `on-lounge-pad`의 GitHub Pages에 같은 파일을 `index.html`로 올려 써요) |
| `manifest.json`, `sw.js`, `icon-*.png`, `apple-touch-icon.png` | 홈 화면에 앱처럼 설치하기 |
| `scores.sql` | 광야 기록판용 SQL. 라이브 프로젝트에서 한 번 실행해야 기록이 남아요 |
| `race.sql` | 레이싱 기록판용 SQL. 라이브 프로젝트에서 한 번 실행해야 기록이 남아요 |
| `update-rooms.sql` | 이미 `setup.sql`을 실행한 곳에서, 새 방 채팅만 열어 주는 짧은 SQL |
| `backport.js` | 새 `setup.sql`을 실행하기 전에도 화면이 옛 데이터베이스와 동작하게 해 주는 임시 파일 (CHANGELOG 참고) |
| `setup.sql` | Supabase SQL Editor에 붙여넣고 실행하는 설정 |
| `supabase.js`, `tesseract*.js`, `worker.min.js`, `kor.traineddata.gz`, `*.woff2` | 라이브러리·사진 글자 인식·글꼴 (중국에서도 열리도록 직접 포함) |

`config.js`가 비어 있으면 이 기기에서만 도는 체험판(DEMO)으로 열리고, 채워져 있으면 실제 라운지(LIVE)로 열려요.
