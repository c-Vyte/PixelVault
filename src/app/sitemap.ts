import type { MetadataRoute } from "next";
import { getPublishedSoftwareList } from "@/lib/data";
import { SITE_URL } from "@/lib/siteConfig";

export const dynamic = "force-dynamic";

const CATEGORIES = [
  "pc-games",
  "windows",
  "mac",
  "android",
  "movies",
  "ebooks",
  "tutorials",
  "korean",
] as const;

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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = staticPages.map((path) => ({
    url: path ? `${SITE_URL}/${path}` : `${SITE_URL}/`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.6,
  }));

  const categoryRoutes: MetadataRoute.Sitemap = CATEGORIES.map((cat) => ({
    url: `${SITE_URL}/category/${cat}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  // Dynamic software entries — only published items with valid download links
  const softwareList = await getPublishedSoftwareList();

  const softwareRoutes: MetadataRoute.Sitemap = softwareList.map((sw) => ({
    url: `${SITE_URL}/software/${sw.id}`,
    lastModified: sw.updatedAt ? new Date(sw.updatedAt) : sw.createdAt ? new Date(sw.createdAt) : new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...categoryRoutes, ...softwareRoutes];
}
