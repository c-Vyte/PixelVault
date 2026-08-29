import { MetadataRoute } from "next";
import { softwareData, categories } from "@/lib/data";
import { SITE_URL } from "@/lib/siteConfig";

const staticPages = [
  "",
  "search",
  "contact",
  "faq",
  "terms",
  "privacy",
  "dmca",
  "pc-check",
  "request",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = staticPages.map((path) => ({
    url: `${SITE_URL}/${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.6,
  }));

  const softwareRoutes = softwareData.map((sw) => ({
    url: `${SITE_URL}/software/${sw.id}`,
    lastModified: new Date(sw.updatedAt || sw.createdAt),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const categoryRoutes = categories.map((cat) => ({
    url: `${SITE_URL}/category/${cat.id}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...staticRoutes, ...softwareRoutes, ...categoryRoutes];
}
