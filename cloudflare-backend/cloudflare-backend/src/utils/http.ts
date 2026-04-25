export class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function parseJsonBody<T>(request: Request): Promise<T> {
  try {
    return await request.json<T>()
  } catch {
    throw new HttpError(400, 'Invalid JSON payload.')
  }
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status })
}
