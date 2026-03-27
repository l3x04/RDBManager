import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  loadLocalDb:    ()        => ipcRenderer.invoke('db:loadLocal'),
  reloadDatabase: ()        => ipcRenderer.invoke('db:reload'),
  getTracks:      ()        => ipcRenderer.invoke('db:getTracks'),
  getSession:     ()        => ipcRenderer.invoke('session:get'),
  saveSession:    (state)   => ipcRenderer.invoke('session:save', state),
  generate:       (payload) => ipcRenderer.invoke('generate', payload),
  saveToRekordbox: (payload) => ipcRenderer.invoke('db:saveToRb', payload),
  readAudioFile:  (filePath) => ipcRenderer.invoke('file:readAudio', filePath),
  onDbLoaded: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('db:loaded', handler)
    return () => ipcRenderer.removeListener('db:loaded', handler)
  },
  onDbError: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('db:error', handler)
    return () => ipcRenderer.removeListener('db:error', handler)
  },
})
