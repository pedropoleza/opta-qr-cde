import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireOrganizer, jsonError } from "@/lib/api";
import { slugify } from "@/lib/slug";

export async function GET() {
  const session = await requireOrganizer();
  if (session instanceof NextResponse) return session;

  const events = await prisma.event.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { date: "desc" },
    include: {
      _count: { select: { guests: true } },
    },
  });
  return NextResponse.json({ events });
}

export async function POST(req: NextRequest) {
  const session = await requireOrganizer();
  if (session instanceof NextResponse) return session;

  const body = await req.json();
  const { name, date, startTime, endTime, locationName, address, capacity } = body;
  if (!name || !date) return jsonError(400, "Nome e data são obrigatórios");

  const event = await prisma.event.create({
    data: {
      organizationId: session.organizationId,
      name,
      slug: slugify(name),
      date: new Date(date),
      startTime: startTime || null,
      endTime: endTime || null,
      locationName: locationName || null,
      address: address || null,
      capacity: capacity ? Number(capacity) : null,
      status: "draft",
      // D4: credencial do Checker — link único + PIN de 6 dígitos por evento.
      checkerToken: Buffer.from(randomUUID()).toString("base64url"),
      checkerPin: String(Math.floor(100000 + Math.random() * 900000)),
    },
  });
  return NextResponse.json({ event }, { status: 201 });
}
