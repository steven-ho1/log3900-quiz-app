/* eslint-disable no-console */
import * as fs from 'fs';
import { MongoClient, ServerApiVersion } from 'mongodb';
import { Service } from 'typedi';

@Service()
export class DatabaseService {
    private client: MongoClient;

    constructor() {
        const uri = 'mongodb+srv://LOG2990_106:log2990database@cluster0.wr3pjmy.mongodb.net/?retryWrites=true&w=majority';
        this.client = new MongoClient(uri, {
            serverApi: {
                version: ServerApiVersion.v1,
                strict: true,
                deprecationErrors: true,
            },
        });
    }

    async connect(): Promise<void> {
        try {
            await this.client.connect();
            console.log('Connected to MongoDB');
        } catch (error) {
            console.error('Error connecting to MongoDB:', error);
        }
    }
    async disconnect(): Promise<void> {
        try {
            await this.client.close();
            console.log('Disconnected from MongoDB.');
        } catch (error) {
            console.error('Error disconnecting from MongoDB:', error);
        }
    }

    getDb() {
        return this.client.db('Log2990_database');
    }

    async importGames(filePath: string): Promise<void> {
        try {
            await this.client.connect();
            const db = this.client.db('Log2990_database');
            const gamesCollection = db.collection('Games');

            const gamesData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            await gamesCollection.insertMany(gamesData);

            console.log('Games data imported successfully');
        } catch (error) {
            console.error('Error importing games data:', error);
        } finally {
            await this.client.close();
        }
    }
}
export default DatabaseService;
