---
title: "How we built Chadburn"
description: "Making a multiplayer game with CRDTs and WebRTC"
date: "Sep 04 2024"
tags: game-dev typescript web-app
---

This is my first post about it, but last year, my wife and I made a browser game together! ♥️

### About the game

Our game, [Chadburn](https://github.com/scottysseus/chadburn-app), is a browser port of the party board game [Wavelength](https://boardgamegeek.com/boardgame/262543/wavelength) by Alex Hague, Justin Vickers, and Wolfgang Warsch. Wavelength tests your and your friends' knowledge of each other: players (in two teams) take turns drawing a spectrum ("fragrant" to "malodorous") and giving their teammates a clue ("durian") to help them guess a random point along it. The team gets more points the more accurate the guess.

We named our game after those old-timey [engine order telegraphs](https://en.wikipedia.org/wiki/Engine_order_telegraph) like they had in the movie _Titanic_; the most famous manufacturer of them was Chadburns Telegraph Co. of Liverpool.

Chadburn is fully multiplayer, and we took a lot of design cues from the wonderful [horsepaste.com](horsepaste.com) in adapting Wavelength for the browser as simply as possible.

<video width="640" height="480" controls>
 <source src="/videos/chadburn-demo.webm" type="video/webm">
</video>

As you can see, the host player starts the game, and from there they can share the URL with their friends to begin play.

### So how does it work?

#### Networking

To keep server infrastructure as simple as possible, we used WebRTC for peer-to-peer networking between clients (AKA players) in each game. To keep each client's game state synchronized, we used [Yjs](https://github.com/yjs/yjs) (which provides most of the WebRTC networking out of the box). Yjs offers a few CRDT primitives around which you can build a shared state framework with seamless conflict resolution, and it also provides plugins for various networking standards (the aforementioned WebRTC, plus things like WebSockets) and open source text editors (its primary use case is collaborative document editing). In other words, Yjs allows us to easily implement a distributed, leaderless database that lives entirely in our clients' browsers! Of course, this means that if everyone in a game quits, the full game state is lost.

#### Client

We had a lot of fun building the client using React. I found the [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore) hook to be perfect for bringing in a Yjs document as the source of truth for game state: the main game board component passes events (each with a type and payload) to our Store, which uses a small state machine to translate them them into updates to the CRDT data structure. These (local) changes are merged with changes coming in from other clients, and then the updated state is passed as props to the game board, triggering a re-update. This part of the app felt super smooth! Beyond that, we used SVG for the Chadburn-inspired dial, which I made in Inkscape. Neither of us are very skilled as graphic designers, but we aimed to capture an early 20th century Titanic-y vibe with the font and parchment-textured background. After putting all those elements together, we deployed the front end app on [Firebase Hosting](https://firebase.google.com/docs/hosting) behind our custom domain. Firebase Hosting's CLI can also generate [GitHub Actions](https://firebase.google.com/docs/hosting/github-integration) that deploys to production with each merged pull request, which further simplified our pipeline.

#### Server

I mentioned above that our app is mostly peer-to-peer: it does require a signaling server for the various peers in a single game to discover each other. Luckily, Yjs has a small example signaling server which uses WebSockets for communicating with the various clients. We made a few small tweaks, converted it to TypeScript, and hosted it as a Docker container using GCP Cloud Run behind our custom domain. It's code lives in a separate repository, [chadburn-signaling](https://github.com/scottysseus/chadburn-signaling).

#### Tooling

For build tooling, we used [PNPM](https://pnpm.io/) and [esbuild](https://esbuild.github.io/). We loved esbuild's speed, but it felt a bit barebones: I ended up having to [hack around with our build file](https://github.com/scottysseus/chadburn-app/blob/main/build.js#L28) to get it to run `tsc` and cleanly log any TypeScript errors.

To help keep our code clean, I used Husky to create [a pre-commit hook](https://github.com/scottysseus/chadburn-app/blob/main/.husky/pre-commit) that runs `eslint`, [Prettier](https://prettier.io/), and `tsc` before every commit.

#### Testing

Yes, even though this is a hobby project, we had a lot of fun devising our own test strategy. We used Jest to add unit tests (in vanilla JS so we can write them faster), but didn't extensively unit test. Some simple tests for our game state machine and for our Yjs-backed store provided enough coverage for our needs. While creating the Yjs tests, we found that it's super easy to create multiple replicas of the same Yjs Document (the 'root' of the CRDT data structure), so we used that to create multiple instances of our Store and test that it correctly processes events and passes them to other clients.

The most fun part was adding end-to-end tests! Firebase Hosting's GitHub Actions [can also deploy a "preview" instance of your site for each pull request](https://firebase.google.com/docs/hosting/github-integration), which is great for allowing code reviewers to preview the changes and see how they look in the live app. We [tweaked](https://github.com/scottysseus/chadburn-app/blob/main/.github/workflows/firebase-hosting-pull-request.yml#L36) the action to run [Cypress](https://www.cypress.io/) tests against the preview deployment (connected to the production signaling server), which worked extremely well. These tests actually click around in the app, so they allowed us to automate full games to verify the interactions of our different components and networking code! Although Cypress only supports testing in a single tab, we were able to simulate multiple players by creating additional in-code instances of our game, which we could manipulate, assert against, etc. And, they run quite quickly (< 5 minutes)!

### Highlights

This was my wife's and my first project together, it was awesome and really special to work on something big like this over the course of a few months (complete with pull requests, code reviews, and design meetings 😜).

Beyond that, I was very happy with the very tight integrations we achieved with all of our various tools. In particular, being able to quickly automate full games in our tests using Firebase Hosting + GitHub Actions + Cypress felt like a superpower!

### Challenges

We've only done one playtest so far with friends, but we ran into synchronization issues between clients (big surprise!). Yjs, which is meant mostly for collaborative document editing, didn't always seem to resolve conflicts between players' replicas in the most sensible way for our game (especially given that all players were in the same room and thus could communicate in real time outside the game). I suppose this might just be due to the way I structured the game state, I really need to debug and experiment more.
