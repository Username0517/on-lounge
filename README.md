# ON-Lounge

청년부 픽셀 라운지. 본당·복도·ROOM 1~4를 캐릭터로 오가며 실시간으로 대화해요. 방마다 대화가 따로예요.

## 파일 안내

모든 파일이 폴더 없이 한곳에 있어요. GitHub에는 **전부 한꺼번에** 끌어다 놓으면 돼요.

| 파일 | 하는 일 |
|---|---|
| `index.html` | 화면 |
| `config.js` | Supabase 연결 정보 (여기만 고치면 돼요) |
| `app.js`, `sprite.js`, `parse.js` | 공간·실시간 기능, 캐릭터 그림, QT 본문표 읽기 |
| `setup.sql` | Supabase SQL Editor에 붙여넣고 실행하는 설정 |
| `supabase.js`, `tesseract*.js`, `worker.min.js`, `kor.traineddata.gz`, `*.woff2` | 라이브러리·사진 글자 인식·글꼴 (중국에서도 열리도록 직접 포함) |

`config.js`가 비어 있으면 이 기기에서만 도는 체험판(DEMO)으로 열리고, 채워져 있으면 실제 라운지(LIVE)로 열려요.
