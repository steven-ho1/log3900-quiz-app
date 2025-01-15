import * as fs from 'fs';
import { Service } from 'typedi';

@Service()
export class FileManagerService {
    async readJsonFile(path: string): Promise<Buffer> {
        return await fs.promises.readFile(path);
    }

    async writeJsonFile(path: string, data: string): Promise<void> {
        return await fs.promises.writeFile(path, data);
    }

    async deleteFile(path: string): Promise<void> {
        return await fs.promises.unlink(path);
    }
}
