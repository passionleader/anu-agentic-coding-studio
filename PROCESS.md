# Process overview

A reading-guide to how the work came together — a map to your process, not an
essay about it.

## What I built

An unsolicited redesign of [7-zip.org](https://www.7-zip.org/) on Astro: a
home page with one OS-aware download CTA, a download page organised by
platform with real GitHub release links, an FAQ page using native
`<details>/<summary>` accordions, and Support/Links/7z-format/LZMA-SDK pages
matching the original site's menu. The look went through several rounds —
generic "modern framework" glass/gradient, then pulled back toward 7-Zip's own
identity — before landing on a bright palette close to the original, plus
scroll- and pointer-reactive detail the original never had.

## The moments that mattered

This week's process was a loop of request → review → fix, driven by what
didn't feel right yet rather than a fixed plan up front.

1. **Request 1 — try the modern stack.** I wanted to see how far switching to
   Astro, the course's new default, would change the site on its own, rather
   than hand-rolling everything like C1
   ([`60a8b6a`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit2-passionleader/commit/60a8b6a),
   [`fafe0e1`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit2-passionleader/commit/fafe0e1),
   [`9bfd424`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit2-passionleader/commit/9bfd424),
   [`de66c7b`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit2-passionleader/commit/de66c7b)).
   **Review:** satisfied but unfamiliar — the result was sophisticated but
   read as a different site entirely; a real visitor would think the domain
   had changed.
2. **Request 2 — modern framework, original identity.** I asked for the
   original 7-Zip download page's colour scheme so the redesign stayed
   recognisably *7-Zip*, not a generic template
   ([`408f714`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit2-passionleader/commit/408f714)).
   **Review:** the colours landed, but the page stopped being functional — no
   sidebar like the original, download links weren't wired up, and as a Linux
   user I was being shown a `.exe` on the front page. That gap between "looks
   redesigned" and "actually works for the visitor in front of it" is exactly
   what an unsolicited redesign can't skip.
3. **Request 3 — fix the functionality and the interface.** I asked for the
   original's side menu, for the download button to link straight to the real
   release asset, and for the home page to detect the visitor's OS and offer
   the right download directly
   ([`6fb47dc`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit2-passionleader/commit/6fb47dc),
   [`d0204e0`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit2-passionleader/commit/d0204e0),
   [`8d7772b`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit2-passionleader/commit/8d7772b),
   [`9f83fa3`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit2-passionleader/commit/9f83fa3),
   [`b99532a`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit2-passionleader/commit/b99532a),
   [`c2c12e2`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit2-passionleader/commit/c2c12e2)).
   The OS check reads `navigator.userAgent` and matches substrings in a
   specific order — Android has to be checked before Linux, since Android UAs
   also contain "Linux" and would otherwise misfire — and falls back to
   Windows rather than breaking if JS is off or the UA is unrecognised.
   **Review:** confirmed — functionality and interface both checked out.
4. **Request 4 — design inspired by sites people actually admire.** I asked
   for the transparent/gradient look common in current web design, plus
   interactive touches: elements reacting to pointer position, the page
   subtly shifting on scroll
   ([`d002e47`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit2-passionleader/commit/d002e47),
   [`ad6a70f`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit2-passionleader/commit/ad6a70f),
   [`f8ddb3f`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit2-passionleader/commit/f8ddb3f),
   [`3223d84`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit2-passionleader/commit/3223d84)).
   **Review:** satisfied — the reference point was Apple's product pages;
   this doesn't reach that bar, but it's a good outcome for the scope.
5. **Request 5 — buttons over raw hyperlinks.** Default blue underlined links
   looked out of place next to the rest of the redesign, so I asked for
   buttons wherever an action was implied, and a single signature colour
   (light purple) for whatever stayed a plain link; platform icons were added
   to the download page in the same pass
   ([`045f108`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit2-passionleader/commit/045f108),
   [`cc4243e`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit2-passionleader/commit/cc4243e)).
   **Review:** satisfied.
6. **Everything else** was small functional and visual corrections, re-run
   when an instruction wasn't followed correctly the first time — footer
   spacing, an id collision, and a leftover OS-detection edge case on the
   download page
   ([`ff7178a`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit2-passionleader/commit/ff7178a)).

## What this changes for next time

Nothing here needed a new standing `CLAUDE.md` rule yet — each round's
mismatch (unfamiliar look, then broken functionality) was caught by reviewing
the live page, not by a missing sensor. If a future week has this same
"looks redesigned but a whole subsystem stopped working" gap slip past review
undetected, that's the point at which it earns an explicit check, e.g. a spec
test asserting every advertised download link actually resolves.



## Process Overview (Original Korean Draft)

Request1: 최신 HTML 기술과 웹 기술을 써서 7-Zip 다운로드 페이지를 업그레이드한 페이지를 요청

* 최신 웹 프레임워크인 Astro를 적용하면 어느 정도까지 변화될 수 있을지 궁금했다.

Review1: 만족스럽지만 이질감 들어

* 지난주랑 동일한 "Static Web Page"인데, Latest Web Framework인 Astro를 사용하는 것만으로도 상당히 고급진 사이트를 얻을 수 있었다. 다만 기존 7-Zip과 비교했을 때 너무 이질감이 들었다. 사람들이 도메인이 바뀌었다고 당황할 게 분명했다.

Request2: 최신 웹 프레임워크를 적용하되, 디자인은 오리지널을 유지하자!

* 이전 인터페이스랑 너무 이질감이 들지 않도록 다음과 같은 디자인 변경을 요청했다. 오리지널 7-Zip 다운로드 페이지가 쓰고 있는 Color Scheme을 적용할 것

Review2: 어느 정도 디자인은 잡혔으나, 기능을 다 하지 못하는 페이지

* 오리지널 페이지에 보이는 사이드바의 부재, 그리고 다운로드 링크도 잘 연동이 되지 않았다. 그리고 나는 Linux를 쓰고 있었는데 EXE 파일을 메인 페이지에 띄워주어 짜증이 솟구쳐올랐다.

Request3: 기능적인 내용 보완, 인터페이스 보완

* 오리지널 7-Zip 다운로드 페이지에서 보이는 사이드 메뉴를 추가하도록 요청했다. 또한 다운로드 버튼을 누르면 실제 다운로드 서버 링크에서 바로 파일을 다운로드받을 수 있도록 요청하였다. 메인 메뉴에서는 OS를 인식해서 바로 다운로드할 수 있는 버튼을 띄우도록 하였다.

Review3: 기능적인 부분 수정 확인

* 기능적인 부분과, 인터페이스를 수정했다.

Request4: 유명한 사이트에서 영감을 받아 디자인 변경 요청

* 최신 웹에서 유행하는 디자인인 투명/Gradient 디자인을 요청했다. 또한 마우스 위치에 따라 버튼/상자 크기가 변하거나, 스크롤에 따라 화면이 조금씩 변하도록 Interactive 기능을 요청을 했다.

Review4: 만족스러운 결과물. UI 목표는 Apple이었지만 이 정도도 만족한다.

Request5: 버튼 구현 / 하이퍼링크 제거 및 교체

* 파란색 하이퍼링크라니 너무 구렸다. 따라서 가능한 버튼으로 교체를 요청하였다.

* 그 외 남은 하이퍼링크는 트레이드마크 연보라색 하이퍼링크 색으로 교체했다.

* 다운로드 페이지에 Windows, Mac, Linux 아이콘을 추가하였다.

Review5: 만족

etc: 위와 같은 자잘한 기능 및 디자인 오류 위주로 요청했으며, 제대로 알아먹지 못하면 다시 수행하도록 요청하였다.
