import Nexus from '../Nexus';
import { Message, Guild, TextChannel, VoiceChannel, Interaction } from 'discord.js';

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
    d?: {
        [key: string]: any
    }
}

export enum WSOpCodes {
    HELLO = 0,
    VOICE_STATE_UPDATE = 1,
    IDENTIFY = 10,
    PING = 11,
    PONG = 12
}

export enum WSEvents {
    READY = "READY",
    TRACK_START = "TRACK_START",
    TRACK_FINISH = "TRACK_FINISH",
    TRACK_ERROR = "TRACK_ERROR",
    PLAYER_STATE_UPDATE = "PLAYER_STATE_UPDATE",
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
    created_at?: string
    extractor?: string
    initial?: boolean
    requested_by?: string

    playlist?: boolean
    tracks?: TrackData[] //Playlist only

    //Uh
    config?: {
        encoder_args?: string[];
        volume?: number;
    }
}

export interface SearchResult {
    results: Array<TrackData>
}

export interface PlayerConstructOptions {
    manager?: Nexus
    source?: Message
    connect?: boolean
}

export interface PlayerInfo {
    current?: TrackData
    stream_time: number
    volume: number
    paused: boolean
    latency: Latency
    subscribers: {
        self_subscription_count: number,
        total_subscription_count: number,
        connected: number
    }
}

export interface Latency {
    ws: number
    udp: number
}

export interface PlayerState {
    guild_id: string;
    volume: number;
    paused: boolean;
    loop_mode: number;
}

export interface PlayerStateUpdate {
    old_state: PlayerState;
    new_state: PlayerState;
}

export interface PlayMetaData {
    source?: Message | Interaction
    now?: boolean
    volume?: number
}

export interface NexusStats {
    timestamp: number

    ffmpeg_process: {
        count: number
        stats: any[]
    },
    process: {
        memory: {
            rss: number
            heap_total: number
            heap_used: number
            external: number
            array_buffers: number
        },
        cpu: {
            count: number
            total_usage: number
            usage: {
                user: number
                system: number
            }
        }
    },
    clients: {
        count: number
        subscriptions: number
    },
    uptime: 300
}

export type FiltersName = keyof QueueFilters;

export type QueueFilters = {
    bassboost?: boolean;
    '8D'?: boolean;
    vaporwave?: boolean;
    nightcore?: boolean;
    phaser?: boolean;
    tremolo?: boolean;
    vibrato?: boolean;
    reverse?: boolean;
    treble?: boolean;
    normalizer?: boolean;
    surrounding?: boolean;
    pulsator?: boolean;
    subboost?: boolean;
    karaoke?: boolean;
    flanger?: boolean;
    gate?: boolean;
    haas?: boolean;
    mcompand?: boolean;
    mono?: boolean;
    mstlr?: boolean;
    mstrr?: boolean;
    compressor?: boolean;
    expander?: boolean;
    softlimiter?: boolean;
    chorus?: boolean;
    chorus2d?: boolean;
    chorus3d?: boolean;
    fadein?: boolean;
};

