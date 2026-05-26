import { ipcRenderer } from 'electron'

declare global {
  interface Window {
    electronAPI: typeof electronAPI
  }
}

export const electronAPI = {
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),

  onCheckBeforeClose: (callback: () => boolean | Promise<boolean>) => {
    ipcRenderer.on('check-before-close', async () => {
      const result = await callback()
      ipcRenderer.send('check-before-close-result', result)
    })
  },

  onMcpRequest: (
    callback: (payload: { id: string; tool: string; args: unknown }) => Promise<unknown>,
  ) => {
    ipcRenderer.on('mcp-request', async (_event, payload) => {
      try {
        const result = await callback(payload)
        ipcRenderer.send('mcp-response', { id: payload.id, result })
      } catch (err) {
        ipcRenderer.send('mcp-response', {
          id: payload.id,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    })
  },

  onMcpStatus: (
    callback: (status: { url: string; port: number; host: string; listening: boolean; error?: string }) => void,
  ) => {
    ipcRenderer.on('mcp-status', (_event, status) => callback(status))
  },
}
