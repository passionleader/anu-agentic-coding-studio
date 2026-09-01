# Crit 5 reflection

**What was the breakthrough that moved the work forward?**

I set out to build something in the spirit of the SEGA arcade games I grew up
on, but because I told Claude Code to source free assets rather than draw
anything from scratch, the result kept sliding toward an early-2000s
Flash-game feel — a blend of Claude's asset choices and my own half-formed
vision, not what I actually meant. Writing `Plan.md` and `CLAUDE.md` carefully
up front wasn't enough by itself; even "obvious" mechanics (a scrolling map,
a boss whose HP scales with the stage) only appeared once I described them
in that much detail. The real breakthrough was two decisions: composing the
retro BGM myself in Logic Pro — I used its AI session player to perform the
parts, but picked every chord progression and instrument by hand myself —
and running a second Claude Code session, the two messaging each other directly
(`ListAgents`/`SendMessage`) while I managed both. Directing, not just
prompting once, is what closed the gap.

**What did this change about who I want to be as a software developer?**

Watching game credits list a stage designer, an asset designer, a sound
engineer, and a director side by side, I realized I had reconstructed that
structure without meaning to: myself as director, sound engineer, and QA; one
Claude session as asset/stage designer and internal QA; another as the
implementer. It felt like being the CEO of a small team of Claude Code
instances — and the ceiling of what came out tracked my own skill as a
director, not the model's alone. I'm not there yet, but I want to grow into
someone who can direct a project like this well enough to actually ship it to
a real market.



### Korean draft (원문 초안)

**방향성과 지시사항**

어릴 적 자주 했던 세가(SEGA) 게임을 모티브로 만들었으나, 정작 완성된 것은 2000년대 초반 플래시 게임 스타일에 가까운 결과물이었다. 직접 그리라고 시키지 않고 무료 어셋을 찾아서 쓰라고 지시했기 때문에, 내가 생각한 모습과 클로드코드가 고른 어셋이 섞여서 이런 결과가 나온 것 같다. 어쨌든 클로드코드가 만들어 온 결과물에 하나하나 살을 덧붙여서 겨우 게임이라고 부를 만한 수준까지 끌어올렸다. 어셋을 구현하는 부분이 특히 어려웠다 — 어떻게 설명해야 게임다운 어셋/배경이 나올지 한참 고민했다.

이번에는 레트로 스타일의 음악을 Logic Pro로 직접 만들어 게임에 적용해봤다는 점을 강조하고 싶다. 로직 프로의 AI 기반 세션 플레이어를 연주에 활용하긴 했지만, 코드 진행과 악기 선택은 전부 내가 직접 골라서 만들었다.

또한 내 머릿속에 있는 내용을 구체화하기 위해 다음과 같은 세부 사항까지 하나하나 지시해야 했다 — 사람이면 당연히 알아서 할 "간단한" 작업인데도 이 정도로 자세히 알려줘야 했다:

> 맵이 하나밖에 없고 횡스크롤이 아니다. 최소한 캐릭터가 움직이면 화면도 같이 움직이거나, 캐릭터가 화면 양 끝에 도달하면 다음 맵으로 넘어가는 구조가 있어야 한다. 맵이 가장 큰 문제다. 스테이지마다 맵이 5개 정도 있어야 하고, 각 스테이지의 마지막 맵에는 보스가 있어야 한다(보스 체력은 그 스테이지 일반 몬스터의 10배, 즉 1스테이지라면 20). 스테이지가 올라갈수록 난이도도 올라가야 한다 ...

**자아성찰**

게임 크레딧을 보면 "스테이지 디자인, 어셋 디자인, 사운드 엔지니어, 총괄 디렉터, 개발자"처럼 역할이 나뉘어 있는데, 이번에는 클로드코드와 나 사이에도 그런 역할 분담이 생겼다: 나는 "총괄 게임 디렉터·사운드 엔지니어·QA", 클로드코드 xhigh 세션은 "어셋 디자인·스테이지 디자인·내부 QA", 클로드코드 medium 세션은 "개발자"를 맡았다. 클로드를 부려먹는 CEO가 된 기분이었다 — 다르게 말하면, 이 CEO 역할을 얼마나 잘 해내느냐에 따라 클로드코드의 잠재력을 얼마나 끌어올릴 수 있는지가 달라진다는 뜻이다. 아직은 내 능력이 부족해서 이 정도 결과물밖에 못 만들지만, 언젠가 성장해서 제대로 시장에 내놓을 만한 프로젝트를 만들어보고 싶다.

**이번에 시도한 것들**

이번에는 `Plan.md`부터 `CLAUDE.md`까지 어떤 규칙으로 무엇을 만들지 철저히 정리해두었는데도, 예전에 프롬프트만 던졌을 때와 비슷한 결과물이 나와서 실망스러웠다. 역시 계속 방향을 잡아줘야 제대로 만들어지는 것 같다.

또한 이번에는 세션 두 개가 서로 직접 통신하도록 했다. `ListAgents`로 지금 띄워져 있는 다른 세션(로컬이든 원격/클라우드든)을 조회하고, `SendMessage`로 그 세션에 메시지를 보내서 대화할 수 있다는 점을 이용해서, 세션 두 개를 띄워두고 관리(매니지먼트)는 xhigh 세션이 맡고, 프로토타입 생성처럼 빨리 끝나는 일은 medium 세션에 적절히 나눠주도록 시켰다. 생각보다 역할 분담이 잘 되어서 만족스러웠고, inference가 높은 모델이 매니징도 잘 해줬다.

리플렉션 작성이 끝나면 마지막으로 Skill을 만들어보려 하는데, 매크로 대용으로 매주 수행할 작업을 등록해두려 한다.
