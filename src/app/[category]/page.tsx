import { Suspense } from "react";
import { notFound } from "next/navigation";
import { categories } from "@/lib/data";
import CategoryContent from "@/components/CategoryContent";

interface CategoryPageProps {
  params: Promise<{ category: string }>;
}

export async function generateStaticParams() {
    return categories.map((cat) => ({ category: cat.id }));
}

export async function generateMetadata({ params }: CategoryPageProps) {
    const { category: slug } = await params;
  const category = categories.find((c) => c.id === slug);
  if (!category) return { title: "Not Found" };
  return {
    title: `${category.name} - PixelVault`,
    description: category.description,
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
    const { category: slug } = await params;
  const category = categories.find((c) => c.id === slug);
  if (!category) notFound();

  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-16">
            <p className="text-gray-500 text-lg">Loading...</p>
          </div>
        </div>
      }
    >
      <CategoryContent slug={slug} />
    </Suspense>
  );
}

