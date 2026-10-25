---
title: How to write a post
date: 2026-10-24
category: guides
tags: [meta, markdown, how-to]
description: Everything you need to publish here — one markdown file, a few lines of settings at the top, and a push to GitHub.
cover: /images/2026/radio-studio-day.jpg
cover_alt: A radio studio with microphones and a mixing desk
featured: true
---

Every post on this blog is a single text file written in **markdown** — plain text with a few symbols for formatting. There's no editor to log in to. You write a file, save it, and push it to GitHub. A minute later it's live.

This post doubles as the manual. It's long on purpose, so you'll see the **outline** beside it (or, on a phone, the "On this page" box above).

## Where posts live

Posts are grouped by year, the same way their links are:

```text
content/posts/2026/how-to-write-a-post.md   →   blog.v4.run/2026/how-to-write-a-post/
content/posts/2025/a-quiet-beach.md         →   blog.v4.run/2025/a-quiet-beach/
```

The **file name becomes the link**, so keep it short, lowercase, with hyphens between words. Once a post is published, don't rename it — old links would break.

> [!TIP]
> The year in the link comes from the post's `date`. If you put a post in the wrong year's folder, the build will tell you.

## The settings block

Every post starts with a few lines between two `---` lines. This is called **front matter**. Here's a complete example:

```yaml
---
title: The AI age of justice
date: 2026-10-24
author: varun
category: essays
tags: [justice, AI, courts]
description: One or two sentences shown on cards, in search and when shared.
cover: /images/2026/my-photo.jpg
cover_alt: What the photo shows, for people who can't see it
cover_caption: Optional line under the photo
featured: true
---
```

Only `title` and `date` are required. Everything else is optional:

| Setting | What it does |
| --- | --- |
| `title` | The headline. |
| `date` | Publish date, written `YYYY-MM-DD`. Decides the year in the link. |
| `updated` | Optional. Shows "Updated …" if you revise a post later. |
| `author` | Who wrote it. Leave it out and it's you. For several people: `author: [varun, guest]`. |
| `category` | One of the categories in `site.yml` — `essays`, `notes`, `field-notes` or `guides`. |
| `tags` | Any words you like, in square brackets. Each gets its own page. |
| `description` | The summary under the title. If left out, the first paragraph is used. |
| `cover` | The big picture at the top. Without one, a dot-sphere pattern is drawn instead. |
| `featured` | `true` puts the post in the Featured section on the homepage. |
| `draft` | `true` hides the post from the live site. It still shows while previewing. |
| `outline` | `true` or `false` to force the outline on or off. By default it appears when a post has three or more sections. |
| `comments` | `false` switches comments off for this post. |

## Writing the text

Below the settings block, write normally. A blank line starts a new paragraph.

### Headings

Start a line with `##` for a section and `###` for a sub-section. These build the outline automatically, and each one gets a link you can share — hover a heading and click the `#`.

### Emphasis and links

Use `**bold**` for **bold**, `*italic*` for *italic*, and `[words](https://example.com)` for [a link](https://v4.run). Links to other sites get a small ↗ so readers know they're leaving.

### Lists

```markdown
- A bullet point
- Another one

1. A numbered step
2. The next step
```

### Quotes and callouts

Start a line with `>` for a quote:

> The arc of the moral universe bends toward justice — if we bend it.

Add `[!NOTE]`, `[!TIP]` or `[!WARNING]` on the first line to make a callout box:

> [!NOTE]
> Callouts are good for side remarks the reader shouldn't miss.

## Pictures

Put image files in `public/images/<year>/` and refer to them starting with `/images/`. A picture on its own line becomes a full-width figure. Text in quotes after the file name becomes the caption:

```markdown
![A quiet beach path](/images/2025/quiet-beach-path.jpg "Empty places hold the loudest memories.")
```

![A sandy path between trees leading to a beach](/images/2025/quiet-beach-path.jpg "Empty places hold the loudest memories.")

> [!TIP]
> Keep photos under about 2,000 pixels wide. On a Mac, Preview → Tools → Adjust Size does this in seconds.

The text in square brackets is the **alt text** — a description for people using screen readers. Always write one.

## Authors

Authors are listed in `content/authors.yml`. Each has a short key (like `varun`), a name, and optionally a bio, a photo and a website. To add a guest writer, add an entry there, then use their key in the post's `author:` line. Posts with more than one author show everyone's name and bio.

## Categories and tags

**Categories** are the few big shelves, and each post sits on exactly one. They're defined in `site.yml` with a name and description — add a new one there before using it.

**Tags** are loose labels. Use as many as help, and make up new ones whenever you like.

## Publishing

1. Save the file in `content/posts/<year>/`.
2. Preview it on your computer with `npm run dev` (see the README).
3. Commit and push to GitHub. Cloudflare builds and publishes the blog automatically.

If something's wrong in a post — a missing title, an unknown author, a typo in a category — the build stops and says exactly which file to fix. The live site keeps the last good version until you do.
