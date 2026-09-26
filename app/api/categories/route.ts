// app/api/categories/route.ts
import { NextResponse } from "next/server";
import { getCategories } from "@/lib/utils";

export async function GET() {
  const categories = getCategories();
  return NextResponse.json(categories);
}
