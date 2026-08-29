import { Metadata } from "next";
import { softwareData } from "@/lib/data";
import SoftwareClient from "./SoftwareClient";

export function generateStaticParams() {
  return softwareData.map((sw) => ({ id: sw.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const software = softwareData.find((s) => s.id === id);

  if (!software) {
    return { title: "Not Found - PixelVault" };
  }

  return {
    title: `${software.title} - Download | PixelVault`,
    description: software.description.slice(0, 160),
    openGraph: {
      title: `${software.title} - Download | PixelVault`,
      description: software.description.slice(0, 160),
      type: "website",
      images: software.poster ? [software.poster] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: `${software.title} - Download | PixelVault`,
      description: software.description.slice(0, 160),
      images: software.poster ? [software.poster] : [],
    },
  };
}

export default function SoftwarePage() {
  return <SoftwareClient />;
}
