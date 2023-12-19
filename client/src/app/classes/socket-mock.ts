type CallbackSignature = (...params: (string | number | object | boolean)[]) => void;
type Event = string;
type Param = string | number | object | boolean;

export class SocketMock {
    serverEvents = new Map<Event, CallbackSignature[]>();
    clientUniqueEvents = new Map<Event, Param>();

    get nEmittedEvents() {
        return this.clientUniqueEvents.size;
    }

    on(event: string, callback: CallbackSignature): void {
        if (!this.serverEvents.has(event)) this.serverEvents.set(event, []);
        this.serverEvents.get(event)?.push(callback);
    }

    emit(event: string, ...params: Param[]): void {
        if (!this.clientUniqueEvents.has(event)) this.clientUniqueEvents.set(event, params);
    }

    simulateServerEmit(event: string, ...params: Param[]): void {
        const eventCallbacks = this.serverEvents.get(event);
        if (eventCallbacks) {
            for (const callback of eventCallbacks) {
                callback(...params);
            }
        }
    }

    removeAllListeners(event: string): void {
        this.serverEvents.delete(event);
    }
}
