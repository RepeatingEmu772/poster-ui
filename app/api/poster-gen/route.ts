import { NextRequest, NextResponse } from "next/server";

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const RUNPOD_IMAGE_GEN_URL = process.env.RUNPOD_IMAGE_GEN_URL;
const RUNPOD_TEXT_PLACEMENT_URL = process.env.RUNPOD_TEXT_PLACEMENT_URL;

// Poll status endpoint until job completes
async function pollRunPodStatus(jobId: string, baseUrl: string, maxAttempts = 60, intervalMs = 2000) {
  const statusUrl = `${baseUrl.replace('/run', '')}/status/${jobId}`;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    console.log(`Polling attempt ${attempt + 1}/${maxAttempts} for job ${jobId}`);
    
    const statusResponse = await fetch(statusUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${RUNPOD_API_KEY}`,
      },
    });

    if (!statusResponse.ok) {
      throw new Error(`Status check failed: ${statusResponse.status}`);
    }

    const statusData = await statusResponse.json();
    console.log(`Job ${jobId} status:`, statusData.status);

    // Check if job is complete
    if (statusData.status === 'COMPLETED') {
      return statusData;
    }

    if (statusData.status === 'FAILED') {
      throw new Error(`Job failed: ${JSON.stringify(statusData)}`);
    }

    // If still in queue or in progress, wait and retry
    if (statusData.status === 'IN_QUEUE' || statusData.status === 'IN_PROGRESS') {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      continue;
    }

    // Unknown status
    throw new Error(`Unknown job status: ${statusData.status}`);
  }

  throw new Error(`Job ${jobId} did not complete within ${maxAttempts} attempts`);
}

export async function POST(request: NextRequest) {
  try {
    if (!RUNPOD_API_KEY || !RUNPOD_IMAGE_GEN_URL || !RUNPOD_TEXT_PLACEMENT_URL) {
      return NextResponse.json(
        {
          error:
            "RunPod configuration missing. Please set RUNPOD_API_KEY, RUNPOD_IMAGE_GEN_URL, and RUNPOD_TEXT_PLACEMENT_URL in your environment.",
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const instruction: string | undefined = body?.instruction;
    const canvasContext = body?.canvasContext;

    if (!instruction || typeof instruction !== "string" || !instruction.trim()) {
      return NextResponse.json(
        { error: "Missing or invalid 'instruction' in request body." },
        { status: 400 }
      );
    }

    // Determine which endpoint to use based on whether there's existing canvas context
    const hasExistingImage = canvasContext?.existingImage?.url;
    const endpointUrl = hasExistingImage ? RUNPOD_TEXT_PLACEMENT_URL : RUNPOD_IMAGE_GEN_URL;
    
    // Build the appropriate payload
    let runpodPayload;
    
    if (hasExistingImage) {
      // Text placement request - send full context
      runpodPayload = {
        input: {
          instruction: instruction,
          canvasContext: canvasContext,
        },
      };
    } else {
      // Image generation request - just send prompt
      runpodPayload = {
        input: {
          prompt: "Dont include any text in the image. You are making only the background of a poster with this context: " + instruction + ". ",
          negative_prompt: "",
          size: "2048*2048",
          seed: -1,
          enable_safety_checker: true,
        },
      };
    }

    console.log(`Using endpoint: ${endpointUrl}`);
    console.log("Sending to RunPod:", JSON.stringify(runpodPayload, null, 2));

    const runpodResponse = await fetch(endpointUrl, {
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
          error: "RunPod request failed",
          status: runpodResponse.status,
          details: errorText,
        },
        { status: 502 }
      );
    }

    let runpodJson = await runpodResponse.json();

    console.log("Initial RunPod response:", runpodJson);

    // Check if job is queued and needs polling
    if (runpodJson.status === 'IN_QUEUE' || runpodJson.status === 'IN_PROGRESS') {
      console.log(`Job ${runpodJson.id} is queued, starting polling...`);
      runpodJson = await pollRunPodStatus(runpodJson.id, endpointUrl);
      console.log("Final job result:", runpodJson);
    }

    // Return the complete RunPod response
    return NextResponse.json(
      {
        success: true,
        ...runpodJson,
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
