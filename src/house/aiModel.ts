import { backendEnabled, supabase } from '../lib/backend'

/**
 * AI 3D model from a photo (fal.ai through the Supabase Edge Function `image-to-3d`).
 * Returns the GLB URL. Polls every 5 s for up to 6 minutes.
 */
export const aiModelAvailable = backendEnabled

export async function createAiModel(photo: string, designRef: string, onProgress: (status: string) => void, signal?: AbortSignal): Promise<string> {
  if (!supabase) throw new Error('The AI 3D service is not connected on this website yet.')
  const call = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase!.functions.invoke('image-to-3d', { body })
    if (error) {
      // the function returns a JSON error message
      const ctx = (error as { context?: Response }).context
      const msg = ctx ? await ctx.json().then((j: { error?: string }) => j.error).catch(() => null) : null
      throw new Error(msg || error.message)
    }
    if (data?.error) throw new Error(data.error)
    return data
  }
  onProgress('Uploading your photo…')
  const { id } = await call({ action: 'submit', image: photo, designRef })
  const start = Date.now()
  while (Date.now() - start < 6 * 60 * 1000) {
    if (signal?.aborted) throw new Error('Cancelled')
    await new Promise((r) => setTimeout(r, 5000))
    const s = await call({ action: 'status', id })
    if (s.status === 'done' && s.url) return s.url as string
    if (s.status === 'failed') throw new Error(s.error || 'The AI could not build a model from this photo.')
    const secs = Math.round((Date.now() - start) / 1000)
    onProgress(s.status === 'working' ? `Building the 3D model… ${secs}s` : `Waiting in the queue${s.position ? ` (position ${s.position})` : ''}… ${secs}s`)
  }
  throw new Error('This is taking longer than usual. Please try again in a few minutes.')
}
