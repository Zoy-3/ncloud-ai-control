export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    success: true,
    service: "NCloud AI Control",
    status: "online",
    timestamp: new Date().toISOString(),
  });
}
