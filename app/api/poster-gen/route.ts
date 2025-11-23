import { NextRequest, NextResponse } from "next/server";

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const RUNPOD_ENDPOINT_URL = process.env.RUNPOD_ENDPOINT_URL;

export async function POST(request: NextRequest) {
  try {
    if (!RUNPOD_API_KEY || !RUNPOD_ENDPOINT_URL) {
      return NextResponse.json(
        {
          error:
            "RunPod configuration missing. Please set RUNPOD_API_KEY and RUNPOD_ENDPOINT_URL in your environment.",
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const instruction: string | undefined = body?.instruction;

    if (!instruction || typeof instruction !== "string" || !instruction.trim()) {
      return NextResponse.json(
        { error: "Missing or invalid 'instruction' in request body." },
        { status: 400 }
      );
    }

    // This payload assumes a typical RunPod diffusion-style endpoint.
    // Adjust the `input` structure to match your specific endpoint's schema.
    const runpodPayload = {
      input: {
        prompt: instruction,
      },
    };

    const runpodResponse = await fetch(RUNPOD_ENDPOINT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNPOD_API_KEY}`,
      },
      body: JSON.stringify(runpodPayload),
    });

    if (!runpodResponse.ok) {
      const errorText = await runpodResponse.text();
      return NextResponse.json(
        {
          error: "RunPod diffusion request failed",
          status: runpodResponse.status,
          details: errorText,
        },
        { status: 502 }
      );
    }

    const runpodJson = await runpodResponse.json();

    console.log("RunPod response:", runpodJson);

    // You can shape this however you want. For now we just pass through
    // the important bits so the frontend can inspect it.
    return NextResponse.json(
      {
        success: true,
        runpod: runpodJson,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error in /api/poster-gen:", error);
    return NextResponse.json(
      {
        error: "Unexpected server error",
        details: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}
