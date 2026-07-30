import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { DocsNavTitle } from "@/components/docs-nav-title";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <DocsNavTitle />,
      url: "/docs",
    },
    links: [
      {
        text: "Dashboard",
        url: "https://fluxychat.com",
        external: true,
      },
    ],
    githubUrl: "https://github.com/AlessandroFare/fluxychat",
  };
}
