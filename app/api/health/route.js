export const dynamic = "force-static";

export async function GET() {
    return new Response(
      JSON.stringify({ status: "ok", timestamp: Date.now() }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
  