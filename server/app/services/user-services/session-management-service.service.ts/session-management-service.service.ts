/* eslint-disable no-console */
import redisClient from '@app/config/redis-client';
import { DatabaseService } from '@app/services/database/database.service';
import { getMontrealDateTime } from '@app/utils/date';
import { AuthEvent, AuthLog } from '@common/auth';
import { Service } from 'typedi';

@Service()
export class SessionManagementService {
    constructor(private database: DatabaseService) {}

    async setUserSession(userId: string) {
        await redisClient.set(`session_${userId}`, userId);
        const authLog: AuthLog = { userId, timestamp: getMontrealDateTime(), authEvent: AuthEvent.Login };
        await this.insertAuthLog(authLog);
        console.log(`Session set for ${userId}`);
    }

    async freeSession(userId: string) {
        const result = await redisClient.del(`session_${userId}`);
        if (result === 1) {
            const authLog: AuthLog = { userId, timestamp: getMontrealDateTime(), authEvent: AuthEvent.Logout };
            await this.insertAuthLog(authLog);
            console.log(`Session for ${userId} deleted.`);
            console.log('Logout succeeded.');
        } else if (result === 0) {
            console.log(`Session for ${userId} does not exist or has already been deleted.`);
        }
    }

    async getAuthLogsById(userId: string): Promise<AuthLog[]> {
        const authLogs: AuthLog[] = (await this.getAuthLogCollection().find({ userId }).toArray()).reverse() as unknown as AuthLog[];
        return authLogs;
    }

    private async insertAuthLog(authLog: AuthLog) {
        await this.getAuthLogCollection().insertOne(authLog);
    }

    private getAuthLogCollection() {
        return this.database.getCollection('AuthLogs');
    }
}
