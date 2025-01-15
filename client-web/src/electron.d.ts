/* eslint-disable no-unused-vars */
declare global {
    interface Window {
        electron: {
            ipcRenderer: {
                send: (channel: string, ...args: unknown[]) => void;
                on: (channel: string, func: (...args: unknown[]) => void) => void;
            };
        };
    }
}

export {};
