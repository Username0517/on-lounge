# ON-Lounge

청년부 픽셀 라운지. 2층(본당·복도·ROOM 1~4), 3층 옥상(실시간 베이징 날씨), 1층(로비·락커룸·축구장)을 엘리베이터로 오가며 실시간으로 대화하고 놀아요. 방마다 대화가 따로예요.

## 파일 안내

모든 파일이 폴더 없이 한곳에 있어요. GitHub에는 **전부 한꺼번에** 끌어다 놓으면 돼요.

| 파일 | 하는 일 |
|---|---|
| `index.html` | 화면 |
| `config.js` | Supabase 연결 정보 (여기만 고치면 돼요) |
| `app.js`, `sprite.js`, `parse.js` | 공간·실시간 기능, 캐릭터 그림, QT 본문표 읽기 |
| `backport.js` | 새 `setup.sql`을 실행하기 전에도 화면이 옛 데이터베이스와 동작하게 해 주는 임시 파일 (CHANGELOG 참고) |
| `setup.sql` | Supabase SQL Editor에 붙여넣고 실행하는 설정 |
| `supabase.js`, `tesseract*.js`, `worker.min.js`, `kor.traineddata.gz`, `*.woff2` | 라이브러리·사진 글자 인식·글꼴 (중국에서도 열리도록 직접 포함) |

`config.js`가 비어 있으면 이 기기에서만 도는 체험판(DEMO)으로 열리고, 채워져 있으면 실제 라운지(LIVE)로 열려요.
