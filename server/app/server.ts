/* eslint-disable no-console */
/* eslint-disable max-params */
import { Application } from '@app/app';
import * as http from 'http';
import { AddressInfo } from 'net';
import { Service } from 'typedi';
import { setCrashHandlers } from './config/process';
import redisClient from './config/redis-client';
import { ChatManager } from './services/chat-manager/chat-manager';
import { DatabaseService } from './services/database/database.service';
import { SocketManager } from './services/socket-manager/socket-manager.service';

@Service()
export class Server {
    private static readonly appPort: string | number | boolean = Server.normalizePort(process.env.PORT || '3000');
    private static readonly baseDix: number = 10;
    private server: http.Server;

    constructor(
        private readonly application: Application,
        private readonly databaseService: DatabaseService,
        private readonly socketManager: SocketManager,
        private readonly chatManager: ChatManager,
    ) {}
    private static normalizePort(val: number | string): number | string | boolean {
        const port: number = typeof val === 'string' ? parseInt(val, this.baseDix) : val;
        return isNaN(port) ? val : port >= 0 ? port : false;
    }
    async init(): Promise<void> {
        try {
            console.log('\x1b[38;5;208m%s\x1b[0m', '-----Initializing server-----');
            setCrashHandlers();

            await this.databaseService.connect();
            // Used to import the games for the first time
            await redisClient.connect();
            await redisClient.flushAll();

            if (process.env.IMPORT_GAMES === 'true') {
                const gamesPath = 'C:\\Users\\istra\\Documents\\LOG2990\\LOG2990-106\\server\\data\\games.json';
                await this.databaseService.importGames(gamesPath);
            }

            this.application.app.set('port', Server.appPort);

            this.server = http.createServer(this.application.app);
            this.socketManager.setHttpServer(this.server);
            await this.chatManager.initializeGlobalChannel();
            this.socketManager.initializeSocketServer();
            this.socketManager.handleSockets();

            this.server.listen(Server.appPort);
            this.server.on('error', (error: NodeJS.ErrnoException) => this.onError(error));
            this.server.on('listening', () => this.onListening());
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Error initializing server:', error);
        }
    }

    private onError(error: NodeJS.ErrnoException): void {
        if (error.syscall !== 'listen') {
            throw error;
        }
        const bind: string = typeof Server.appPort === 'string' ? 'Pipe ' + Server.appPort : 'Port ' + Server.appPort;
        switch (error.code) {
            case 'EACCES':
                // eslint-disable-next-line no-console
                console.error(`${bind} requires elevated privileges`);
                process.exit(1);
                break;
            case 'EADDRINUSE':
                // eslint-disable-next-line no-console
                console.error(`${bind} is already in use`);
                process.exit(1);
                break;
            default:
                throw error;
        }
    }

    /**
     * Se produit lorsque le serveur se met à écouter sur le port.
     */
    private onListening(): void {
        const addr = this.server.address() as AddressInfo;
        const bind: string = typeof addr === 'string' ? `pipe ${addr}` : `port ${addr.port}`;
        // eslint-disable-next-line no-console
        console.log('\x1b[32m%s\x1b[0m', `-----Server listening on ${bind}-----`);
    }
}
