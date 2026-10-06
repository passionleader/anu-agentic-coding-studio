# Crit 8 reflection

## The breakthrough that moved the work forward

A thorough plan kills the pointless back-and-forth. Before, my planning was a
quick brainstorm and then straight into agentic coding, and the build kept
stalling on small clarifying questions. This time I wrote the plan properly,
from the stack to the user's scenario, before any code. Writing it took two or
three times longer than usual, but the first working prototype came within
minutes, and the details (BGM, the bathroom map) were done in under an hour.

I also tried Opus for the first time. It's slower than Sonnet but understood
what I meant straight away, so I made it the main session and gave Sonnet the
small parallel jobs like assets and QA. Splitting the work like that really
paid off. Dropping my ambition for real-time and aiming only for a prototype
made it finish fast, and that felt good.

![Crit 8 work split between the Opus session (server, deploy, docs) and the Sonnet session (client, assets, QA)](../diagrams/4-work-split.png)

## What this changed about who I want to be as a developer

This was my first time simulating 3D in a browser, and I was surprised how
quickly it came together: over an hour of planning, then the build almost
straight away. It made me feel how much a future developer's value lies in
design and creativity rather than in writing the code. To keep up with AI, I
want to learn more stacks and how they combine, and to keep coming up with
ideas as odd as a poop in a web space.

Looking into stacks also made me curious about real-time in the browser: how
do you move from the HTTP I've always used to WebSockets, and how does it
actually work? I'll need that for the final project. People say real-time
needs Redis, but on a single small instance I doubt caching buys much, two
processes on one machine might overload it, and managed Postgres and Redis on
Fly are paid anyway.

![From crit 8 to the final project: REST writes now, WebSockets and in-memory positions next](../diagrams/3-crit8-to-final.png)

---

## 한국어 초안

### The breakthrough that moved the work forward

철저한 계획은 불필요한 핑퐁(불필요한 대화)을 막는다!
이번에는 plan을 아주 철저하게, 기술 스택부터 시나리오까지 철저히 작성하고 작업에 임하였다.
기존에는 계획 단계를 아주 간단한 브레인스토밍 단계로 마무리하고 에이전틱 코딩 작업 단계로 들어갔는데,
불필요한 대화(사소한 질문)가 많아서 구현이 상당히 지체되었었다.
이번에는 5분 만에 첫 프로토타입이 완성되고, 자잘한 디테일(BGM, 맵 디자인) 적용까지 한 시간도 채 안 걸려서 마무리하였다.
오히려 plan 작성이 두세 배 정도 오래 걸린 것 같다.
이번에 Opus를 사용해 봤는데, Sonnet보다는 오래 걸리지만 말귀를 바로 알아들었다. 이를 이용해
이번에는 Opus 세션을 메인 세션으로, Sonnet은 에셋 등 자잘한 작업을 맡도록 작업을 분담해서 병렬 처리로 진행하도록 지시하였는데,
실제로 효과가 매우 있었다.
실시간 통신의 욕심을 버리고 프로토타입을 구현하는 것을 목표로 잡으니 매우 금방 끝나서 기분이 좋았다.

### What this changed about who I want to be as a developer

사실 웹 브라우저로 3D 시뮬레이팅은 이번에 시도한 것이 처음인데, 생각보다 너무 빠른 시간 안에 처리해서 매우 놀랐다.
오히려 plan을 짜는 데 한 시간 넘게 사용하고, Claude Opus를 통해 거의 5분 만에 완성한 것 같다.
이로써 앞으로 개발자에게는 개발보다는 큰 설계와 창의성이 매우 중요하다는 것을 절실히 깨닫는 순간이었다.
나는 AI에 도태되지 않기 위해 더 많은 스택과 가능한 조합을 배우고, 항상 이 웹 공간의 "똥"처럼 창의적인 기획을 하는 사람이 되도록 노력해야 할 것 같다.
이번에 앱 스택을 찾아보기 위해 실제 웹 브라우저 기반의 실시간 통신에 대해서 조금 찾아봤다.
나중에 final project를 할 때에는 실제로 적용해야 할 문제이기에 조금 골치 아파질 것 같지만,
우선 이제까지 사용했던 HTTP 기반에서 WebSocket으로 어떻게 통신할 것인가? 원리는 어떻게 되는가?
이런 것들이 막 궁금해지기 시작했다. 애초에 이런 것이 가능하다는 것이 신기하였다.

아, 그리고 실시간 통신에서는 무조건 Redis가 좋다고들 하는데, 단일 인스턴스에서 캐싱을 해 봤자 얼마나 향상이 있겠냐마는...
그리고 상식적으로 하나의 인스턴스에 두 개를 돌리면 서버가 터지지 않을까 예상한다. 정확한 것은 fly.dev 현재 요금제의 스펙을 봐야 알 것 같지만...
그리고 어차피 관리형 Postgres랑 Redis는 fly.dev에서 유료라서 이 프로젝트에서는 못 쓴다.
