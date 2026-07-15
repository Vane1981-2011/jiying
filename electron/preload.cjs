const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('__sibian', {
  platform: process.platform,

  /** 执行 Shell 命令 —— 经过权限策略引擎检查 */
  executeCommand: (cmd, options) =>
    ipcRenderer.invoke('shell:execute', { cmd, options }),

  /** 读取文件 */
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', { filePath }),

  /** 写入文件 */
  writeFile: (filePath, content) =>
    ipcRenderer.invoke('fs:writeFile', { filePath, content }),

  /** 打开外部链接 */
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', { url }),

  /** 获取应用版本 */
  getVersion: () => ipcRenderer.invoke('app:getVersion'),

  /** 监听守护进程事件 */
  on: (channel, callback) => {
    const validChannels = ['guardian:violation', 'app:update-available'];
    if (validChannels.includes(channel)) {
      const listener = (_event, ...args) => callback(...args);
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    }
    return () => {};
  },
});
