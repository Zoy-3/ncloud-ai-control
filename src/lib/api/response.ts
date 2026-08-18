export function successResponse<T extends Record<string, unknown>>(
  body: T,
  status = 200,
): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
