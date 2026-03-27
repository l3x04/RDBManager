import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  loadDatabase:  (filePath) => ipcRenderer.invoke('db:load', filePath),
  reloadDatabase:(filePath) => ipcRenderer.invoke('db:reload', filePath),
  getTracks:     ()         => ipcRenderer.invoke('db:getTracks'),
  getSession:    ()         => ipcRenderer.invoke('session:get'),
  saveSession:   (state)    => ipcRenderer.invoke('session:save', state),
  generate:      (payload)  => ipcRenderer.invoke('generate', payload),
  readAudioFile: (filePath) => ipcRenderer.invoke('file:readAudio', filePath),
  onDbLoaded: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('db:loaded', handler)
    return () => ipcRenderer.removeListener('db:loaded', handler)
  },
})
