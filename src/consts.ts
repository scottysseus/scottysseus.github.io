import type { Site, Metadata, Socials } from "@types";

export const SITE: Site = {
  NAME: "Scott's Odyssey",
  EMAIL: "sweidenkopf@gmail.com",
  NUM_POSTS_ON_HOMEPAGE: 3,
  NUM_PROJECTS_ON_HOMEPAGE: 3,
};

export const HOME: Metadata = {
  TITLE: "Home",
  DESCRIPTION: "Scott's Odyssey",
};

export const BLOG: Metadata = {
  TITLE: "Blog",
  DESCRIPTION: "A collection of articles on topics I am passionate about.",
};

export const SOCIALS: Socials = [
  {
    NAME: "github",
    HREF: "https://github.com/scottysseus",
  },
  {
    NAME: "linkedin",
    HREF: "https://www.linkedin.com/in/scottysseus/",
  },
];
