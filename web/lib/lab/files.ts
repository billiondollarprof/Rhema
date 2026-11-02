/*
 * lib/lab/files.ts: the lab's door to the shared file code.
 *
 * Why: the file code started here for lab results (request 115). On
 * 2026-11-02 the patient's record needed the same thing (request 128), so
 * it moved to lib/files/files.ts. This keeps the lab screens unchanged.
 *
 * Never: add file code here. It belongs in lib/files/files.ts.
 */
export { MOST_BYTES, openFile, prepareFile, sizeWords, uploadFile } from '@/lib/files/files'
export type { ReadyFile } from '@/lib/files/files'
