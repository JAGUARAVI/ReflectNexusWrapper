import Nexus from '../Nexus';
import { Message, Interaction, Guild, TextChannel, VoiceChannel } from 'discord.js';

export interface NexusConstructOptions {
    port: number
    token: string
    host?: string
    https?: boolean
    reconnect?: boolean
    debug?: boolean
}

export interface NexusPacket {
    t?: WSEvents
    op?: WSOpCodes
    d?: any
}

export enum WSOpCodes {
    HELLO = 0,
    VOICE_STATE_UPDATE = 1,
    IDENTIFY = 10
}

export enum WSEvents {
    READY = "READY",
    TRACK_ADD = "TRACK_ADD",
    TRACKS_ADD = "TRACKS_ADD",
    TRACK_START = "TRACK_START",
    TRACK_FINISH = "TRACK_FINISH",
    TRACK_ERROR = "TRACK_ERROR",
    QUEUE_END = "QUEUE_END",
    QUEUE_STATE_UPDATE = "QUEUE_STATE_UPDATE",
    VOICE_CONNECTION_READY = "VOICE_CONNECTION_READY",
    VOICE_CONNECTION_ERROR = "VOICE_CONNECTION_ERROR",
    VOICE_CONNECTION_DISCONNECT = "VOICE_CONNECTION_DISCONNECT",
    AUDIO_PLAYER_ERROR = "AUDIO_PLAYER_ERROR",
    AUDIO_PLAYER_STATUS = "AUDIO_PLAYER_STATUS"
}

export enum LoopMode {
    OFF = 0,
    TRACK = 1,
    QUEUE = 2
}

export enum WSCloseCodes {
    UNKNOWN = 4000,
    NO_CLIENT_ID = 4001,
    NO_AUTH = 4002,
    NO_GUILD = 4003,
    DECODE_ERROR = 4004,
    UNKNOWN_OPCODE = 4005,
    SESSION_EXPIRED = 4006,
    SERVER_CLOSED = 4010,
    NOT_ALLOWED = 4011,
    ALREADY_CONNECTED = 4012,
    NOT_IDENTIFIED = 4013
}

export interface TrackData {
    url: string
    title?: string
    thumbnail?: string
    duration?: number
    author?: string
    created_at?: Date
    extractor?: string
    initial?: boolean
    requested_by?: string
}

export interface SearchResult {
    results: Array<TrackData>
}

export interface PlayerConstructOptions {
    manager?: Nexus
    source?: Message | Interaction
    connect?: boolean
}

export interface PlayerInfo {
    current?: TrackData
    stream_time: number
    loop_mode: LoopMode
    volume: number
    paused: boolean
    latency: Latency
    tracks: Array<TrackData>
}

export interface Latency {
    ws: number
    udp: number
}

export interface QueueState {
    guild_id: string;
    volume: number;
    paused: boolean;
    loop_mode: number;
}

export interface QueueStateUpdate {
    old_state: QueueState;
    new_state: QueueState;
}

export interface PlayMetaData {
    source: Message | Interaction,
    now: boolean
}