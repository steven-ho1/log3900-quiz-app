export interface Message {
    senderId: string;
    sender: string;
    content?: string;
    imageUrl?: string;
    audioUrl?: string;
    time?: string;
    channelId: string;
    avatar: string;
}
