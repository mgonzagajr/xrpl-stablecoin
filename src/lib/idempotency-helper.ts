export async function generateIdempotencyKey(prefix: string): Promise<string> {
  try {
    const response = await fetch('/api/idempotency/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prefix }),
    });

    const result = await response.json();

    if (result.ok) {
      return result.data.key;
    } else {
      console.error('Error generating idempotency key:', result.error);
      // Fallback to timestamp-based key
      return `${prefix}-${Date.now()}`;
    }
  } catch (error) {
    console.error('Error generating idempotency key:', error);
    // Fallback to timestamp-based key
    return `${prefix}-${Date.now()}`;
  }
}
