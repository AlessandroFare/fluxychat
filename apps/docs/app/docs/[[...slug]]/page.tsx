import { source } from "@/lib/source";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import type { MDXComponents } from "mdx/types";
import { ImageZoom } from "fumadocs-ui/components/image-zoom";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { File, Files, Folder } from "fumadocs-ui/components/files";
import { InlineTOC } from "fumadocs-ui/components/inline-toc";
import { Callout } from "fumadocs-ui/components/callout";
import { Card, Cards } from "fumadocs-ui/components/card";
import { TypeTable } from "fumadocs-ui/components/type-table";
import { Banner } from "fumadocs-ui/components/banner";
import {
  DocsBody,
  DocsPage,
  DocsDescription,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import { OpenAPIPage } from "@/components/openapi-page";
import { DocsPageTopBar } from "@/components/docs-page-top-bar";
import { getPageMarkdownUrl } from "@/lib/markdown-url";
import { gitConfig } from "@/lib/shared";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

const baseMdxComponents: MDXComponents = {
  ...defaultMdxComponents,
  Accordion,
  Accordions,
  Step,
  Steps,
  Tab,
  Tabs,
  File,
  Files,
  Folder,
  InlineTOC,
  ImageZoom,
  Callout,
  Card,
  Cards,
  TypeTable,
  Banner,
};

function githubUrlForPage(pagePath: string) {
  return `https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/apps/docs/content/docs/${pagePath}`;
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const slug = (await params).slug;
  const page = source.getPage(slug);

  if (!page) {
    notFound();
  }

  const markdownUrl = getPageMarkdownUrl(page).url;

  if (page.type === "openapi") {
    const openapiProps = page.data.getOpenAPIPageProps();

    return (
      <DocsPage toc={page.data.toc} full breadcrumb={{ enabled: false }}>
        <DocsPageTopBar markdownUrl={markdownUrl} />
        <DocsTitle>{page.data.title}</DocsTitle>
        {page.data.description ? (
          <DocsDescription className="mb-6">
            {page.data.description}
          </DocsDescription>
        ) : null}
        <DocsBody>
          <OpenAPIPage {...openapiProps} showDescription={false} />
        </DocsBody>
      </DocsPage>
    );
  }

  const { body: Body, toc } = await page.data.load();

  return (
    <DocsPage
      toc={toc}
      full={page.data.full ?? false}
      breadcrumb={{ enabled: false }}
    >
      <DocsPageTopBar
        markdownUrl={markdownUrl}
        githubUrl={githubUrlForPage(page.path)}
      />
      <DocsTitle>{page.data.title}</DocsTitle>
      {page.data.description ? (
        <DocsDescription className="mb-6">
          {page.data.description}
        </DocsDescription>
      ) : null}
      <DocsBody>
        <Body components={baseMdxComponents} />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const slug = (await params).slug;
  const page = source.getPage(slug);

  if (!page) {
    return {};
  }

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
