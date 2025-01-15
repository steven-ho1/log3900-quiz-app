/* eslint-disable no-console */
import { DatabaseService } from '@app/services/database/database.service';
import { Channel } from '@common/channel';
import { Message } from '@common/message';
import { ObjectId } from 'mongodb'; // Import ObjectId
import { Service } from 'typedi';

@Service()
export class ChatManager {
    private channels: Map<string, Channel> = new Map();
    private globalChannelId: string = 'Global';

    constructor(private readonly databaseService: DatabaseService) {}

    async initializeGlobalChannel() {
        const collection = this.databaseService.getCollection('Channels');

        console.log('Initializing global channel...');
        const existingChannel = await collection.findOne({ channelId: this.globalChannelId });
        if (!existingChannel) {
            const globalChannel: Channel = { channelId: this.globalChannelId, channelName: 'Global', members: [], membersList: [] };
            await collection.insertOne(globalChannel);
            this.channels.set(this.globalChannelId, globalChannel);
        }
        console.log('Global channel initialized');
    }

    async createChannel(channelName: string): Promise<Channel> {
        const channelId = new ObjectId().toString();
        const newChannel: Channel = { channelId, channelName, members: [], membersList: [] };
        const collection = this.databaseService.getCollection('Channels');
        await collection.insertOne(newChannel);

        this.channels.set(channelId, newChannel);
        return newChannel;
    }

    async joinChannel(channelId: string, username: string): Promise<boolean> {
        try {
            let channel = this.channels.get(channelId);

            if (!channel) {
                channel = await this.getChannel(channelId);
                if (!channel) {
                    console.error(`Channel ${channelId} does not exist.`);
                    return false;
                }
                this.channels.set(channelId, channel);
            }

            if (!channel.members.includes(username)) {
                channel.members.push(username);

                // Mettre à jour la base de données
                const collection = this.databaseService.getCollection('Channels');
                const updateResult = await collection.updateOne({ channelId }, { $addToSet: { members: username } });

                if (updateResult.modifiedCount > 0) {
                    this.channels.set(channelId, channel); // Mettre à jour la carte locale
                    console.log(`Successfully added ${username} to channel ${channelId}`);
                    return true;
                } else {
                    console.error(`Failed to add ${username} to channel ${channelId}`);
                    return false;
                }
            } else {
                console.log(`User ${username} is already a member of channel ${channelId}`);
                return true; // L'utilisateur est déjà membre
            }
        } catch (error) {
            console.error('Error in joinChannel:', error);
            return false;
        }
    }

    async leaveChannel(channelId: string, userId: string, username: string): Promise<void> {
        const channel = this.channels.get(channelId);
        if (channel) {
            // Supprimer l'utilisateur de la liste des membres
            channel.members = channel.members.filter((member) => member !== username);

            // Mettre à jour la base de données
            const collection = this.databaseService.getCollection('Channels');
            await collection.updateOne({ channelId }, { $pull: { members: username } });

            this.channels.set(channelId, channel); // Mettre à jour la carte locale
            console.log(`Successfully removed ${username} from channel ${channelId}`);
        }
    }

    async getChannel(channelId: string): Promise<Channel | null> {
        const collection = this.databaseService.getCollection('Channels');
        const channelDoc = await collection.findOne({ channelId });

        if (channelDoc) {
            const channel: Channel = {
                channelId: channelDoc.channelId,
                channelName: channelDoc.channelName,
                members: channelDoc.members,
                membersList: channelDoc.membersList,
            };
            return channel;
        }

        return null; // Si aucun canal n'est trouvé
    }

    // Method to save a message to the database
    async saveMessageToBd(message: Message): Promise<void> {
        try {
            const collection = this.databaseService.getCollection('Chat');
            await collection.insertOne(message);
        } catch (error) {
            throw new Error('Error saving message to database: ' + error.message);
        }
    }

    async deleteChannel(channelId: string): Promise<void> {
        const channelsCollection = this.databaseService.getCollection('Channels');
        const chatCollection = this.databaseService.getCollection('Chat');

        await channelsCollection.deleteOne({ channelId });
        await chatCollection.deleteMany({ channelId });
    }
    async getMessagesById(channelId: string): Promise<Message[]> {
        try {
            const collection = this.databaseService.getCollection('Chat');
            const messages = await collection.find({ channelId }).toArray();
            return messages as unknown as Message[];
        } catch (error) {
            throw new Error('Error retrieving messages by channelId from database: ' + error.message);
        }
    }
    async getAllChannels(): Promise<Channel[]> {
        const collection = this.databaseService.getCollection('Channels');
        const channels = await collection.find({}).toArray();
        return channels as unknown as Channel[];
    }

    async addToMembersList(channelId: string, username: string): Promise<boolean> {
        try {
            let channel = this.channels.get(channelId);

            if (!channel) {
                channel = await this.getChannel(channelId);
                if (!channel) {
                    console.error(`Channel ${channelId} does not exist.`);
                    return false;
                }
                this.channels.set(channelId, channel);
            }

            if (!channel.membersList.includes(username)) {
                channel.membersList.push(username);

                // Mise à jour de la base de données
                const collection = this.databaseService.getCollection('Channels');
                const updateResult = await collection.updateOne({ channelId }, { $addToSet: { membersList: username } });

                if (updateResult.modifiedCount > 0) {
                    this.channels.set(channelId, channel);
                    console.log(`Successfully added ${username} to membersList of channel ${channelId}`);
                    return true;
                } else {
                    console.error(`Failed to add ${username} to membersList of channel ${channelId}`);
                    return false;
                }
            } else {
                console.log(`User ${username} is already in the membersList of channel ${channelId}`);
                return true;
            }
        } catch (error) {
            console.error('Error in addToMembersList:', error);
            return false;
        }
    }
    async removeFromMembersList(channelId: string, username: string): Promise<void> {
        const channel = this.channels.get(channelId);
        if (channel) {
            channel.membersList = channel.membersList.filter((member) => member !== username);

            // Mise à jour de la base de données
            const collection = this.databaseService.getCollection('Channels');
            await collection.updateOne({ channelId }, { $pull: { membersList: username } });

            this.channels.set(channelId, channel);
            console.log(`Successfully removed ${username} from membersList of channel ${channelId}`);
        }
    }
}
