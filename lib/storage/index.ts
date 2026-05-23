//
// Extension point for blob attachments (designed-for, not built at MVP).
// When attachments land, fill these in with a Supabase Storage adapter
// and add an `attachments` table + an `attach_blob` MCP tool. Call sites
// should code against this interface, not against Supabase Storage directly.

export interface BlobStore {
  put(input: { key: string; mime: string; body: Uint8Array | Blob }): Promise<{ key: string }>;
  signedUrl(key: string, ttlSeconds: number): Promise<string>;
  delete(key: string): Promise<void>;
}

class NotImplementedStore implements BlobStore {
  async put(): Promise<{ key: string }> {
    throw new Error("BlobStore not implemented at MVP");
  }
  async signedUrl(): Promise<string> {
    throw new Error("BlobStore not implemented at MVP");
  }
  async delete(): Promise<void> {
    throw new Error("BlobStore not implemented at MVP");
  }
}

export const blobStore: BlobStore = new NotImplementedStore();
