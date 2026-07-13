import { NextResponse } from "next/server";
import { addSubmission, getSubmissions } from "@/lib/store";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  return NextResponse.json(await getSubmissions(params.id));
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { hunter, summary, links } = body as Record<string, string>;
  if (!hunter) {
    return NextResponse.json({ error: "Connect a wallet first" }, { status: 400 });
  }
  if (!summary?.trim()) {
    return NextResponse.json(
      { error: "Describe what you delivered" },
      { status: 400 }
    );
  }

  try {
    const submission = await addSubmission({
      bountyId: params.id,
      hunter,
      summary,
      links: links || "",
    });
    return NextResponse.json(submission, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to submit" },
      { status: 400 }
    );
  }
}
