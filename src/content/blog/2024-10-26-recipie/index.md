---
title: "I've been dabbling with Gen AI"
description: "Building an AI-powered recipe organizer"
date: "Oct 26 2024"
tags: ai llm solidjs pocketbase typescript web-app
---

You know those AI you've seen in sci-fi movies? Well it turns out they're real, so I had to take one for spin.

I realized I had one problem that these LLMs seemed perfectly suited to solve: recipe organization.

Imagine you're like me and your "cookbook" is just a Google Keep note with a list of the URLs for ~70 recipe blog posts from all over the web. Dealing with Keep on mobile kinda sucks but that's a separate issue. Bigger concerns include the possibility that the author of the recipe might take it down or modify it. Then, there's the hassle of fighting through ads and fluff to scroll down to the actual recipe. I realized it wouldn't be too difficult to set up an app that can scrape those sites and hand them off to an LLM to extract the recipe and return it in some structured form like JSON.

So, I built [Recipie](https://github.com/scottysseus/recipie), a simple recipe organizing tool where you can copy your list of recipe links from wherever you keep them and with a single click automatically import them into one place. I don't have it hosted

Here's a demo to showcase it:

<video width="640" height="480" controls>
 <source src="/videos/recipie-demo.webm" type="video/webm">
</video>

It has a few key features:

- Import recipes from anywhere on the web!
- Import many recipes at once
- Import multiple recipes from a single page
- View your recipes in full, including metadata like prep time where available
- Simple auth (in this case, using Google OAuth)

# How it works

I built Recipie using [PocketBase](https://pocketbase.io/) as my backend framework, and had overall a fantastic experience working with it.

For each URL submitted via the import flow, a `smartImport` record is added to PocketBase's built-in database. From there, I added a database event hook (super simple to set up) to listen for changes to the `smartImport` collection and, for each new record, kick off the import job.

The first step in the job is to scrape the text from the recipe's web page. I actually struggled with this more than I expected; I found the available Golang scraping tools to be somewhat unintuitive. In the end I was able to get [`goquery`](https://github.com/PuerkitoBio/goquery) to work. From there, the worker appends the raw recipe text to my special prompt and sends the lot off to Google's [Vertex AI](https://cloud.google.com/vertex-ai?e=48754805). Vertex responds with a JSON structure containing the recipe's info, ingredients, and instructions, which the worker saves as a `recipe` record in the database. Throughout this process, the import job updates the smartImport record with its current status: notably, if any error is encountered and the job is unable to complete, it sets the status to "error" and halts.

I went through a few iterations of this pipeline. My first iteration had a freakishly bloated database schema, complete with a separate collection for ingredient records (not sure what I was thinking there). The major problem with it, though, was my handling of the import job: I kicked the job off as a bunch of goroutines, but did so in a way that they were tied to the request context. This didn't matter for small imports of only a handful of recipes, but for my huge list of over 70, only about half of them were successfully imported before the request timed out. After the time out, all of the incomplete imports were left in a bad state, with their statuses still set to "processing". After reading the PocketBase docs, I found the [right database event hooks](https://github.com/scottysseus/recipie/blob/43b4a61c423a073e3df82d51ee00fe6158b6f2bd/server/main.go#L60) that are not tied to the request context and got everything working properly in the end.

# ~Crude~ "Minimalist" UI

Okay so it looks a bit crude, but I had a lot of fun building the UI using [SolidJS](https://www.solidjs.com/) and [Tailwind](https://tailwindcss.com/). Solid provides a fantastic JSX experience that's much closer to plain HTML than React, while having a simpler mental model and tiny footprint (it's a fraction of the size of React and vastly more performant). It also has all batteries included: it has its router, context and state management tools, and even an SSR framework. More than anything, though, I just am ready to leave all of React's bloat behind: React has at least 3 different paradigms (class-based components, hook-based functional components, and soon signals with some kind of compilation) all cluttering up the namespace and making a uniform style difficult to achieve in large teams. This ended up being a solo project, but even still I wanted to work with a clean and simple tool, and Solid fit the bill.

Tailwind was another new addition to my repertoire, but as with Solid, I quickly became hooked. Its approach to styling via utility classes combined with Solid's JSX means I never need to leave my `.tsx` files when working on UI components, which for me is a HUGE productivity boost. Its classnames aren't the easiest to read at first, but you quickly start to get a feel for the patterns, and it has great VS Code plugins for autocompleting and formatting the classlists.

After getting those two tools set up (with [Prettier](https://prettier.io/), of course), it was fun to bring in PocketBase's client library (including auth and database querying) using Solid's [Context system](https://github.com/scottysseus/recipie/blob/43b4a61c423a073e3df82d51ee00fe6158b6f2bd/client/src/PocketBaseContext.tsx#L14) to make it available to all the UI components.

# Deployment

Initially, setting up the deployment was a breeze, it was not much trouble at all to set up Firebase Hosting for the client and GCP Cloud Run for my PocketBase app container.

From there, though, Recipie proved quite a bit more complicated than my last project (Chadburn). The biggest challenge was authenticating when connecting to Vertex: I needed a solution that works as easily during local development as it does in the cloud. For local development, I used [a bind mount](https://github.com/scottysseus/recipie/blob/43b4a61c423a073e3df82d51ee00fe6158b6f2bd/package.json#L19) to mount the local GCP credentials directory into the container. For the production deployment, I provisioned a service account with Vertex access and configured the Cloud Run container to use it. Other pieces I had never tried before include setting up a GCS bucket as a volume mount for the container (very easy) and setting up Google OAuth to work with PocketBase (also very easy).

# Open questions

After getting this to a minimum-viable product, I've already moved on to other projects. Still, I can see lots of areas for further exploration here, specifically around improving the import pipeline.

For one thing, it has a pretty high error rate. Vertex seems to miss recipes from the URLs in many cases, perhaps some prompt tuning can improve that. In other cases, though, Vertex stops generating response tokens quite abruptly, presumably when it detects some [data provenance or intellectual property violations](https://cloud.google.com/vertex-ai/generative-ai/docs/reference/python/latest/vertexai.preview.generative_models.FinishReason):

```
FINISH_REASON_RECITATION: The token generation was stopped because the response was flagged for unauthorized citations.
```

This is a much harder thing to work around, as at least when I initially encountered this some months ago there was little documentation on the topic. This sort of thing makes me consider switching LLM platforms to compare results.

For URLs that are imported successfully, there is lots of potential for data cleanup. The two biggest areas of messiness I noticed are natural language quantities and inconsistent notation of the units.

Natural language quantities like "1 / 2" need to be converted to numbers (0.5 in this case), but LLMs are notoriously bad at arithmetic, so this would have to be taken care of in a post-processing step. Thankfully, this is well-trod ground for "classical" approaches to NLP. I also found that units are expressed very inconsistently in the source material and Vertex wasn't too reliable in normalizing them. For example, I'd like "g", "gram", and "grams" to all get normalized to "g". This cleanup might not seem particularly important, but would massively aid in development of features like recipe scaling.

I don't know when I'll pick this project back up, but there is still some interesting work to be done here.

# The competition

While working on this project, a friend sent me a link to [Cooked](https://cooked.wiki/). Cooked was built by a one-person startup and seems to take the same LLM-driven approach as Recipie, but it is vastly more polished and claims to have attracted hundreds of thousands of users. Rather than continuing to invest more of my time in Recipie, I think I'll move on to other projects and settle for signing up with cooked.wiki/ 🙂
