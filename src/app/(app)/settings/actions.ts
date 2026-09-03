'use server'

import { revalidatePath } from 'next/cache'

import { BackupError, importBackup } from '@/lib/services/backup-service'

export type RestoreState = { error?: string; message?: string }

/**
 * Restores a backup zip over the current data folder.
 *
 * Destructive, so the form asks for confirmation before calling this. The
 * previous database is snapshotted beside the restored one first.
 */
export async function restoreBackup(
  _prev: RestoreState,
  formData: FormData,
): Promise<RestoreState> {
  const file = formData.get('backup')

  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose a backup file first.' }
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const { assetCount } = await importBackup(bytes)
    revalidatePath('/', 'layout')

    return {
      message:
        `Restored the database and ${assetCount} asset${assetCount === 1 ? '' : 's'}. ` +
        `Restart the app to load it.`,
    }
  } catch (error) {
    if (error instanceof BackupError) return { error: error.message }
    console.error('[backup] restore failed', error)
    return { error: 'That backup could not be restored.' }
  }
}
