# Crit 2 reflection

## The breakthrough

I've always wanted to redesign 7-Zip's official download page — it's a tool
everyone in the world seems to have used at some point, but the site still
feels stuck in the 1990s. Getting to actually rebuild the page I'd complained
about for years is what made this week fun rather than an assignment.

The real breakthrough was realising how much my mental model of the web was
out of date. When I first learned web development ten years ago, there was no
such thing as Astro — you got to the home page through `index.html`, full
stop. So when I couldn't find one in this repo, I was genuinely thrown, until
I learned about file-based routing in `src/pages/`. I'd also been carrying a
wrong definition the whole time: I thought "dynamic website" just meant "a
site that uses JavaScript," when it actually means a site that talks to a
server for logic or data at request time. That confusion had quietly become
"dynamic = beautiful, static = plain" in my head, which is backwards — Astro
is exactly what let a *static* site come out looking this polished, fast.

## What this changed about the developer I want to be

I noticed that unless I explicitly ask for a specific UI library or design
system, Claude Code defaults to writing its own CSS from scratch rather than
reaching for one — this build has zero design-system dependencies, all custom.
That told me something about my own gap: to direct an agent well, I need to
actually know what external libraries and references exist, so I can ask for
them by name when I want them, instead of getting a capable-but-generic
default by not asking.

Implementing OS detection for the download button made that concrete. I
learned it works by reading `navigator.userAgent` and matching substrings in
a specific order (Android has to be checked before Linux, since Android UAs
also contain "Linux"), falling back to Windows if JavaScript is off rather
than breaking. Small feature, but it's the first time I've directed a
browser-fingerprinting feature rather than just described a page — that's the
kind of specificity I want to get better at asking for.

---

## 회고 (Original Korean Draft)

I have always wanted to change ugly 7-Zip official download page. 7-Zip은 전 세계 사람들이 쓰는 유명한 사이트지만, 디자인은 1990년대에 머물러 있는 타임캡슐 같은 Web Page 같았다. 원래 뜯어고치고 싶은 페이지였어서 Renovation을 거칠 수 있도록 즐겁게 작업하였다.

내가 10년 전 처음 웹 개발을 접했을 때는, Astro고 뭐고 없어서 index.html을 통해 메인 페이지를 접속하는 게 당연하였는데, index.html 파일이 없어서 당황하였다. 웹 구성이 달라져 있더라 (file-based routing in src/pages/). 다행히 Claude Code가 Local에서 pnpm build + pnpm preview를 통해 Prototype 서버를 띄워줘서 잘 확인해 볼 수 있었다.

또한 나는 작업 전까지 Dynamic Web Site = JS를 쓴 Web Site로만 알고 있었다. Server와 로직/DB값 등 직접 인터랙션하는 Web Site가 Dynamic Web Site인 것은 꿈에도 몰랐다. 따라서 Astro에 대해 "아? 왜 Astro + JS를 쓰는데 이래도 Static Web Site이지?"라는 의문이 있었다. Dynamic Web = Beautiful Web Page라고 완전히 잘못 생각하고 있었던 것이다. 어쨌거나, Astro Web Framework에서는 아름다운 Static Web Site를 빠르게 구동할 수 있도록 도와준다.

디자인적인 관점에서 보면, Claude Code는 '특정 UI 라이브러리나 외부 소스를 이용해라'라는 명령이 없으면 그냥 자기가 커스터마이즈해서 직접 CSS 기반으로 코드를 짜는 것 같다. 일단 Claude Code를 잘 쓰려면 다양한 외부 소스/라이브러리를 알아야겠구나 싶었다. So: no dependency on any design system — it's all custom.

또한 다운로드 시 반드시 필요한 기능을 넣었다. Web Browser에서 OS를 파악하는 것!
navigator.userAgent를 읽어 들여 Browser Fingerprint를 읽는 듯했다. (e.g. "Mozilla/5.0 (Windows NT 10.0; Win64; x64)..."). Claude Code는 다음과 같이 서브스트링을 체크하여 User OS별로 다운로드할 수 있도록 디자인해 주었다.

contains "mac os x" or "macintosh" → macOS

> contains "android" → treated as unknown (Android UAs also contain "Linux", so this has to be checked first or it'd misfire)
> 
> contains "linux" → Linux
> 
> contains "win" → Windows

가장 중요한 건, If JavaScript is disabled, it just falls back to a sensible default (Windows) instead of breaking. 즉 JavaScript가 비활성화되어 있으면 불가능한 기능이다.
