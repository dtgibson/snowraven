import type { MediaType } from '../types'

export function extractUserId(filename: string): string | null {
  const m = filename.match(/^ML__.*_([A-Za-z0-9]+)\.csv$/)
  return m ? m[1] : null
}

export function mlCatalogLink(mediaType: MediaType, taxonCode: string | undefined, userId: string | null): string {
  const mt = mediaType === 'Photo' ? 'photo' : mediaType === 'Audio' ? 'audio' : 'video'
  let url = `https://search.macaulaylibrary.org/catalog?mediaType=${mt}`
  if (taxonCode) url += `&taxonCode=${taxonCode}`
  if (userId) url += `&userId=${userId}`
  return url
}
