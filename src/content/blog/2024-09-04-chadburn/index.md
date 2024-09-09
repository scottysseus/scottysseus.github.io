---
title: "How we built Chadburn"
description: "Making a multiplayer game with CRDTs and WebRTC"
date: "Sep 04 2024"
tags: game-dev typescript web-app
---

I am writing about it somewhat belatedly, but last year, Ana and I built a browser game called _Chadburn_! ♥️ You can play it at [https://chadburn.app](https://chadburn.app) and [check out the source on GitHub](https://github.com/scottysseus/chadburn-app).

So, what prompted this endeavor? Well, just as Ana was wrapping up her coding bootcamp, I had the idea that a game project would not only be super fun but also a great way for her to flex her new programming muscles and for me to try out some new tech I'd been eyeing for a while.

I've long been inspired by the simple and elegant approach used to adapt the boardgame _Codenames_ for the web over at [https://horsepaste.com](https://horsepaste.com), so we decided to do the same for our game. A friend of mine owns a copy of the game [_Wavelength_](https://boardgamegeek.com/boardgame/262543/wavelength) and it seemed like the perfect candidate.

<img src="/images/wavelength-bg.webp" width="640" height="480" class="ml-auto mr-auto" alt="The boardgame Wavelength setup with its characteristic spectrum dial" title="The boardgame Wavelength setup with its characteristic spectrum dial"/>

It's wicked fun, extremely simple, and its gameplay seemed fairly easy to adapt to the web. At its core, _Wavelength_ is a game that tests your and your friends' knowledge of each other: players (in two teams) take turns drawing a spectrum card ("yummy" to "yucky") and giving their teammates a clue ("cilantro") to help them guess a random point along it. The team gets more points the more accurate the guess: in the image above, the blue region at the center of the target is worth 4 points, the orange region is worth 3, and the yellow region is worth 2 points. Then, the opposing team has a chance to earn a point by correctly guessing if the target is to the left or right of the current team's guess. As I hinted at with my example, the clues get quite subjective, which introduces a lot of fun and can lead to debates that get more heated than the game itself 😂.

### Coming up with our theme

In terms of gameplay, our game is a very faithful port of the original with basically zero modifications. To make the game even more casual, we introduced an extra _free play_ mode without teams or scoring, but that's it. We still wanted to add our own flair to really make the end result our own, so we tried to get a bit clever with the game's theme and aesthetic.

The game's spectrum dial reminded me of those old-timey [engine order telegraphs](https://en.wikipedia.org/wiki/Engine_order_telegraph) like they had in the movie _Titanic_, and that link formed the basis for our theme. We used a typewriter-esque font on top of a parchment-textured background to evoke that time period. To create our spectrum dial, I used Inkscape to create a few SVGs, though I stuck with a simple black design rather than attempting to faithfully recreate a lifelike EOT. Finally, we incorporated the theme into the game's name: the most famous manufacturer of engine order telegraphs at the time was Chadburns Telegraph Co. of Liverpool.

Here's a video of what the gameplay looks like. You'll see some of the multiplayer synchronization in action, too 🤓.

<video width="640" height="480" controls>
 <source src="/videos/chadburn-demo.webm" type="video/webm">
</video>

### So how does it work?

Although the game surface is quite simple, a lot is going on under the hood to power its online multiplayer capability, and we invested a decent chunk of time in a slick CI/CD pipeline, all of which I'll explain below.

#### Overview

To start, here is our (aspirational) architecture:

<img src="/images/chadburn-arch.png" width="640" height="480" class="ml-auto mr-auto" alt="Architecture diagram, i.e. boxes and lines" title="Architecture diagram, i.e. boxes and lines"/>

At the heart of our stack is [Yjs](https://github.com/yjs/yjs), which offers a few CRDT primitives around which you can build a shared state framework with seamless conflict resolution. It also provides plugins for various networking standards (most importantly for us, WebRTC and WebSockets). In other words, Yjs allows us to easily implement a distributed leaderless database that lives entirely in our clients' browsers! Of course, this means that if everyone in a game quits, the full game state is lost.

#### Networking

To keep the server infrastructure as simple as possible, we used WebRTC for peer-to-peer networking between clients (AKA players) in each game. Yjs and its WebRTC plugin fully handled the exchange of game state updates between clients and the automatic resolution of any conflicts that may arise as players interact with the game over the network. _Chadburn_ is not fully peer-to-peer, though: our architecture does require a "signaling server" to allow players in the same game to discover each other.

Luckily, Yjs has a small example signaling server that uses WebSockets for communicating with the various clients. When a player starts a new game, they generate a unique code and send it to the server, which uses the code as the ID for a new WebSocket topic. They then share that code with the other players, who also send it to the server to join the same topic. The sample signaling server works well enough for our needs for the most part. We just made a few small tweaks, converted it to TypeScript, and hosted it as a Docker container using GCP Cloud Run behind our custom domain. Its code lives in a separate repository, [chadburn-signaling](https://github.com/scottysseus/chadburn-signaling).

Unfortunately, I wasn't able to figure out a way to make the signaling server truly stateless like we intended in our architecture diagram. Currently, the topic map is saved on the instance in memory. That's one shortcoming I'd like to address in a mini follow-up project.

#### Client

We had a lot of fun building the client using React. I found the [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore) hook to be perfect for bringing in a Yjs document as the source of truth for the game state: the [main game board component](https://github.com/scottysseus/chadburn-app/blob/main/src/scenes/game/Game.tsx#L48) passes events (each with a type and payload) to our [`Store`](https://github.com/scottysseus/chadburn-app/blob/main/src/store/Store.ts#L80), which uses a small state machine to translate them into updates to the CRDT data structure. These (local) changes are merged with changes coming in from other clients, and then the updated state is passed as props to the game board, triggering a re-update. After putting all those elements together, we deployed the front-end app on [Firebase Hosting](https://firebase.google.com/docs/hosting) behind our custom domain. Firebase Hosting's CLI can also generate [GitHub Actions](https://firebase.google.com/docs/hosting/github-integration) that deploy to production with each merged pull request, which we used further simplify our pipeline.

#### Tooling

For build tooling, we used [PNPM](https://pnpm.io/) and [esbuild](https://esbuild.github.io/). We loved esbuild's speed, but it felt a bit barebones: I ended up having to [hack around with our build file](https://github.com/scottysseus/chadburn-app/blob/main/build.js#L28) to get it to run `tsc` and cleanly log any TypeScript errors.

To help keep our code clean, I used [Husky](https://typicode.github.io/husky/) to create [a pre-commit hook](https://github.com/scottysseus/chadburn-app/blob/main/.husky/pre-commit) that runs `eslint`, [`prettier`](https://prettier.io/), and `tsc` before every commit.

#### Testing

Yes, even though this is a hobby project, we had a lot of fun devising our own test strategy. We used Jest to add unit tests (in vanilla JS so we can write them faster), but didn't extensively unit test. Some simple tests for our game state machine and for our Yjs-backed store provided enough coverage for our needs. While creating the Yjs tests, we found that it's super easy to create multiple replicas of the same Yjs Document (the 'root' of the CRDT data structure), so we used that to create multiple instances of our Store and test that it correctly processes events and passes them to other clients.

The most fun part was adding end-to-end tests! Firebase Hosting's GitHub Actions [can also deploy a "preview" instance of your site for each pull request](https://firebase.google.com/docs/hosting/github-integration), which is great for allowing code reviewers to preview the changes and see how they look in the live app. We [tweaked](https://github.com/scottysseus/chadburn-app/blob/main/.github/workflows/firebase-hosting-pull-request.yml#L36) the action to run [Cypress](https://www.cypress.io/) tests against the preview deployment (connected to the production signaling server), which worked extremely well. These tests click around in the app ([see this example](https://github.com/scottysseus/chadburn-app/blob/main/cypress/e2e/game.cy.js)), so they allowed us to automate full games to verify the interactions of our different components and networking code! Although Cypress only supports testing in a single tab, we were able to simulate multiple players by creating additional in-code instances of our game, which we could manipulate, assert against, etc. And, they run quite quickly (< 5 minutes)!

### Highlights

This was Ana's and my first project together, it was awesome and really special to work on something big like this over a few months (complete with pull requests, code reviews, and design meetings 😜). After I created the project structure (the repositories, the scaffolded React app, esbuild, Prettier, the commit hooks) and got a basic prototype working (starting with a [`RotatableImage` component](https://github.com/scottysseus/chadburn-app/blob/main/src/components/RotatableImage.tsx)), we tried to divide up the remaining work. I wired up our Yjs-backed store, while Ana completed most of the game flow logic in our state machine and fleshed out the various components. This article barely scratches the surface of all the fun (and sometimes a little frustrating!) little problems and bugs we worked together to solve; you'd just have to look at the full commit/PR history to begin to understand!

Beyond that, I was very happy with the tight integrations we achieved with all of our various tools. In particular, being able to quickly automate full games in our tests using Firebase Hosting + GitHub Actions + Cypress felt like a superpower!

### Challenges

We've only done one playtest so far with friends, but we ran into synchronization issues between clients (big surprise!). Yjs, which is meant mostly for collaborative document editing, didn't always seem to resolve conflicts between players' replicas in the most sensible way for our game (especially given that all players were in the same room and thus could communicate in real-time outside the game). I suppose this might just be due to the way I structured the game state, I need to debug and experiment more.
