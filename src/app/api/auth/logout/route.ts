import { NextResponse } from "next/server";
import { destroyOrganizerSession } from "@/lib/auth";

export async function POST() {
  await destroyOrganizerSession();
  return NextResponse.json({ ok: true });
}
