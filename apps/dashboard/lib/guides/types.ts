export interface GuideLink {
  href: string;
  title: string;
}

export interface GuideSection {
  id?: string;
  title: string;
  paragraphs?: readonly string[];
  bullets?: readonly string[];
  code?: string;
  link?: GuideLink;
}

export interface GuideContent {
  title: string;
  subtitle: string;
  sections: readonly GuideSection[];
  seoTopics: readonly string[];
}

export interface RelatedGuide {
  href: string;
  label: string;
}
