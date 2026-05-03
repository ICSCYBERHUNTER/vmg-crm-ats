export async function fetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    if (res.status === 401) {
      return { success: false, code: 'unauthorized' } as T
    }
    throw new Error(`Request failed: ${res.status}`)
  }
  return res.json()
}
