> 이 파일은 ANU 공개 레포지토리에는 커밋하지 말고, 내 개인 레포지토리에 커밋할 것
>
> `plan_for_ass3.md`(Assignment 3 아이디어 메모)와 `plan_draft_for_crit8.md`(crit 8 계획)를 합친 파일. 둘이 겹치는 내용은 한 번만 남겼고, 서로 다른 결정은 최신(crit 8에서 정한 것)을 따르고 옛 메모는 표시해 둠.
>
> 팁: Opus가 메인 작업, sonnet 은 어셋 등의 작업용. 세션 하나 추가로 띄워서 이렇게 말하자 "추가로 세션 하나 더 띄워 뒀으니까 에셋 만드는 등의 병렬 처리 가능한 업무는 얘 시켜서 같이 일해. 시간 절약하게 일을 할당하고. 또 다른 세션은 sonnet medium이야"

# Final project plan

## 컨셉

로블록스 비슷한, 근데 "게임"이라기보단 사람들 모여서 소통하는 실시간 소셜 공간.

- 참고: Gather.town, VRChat lite 느낌
- 3D로 구현할 거고, 3인칭 시점을 지원한다.
  - (Assignment 3 메모 당시에는 "스코프는 2D 탑다운으로 줄이는 게 현실적 (풀 3D 아바타+물리는 한 학기 과제로 과함)"이라고 적었지만, crit 8에서 3D로 결정함)

## 기술 스택

![From crit 8 to the final project: REST writes now, WebSockets and in-memory positions next](crit8-passionleader/diagrams/3-crit8-to-final.png)

- 실시간 위치: 서버 메모리에 Map<playerId, {x,y,z,rot}>로 두고 WebSocket으로 브로드캐스트해요. 초당 10~20회 정도의 틱으로 보내면 돼요. DB에는 쓰지 않음
- 영속 데이터: SQLite를 volume에 두고 접속 종료 좌표와 아이템 기록을 저장해요. 쓰기는 접속 종료 시점이나 몇 초 간격으로 한다
- 통신: 채팅 같은 메시지도 WebSocket이에요. 기록이 필요하면 SQLite 테이블에 쌓음
- 클라이언트 렌더링: WebGL (Three.js나 Babylon.js) → crit 8에서 Three.js로 결정
- 실시간 동기화: WebSocket > Crit8에는 실시간 동기화 불 필요. 다만 똥을 남길 떄 위치(좌표)는 즉시 DB에 저장 되어야 함
  - 서버 프레임워크 후보: Colyseus (room 기반 상태 동기화, 직접 구현보다 서버 코드량 줄어듦)

![Database choice: SQLite on the volume (chosen) vs. managed Postgres and Redis (given up)](crit8-passionleader/diagrams/2-database-choice.png)

## 배포 (Fly.io)

- 기본 course 설정은 scale-to-zero (`min_machines_running = 0`) → 비용은 거의 안 들지만 WebSocket 상시 연결과 궁합 안 좋음
- 데모/크리틱 때는 `min_machines_running = 1`로 always-on 전환 고려
- always-on 비용이 course 예산 범위 안에 드는지 불명확 → comp4020@anu.edu.au에 문의 필요
- [https://comp4020-final-passionleader.fly.dev/](https://comp4020-final-passionleader.fly.dev/) 띄워 둔 상태

## Claude Code 예산

- $300 Sonnet 예산이면 이 스코프엔 충분해 보임
- 비용 절약 팁: 세션을 자주 새로 열지 말고 하나로 길게 이어가기 (cold start마다 ~$0.10 고정 비용)
- WebGL 디버깅할 때 스크린샷 반복 첨부가 비용 많이 먹는 요인이니 주의
- 세션 분리는 backend / frontend / assets 3개 정도로 (너무 잘게 쪼개면 cold start 비용 누적)
- effort는 기본 medium, 동기화 설계·디버깅 같은 중요한 순간만 high로

# Plan — crit 8 (proof of life)

## The idea in one sentence

위 최종 프로젝트에 구현할 것의 프로토 타입.

이걸 다 구현하려면 시간이 모자라니 일단 이런 로직?

접속 시 창이 뜸 > 사용자 이름 적기 (알파벳과 밑줄만 허용, 최대 8글자). 이름은 중복이 불가능하다

접속하기 버튼 누르면 화장실 3d맵에 입장 (무료 변기 3d 에셋 사용)

스페이스 바 누르면 사용자가 있던 위치에 똥이 생긴다. 똥에 가까이 가면 똥 싼 사용자 이름이 2d로 표시된다. (DB 로 똥의 좌표 및 똥 주인 이름 저장 필요)

이번에는 프로토 타입이니까, 실시간 통신은 구현하지 않는다. 똥을 싸는 순간 DB에 기록하고 맵을 불러올 때 DB에서 기존의 똥의 위치를 불러온다

모바일 지원 여부? > 가능하면 지원한다. 따라서 가상 키패드(십자키)와 똥싸기 버튼은 구현해야 한다.

BGM지원 - 우측 상단에 '스피커 버튼' 추가해 주고, 이 스피커 버튼을 누르기 전까지 평화로운 브. 또한 스페이스 누르면 방귀소리가 난다. 우측 상단 스피커 버튼은 음소거 버튼임

## Who is it for

온라인에서 흔적을 남기고 싶은 모든 사람에게 추천하는 앱이다. 특히 친한 친구들끼리 접속하거나, 학급 동료들의 조별과제 등 어색한 사람들이 친해지고 싶을 때 똥을 싸놓고, 나중에 와서 접속하면 추억을 되돌릴 수 있다. "너 나 보자마자 똥 쌌잖아". "우리 영원을 똥에 새겼는데 기억하니?" "너 똥에 내 똥을 둘 수 있어서 기뻤어" (실제로 사이트에 적으면 좋겠음)

## The ONE core thing a stranger does

접속하자마자 창이 뜨고, 이름을 쓰고 입장하기를 누르면 화장실에 입장한다. 스페이스바로 똥을 남길 수 있다. 똥의 유효기간은 없다. (나중에 똥 치우기 기능 구현 예정)

똥은 여러번 쌀 수 있으나, 화장실에 남는 것은 가장 마지막에 싼 똥의 위치이다. 따라서 똥을 새로 쌀 때마다 기존 똥의 행을 업데이트 하는 식으로 진행하면 될 것 같다. (한사람당 똥 범벅이 되도록 하면 안됨)

## The trace they find when they come back

다시 접속했을 때 남아 있는 것: 똥의 위치, 똥에 가까이 갔을 때 똥의 주인의 이름이 표기됨

## Out of scope for crit 8

실시간 통신 및 화장실 디자인은 하지 않는다(화장실은 누리끼리한 색). 광원은 신경쓰지 않는다(이번에는 간단하게 공간의 광원을 균일하게 밝게 만든다). 인벤토리 및 채팅창도 만들지 않는다. 똥 줍기나 치우기는 이번에 만들지 않는다. 캐틱터 커스터마이징도 하지 않는다(일단 3인칭 시점이니 흰색 사람모양 찰흙 텍스쳐? 가장 기본적인 형체)

## Stack

위 기술 스택 참고. 너가 더 추천하는 기술 스택 있으면 그걸로 결정하괴, 프롬프트에 직접 나한테 공유해 주기. (전체 기술스택 정리해서 보여주면됨).

![How one poop travels: browser, Hono server and SQLite on the Fly volume](crit8-passionleader/diagrams/1-crit8-architecture.png)

## QA

![Crit 8 work split between the Opus session (server, deploy, docs) and the Sonnet session (client, assets, QA)](crit8-passionleader/diagrams/4-work-split.png)

일이 마무리 되면 에이전트인 너가 QA역할로 어떤 점이 이상한지 검증해줘.브라우저 직접 컨트롤 해도 되고 브라우저 로그/렌더링 오류 같은거 같이 봐바.

테스트를 위한 계정으로 qa_bot 계정 사용

테스트를 위해 그 어떤 짓도 해도 됨. 맵이 똥 범벅이 되든 DB 버그를 발견해서 무한 똥을 싼다던가. 다만 발견했으면 고쳐야겠지?

## What good means for this app (v1)

- 똥이라는 유치하고 어리고 더러운 주제로, 어색한 사람들이 친해질 수 있다.
- 3d 공간이라는 입체적인 주제로, 마치 가상의 세계에 들어온 듯한 효과를 준다.
- 아직은 프로토타입이지만, 똥 이라는 방명록에 나의 다짐, 영원한 사랑, 할일 목록 등을 남겨 평생 기억에 남길 수 있다.
- 똥이 마렵지 않아도 똥을 생성할 수 있다
- 키보드 만으로 생리적인 쾌감을 경험할 수 있다.

## What I read / looked at while deciding

* Good이라는 것은 무엇일까
  * 좋은 게임이란? [ArtStation - A practical guide to Game Design](https://www.artstation.com/blogs/andrewdowell/PQaWj/a-practical-guide-to-game-design)
    * 좋은 게임은 플레이어가 선택하고, 성장하고, 실패하고, 다시 도전하고 싶게 만드는 시스템과 이야기를 가진다고 언급. 하지만 나는 이 글을 읽고 곧 게임이 아니라 소통할 공간을 원한다는 것을 깨달음
  * 좋은 커뮤니케이션이란? [Effective communication | Comcare](https://www.comcare.gov.au/safe-healthy-work/healthy-workplace/work-design/better-practice-guides/effective-communication)
    * 좋은 커뮤니케이션을 위한 조건을 설명한 페이지지만, 온라인에서도 커뮤니케이션은 유효하다.
      - **명확한 목적 전달** → 온라인에서는 정보 손실이 더 크기 때문에 필수
      - **적절한 채널 선택** → 가상 공간은 채널이 더 다양함
      - **공감적 듣기** → 비언어적 신호가 줄어드는 환경에서 더욱 중요
      - **오해의 빠른 해결** → 텍스트 기반 소통은 오해가 더 쉽게 발생
- 레퍼런싱
  - [https://hop.earth/](https://hop.earth/) -> 실시간 게임 월드 구현
  - [https://learn.framevr.io/](https://learn.framevr.io/) -> 온라인 화상 회의. 궁극적으로 내 목표와 가장 가까운 모습 (파이널 프로젝트에서 진행)

# Process.md

## Why this stack

- 왜 이 스택을 골랐을까?
  - 우선 3d 월드는 독창성과 시선을 끄는 관점에서 최고이다. 따라서 webgl을 골랐다. three.js혹은 babylon 중 어떤 것을 고를 지는 더 생각을 해 봐야 겠다
  - 또한 배출한 똥의 위치와 유저네임을 기록하기 위해 SQLite를 사용하였다. 현재 티어의 fly.dev에서 티어 업그레이드 없이 사용 가능하다. 라이브러리 하나로 파일 하나에 저장되는 서버가 불필요해서 딱이다!
  - 추후 final project 시에는 실제 게임처럼 webgl based통신으로 실시간 위치 공유와 채팅도 지원하게 하면 좋을 것 같다.
  - Colyseus (room 기반 상태 동기화, 직접 구현보다 서버 코드량 줄어듦)
- 포기한 스택 (위 "Database choice" 그림 참고)
  - Postgre+Redis: Fly.dev에서 관리형으로 구현하려면 유료로 구현해야 한다. 나는 지원된 크레딧으로 무료로 플레이 하는 것을 목표로 하고 있다. 심지어 하나의 머신에 두 프로세스를 같이 띄우는 것도 우려된다. 하나의 머신을 서버로 쓸 거라 굳이 redis도 필요가 없다. 캐싱 자체가 필요 없으니까.
  - NoSQL또한 고려를 하였으나, 별도의 서버 프로세스를 띄워야 하므로 한 머신, 한 volume 구조에서는 따라서

④ CLAUDE.md에 넣을 규칙:

- "커밋은 기능 하나씩 작게"
- 모든 문서는 영어로 작성
- 내가 작업을 줄 때마다 process.md 하단에 "history"로 커밋넘버와 함께 간단히 기술해 둘 것
- 주차가 변경되었을 때 이 부분은 초기화 되고 덮어쓴다 (week8에 쓴 히스토리는 week9작업 시작 시 제거)

⑤ reflections/crit-8.md: 마감 직전 (150~300단어)

- 이건 별도로 작성함 물론 한국어 초안임
