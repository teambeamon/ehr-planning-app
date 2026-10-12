// app/api/categories/route.ts
import { NextResponse } from "next/server";
import { getCategories } from "@/lib/utils";

// Toujours frais : ces routes alimentent les filtres de la page matchs
export const dynamic = "force-dynamic";

export async function GET() {
  const categories = await getCategories();
  return NextResponse.json(categories);
}
