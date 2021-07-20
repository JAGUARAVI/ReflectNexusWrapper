import EventEmitter from "events";
import Discord from 'discord.js';
import Collection from '@discordjs/collection';
import WebSocket from 'ws';
import Player from './Player';
import Track from './Track';
import fetch from 'node-fetch';
import AudioFilters from './utils/AudioFilters';
import { inspect } from 'util';

import * as Constants from './Constants';
import { NexusStats, NexusConstructOptions, NexusPacket, WSCloseCodes, WSEvents, WSOpCodes, TrackData, SearchResult, PlayerConstructOptions, PlayerInfo, QueueState, QueueStateUpdate, LoopMode } from './types/types';

class Nexus extends EventEmitter {
    private client: Discord.Client;
    private ws: WebSocket;
    private token: string;

    public options: NexusConstructOptions;
    public ready: boolean;

    public filters: typeof AudioFilters;

    public players = new Collection<string, Player>();

    constructor(client: Discord.Client, options: NexusConstructOptions) {
        super();

        if (!client) throw new Error("Please provide the client!");
        if (!options) throw new Error("No options provided!");

        this.client = client;
        this.options = options;

        if (!this.options.token) throw new Error("Please provide the websocket token!")
        if (!this.options.host) this.options.host = 'localhost';
        if (!this.options.port) this.options.port = 0;
        if (!this.options.https) this.options.https = false;

        this.filters = AudioFilters;

        this.client.once('ready', () => {
            this._init();
        });
    }

    static get AudioFilters(): typeof AudioFilters {
        return AudioFilters;
    }
    
    get connectionString(): string {
        return `${this.options.https ? 'https' : 'http'}://${this.options.host}${this.options.port ? `:${this.options.port}` : ''}`;
    }

    connect(): Promise<void> {
        this.ws = new WebSocket(`${this.options.https ? 'wss' : 'ws'}://${this.options.host}${this.options.port ? `:${this.options.port}` : ''}`, {
            headers: {
                "Authorization": this.options.token,
                "client-id": this.client.user.id
            }
        });

        return new Promise((res, rej) => {
            this.ws.on('error', (e) => rej(e));
            this.ws.on('open', () => res())
        });
    }

    async _init(): Promise<void> {
        this.connect();

        this.ws.on('message', this._handleMessage.bind(this));
        this.ws.on('close', this._handleClose.bind(this))

        this.client.ws.on(Discord.Constants.WSEvents.VOICE_SERVER_UPDATE, (payload) => {
            this.ws.send(JSON.stringify({ t: Discord.Constants.WSEvents.VOICE_SERVER_UPDATE, d: payload }));
        });
        this.client.ws.on(Discord.Constants.WSEvents.VOICE_STATE_UPDATE, (payload) => {
            this.ws.send(JSON.stringify({ t: Discord.Constants.WSEvents.VOICE_STATE_UPDATE, d: payload }));
        });
    }

    createPlayer(source: Discord.Message | Discord.Interaction, options?: PlayerConstructOptions): Player | Error { //replace with player options
        if (!source?.guild?.id) return new Error("No source provided");

        if (this.players.get(source.guild.id)) return this.players.get(source.guild.id);
        const player = new Player(Object.assign({}, options, { manager: this, source }));
        this.players.set(source.guild.id, player);
        return player;
    }

    async search(query: string, identifier = 'ytsearch'): Promise<SearchResult> {
        return new Promise(async (res, rej) => {
            if (!query) return rej("No search string provided!");
            await this.GET(`/api/tracks/search?query=${encodeURIComponent(query)}&identifier=${encodeURIComponent(identifier)}`).then(res);
        })
    }

    async getStats(): Promise<NexusStats> {
        return await this.GET('/stats');
    }

    async _handleMessage(rawMessage: string) {
        const message: NexusPacket = JSON.parse(rawMessage);

        if (this.options.debug && message.t != WSEvents.AUDIO_PLAYER_STATUS) console.log(
            `[NEXUS::DEBUG] Recieved packet from Nexus websocket:\n${inspect(message)}`
        );

        if (message.op != undefined) {
            switch (message.op) {
                case WSOpCodes.HELLO: {
                    this.ws.send(JSON.stringify({ op: WSOpCodes.IDENTIFY }));
                    break;
                }
                case WSOpCodes.VOICE_STATE_UPDATE: {
                    this.client.guilds.cache.get(message.d.d.guild_id)?.shard.send(message.d);
                    break;
                }
                default: {
                    //add UNKNOWN_OP_CODE error here
                    break;
                }
            }
        }

        if (message.t != undefined) {
            switch (message.t) {
                case WSEvents.READY: {
                    this.token = message.d.access_token;
                    this.ready = true;
                    this.emit(Constants.Events.READY);
                    break;
                }
                case WSEvents.TRACK_START: {
                    const player = this.players.get(message.d.guild_id);
                    if (!player) break;

                    const track = new Track(message.d.track as TrackData);

                    const requestData = player.requestQueue[0];
                    if (requestData?.requested_by) track.requested_by = requestData.requested_by;

                    player.tracks.push(track);

                    this.emit(Constants.Events.TRACK_START, player, track);
                    player.emit(Constants.Events.TRACK_START, track);
                    break;
                }
                case WSEvents.TRACK_ERROR: {
                    const player = this.players.get(message.d.guild_id);
                    if (!player) break;

                    const track = player.tracks[0];

                    this.emit(Constants.Events.TRACK_ERROR, player, track);
                    player.emit(Constants.Events.TRACK_ERROR, track);
                    break;
                }
                case WSEvents.TRACK_FINISH: {
                    const player = this.players.get(message.d.guild_id);
                    if (!player) break;

                    const track = new Track(message.d.track as TrackData);

                    const requestData = player.requestQueue[0];
                    if (requestData.requested_by) track.requested_by = requestData.requested_by;

                    if (player.loopMode === LoopMode.OFF) {
                        player.tracks.shift();
                        player.requestQueue.shift();
                        if (player.tracks.length) player._playTrack(player.tracks[0]);
                    } else if (player.loopMode === LoopMode.TRACK) {
                        player._playTrack(player.tracks[0]);
                    } else if (player.loopMode === LoopMode.QUEUE) {
                        player.tracks.push(player.tracks[0]);
                        player.tracks.shift();
                        player.requestQueue.shift();
                        if (player.tracks.length) player._playTrack(player.tracks[0]);
                    }

                    this.emit(Constants.Events.TRACK_FINISH, player, track);
                    player.emit(Constants.Events.TRACK_FINISH, track);
                    break;
                }
                case WSEvents.QUEUE_STATE_UPDATE: {
                    const player = this.players.get(message.d.new_state.guild_id);
                    if (!player) break;

                    const state = message.d as QueueStateUpdate;

                    this.emit(Constants.Events.QUEUE_STATE_UPDATE, player, state);
                    player.emit(Constants.Events.QUEUE_STATE_UPDATE, state);
                    break;
                }
                case WSEvents.VOICE_CONNECTION_READY: {
                    const player = this.players.get(message.d.guild_id);
                    if (!player) break;

                    this.emit(Constants.Events.VOICE_CONNECTION_READY, player, message.d);
                    player.emit(Constants.Events.VOICE_CONNECTION_READY, message.d);
                    break;
                }
                case WSEvents.VOICE_CONNECTION_ERROR: {
                    const player = this.players.get(message.d.guild_id);
                    if (!player) break;

                    this.emit(Constants.Events.VOICE_CONNECTION_ERROR, player, message.d);
                    player.emit(Constants.Events.VOICE_CONNECTION_ERROR, message.d);
                    break;
                }
                case WSEvents.VOICE_CONNECTION_DISCONNECT: {
                    const player = this.players.get(message.d.guild_id);
                    if (!player) break;

                    player.connected = false;

                    this.emit(Constants.Events.VOICE_CONNECTION_DISCONNECT, player);
                    player.emit(Constants.Events.VOICE_CONNECTION_DISCONNECT);
                    break;
                }
                case WSEvents.AUDIO_PLAYER_STATUS: {
                    const player = this.players.get(message.d.guild_id);
                    if (!player) break;

                    const info = message.d as PlayerInfo;
                    player.setInfo(info);
                    break;
                }
                case WSEvents.AUDIO_PLAYER_ERROR: {
                    const player = this.players.get(message.d.guild_id);
                    if (!player) break;

                    this.emit(Constants.Events.AUDIO_PLAYER_ERROR, player, message.d);
                    player.emit(Constants.Events.AUDIO_PLAYER_ERROR, message.d);
                    break;
                }
                default: {
                    break;
                }
            }
        }
    }

    async _handleClose(message: WSCloseCodes | number) {
        this.ready = false;
        switch (message) {
            case 1006: {
                if (this.options.reconnect == false) break;
                this.connect();
                break;
            }
            case WSCloseCodes.ALREADY_CONNECTED: {
                this.emit('error', { code: message, text: "Already connected to server.", type: 'DISCONNECTED' })
                break;
            }
            case WSCloseCodes.DECODE_ERROR: {
                this.emit('error', { code: message, text: "Error decoding message.", type: 'DISCONNECTED' })
                break;
            }
            case WSCloseCodes.NOT_ALLOWED: {
                this.emit('error', { code: message, text: "Not allowed.", type: 'DISCONNECTED' })
                break;
            }
            case WSCloseCodes.NOT_IDENTIFIED: {
                this.emit('error', { code: message, text: "Not identified.", type: 'DISCONNECTED' })
                break;
            }
            case WSCloseCodes.NO_AUTH: {
                this.emit('error', { code: message, text: "No authentication.", type: 'DISCONNECTED' })
                break;
            }
            case WSCloseCodes.NO_CLIENT_ID: {
                this.emit('error', { code: message, text: "No client ID provided.", type: 'DISCONNECTED' })
                break;
            }
            case WSCloseCodes.NO_GUILD: {
                this.emit('error', { code: message, text: "No guild provided.", type: 'DISCONNECTED' })
                break;
            }
            case WSCloseCodes.SERVER_CLOSED: {
                this.emit('error', { code: message, text: "Server closed.", type: 'DISCONNECTED' })
                break;
            }
            case WSCloseCodes.SESSION_EXPIRED: {
                this.emit('error', { code: message, text: "Session expired.", type: 'DISCONNECTED' })
                break;
            }
            case WSCloseCodes.UNKNOWN_OPCODE: {
                this.emit('error', { code: message, text: "Unknown operation (OP) code.", type: 'DISCONNECTED' })
                break;
            }
            case WSCloseCodes.UNKNOWN:
            default: {
                this.emit('error', { code: message, text: "Unknown error code.", type: 'DISCONNECTED' })
                break;
            }
        }
    }

    async GET(url: string): Promise<any> {
        url = this.connectionString + url;
        return await fetch(url, { method: 'GET', headers: { 'Authorization': this.token, 'Content-Type': 'application/json' } }).then((d: any) => d.json());
    }

    async POST(url: string, body?: any, json = true): Promise<any> {
        url = this.connectionString + url;
        if (!body) body = {};
        return await fetch(url, { method: 'POST', headers: { 'Authorization': this.token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((d: any) => json ? d.json() : d);
    }

    async PATCH(url: string, body?: any): Promise<any> {
        url = this.connectionString + url;
        if (!body) body = {};
        return await fetch(url, { method: 'PATCH', headers: { 'Authorization': this.token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(() => true);
    }

    async DELETE(url: string): Promise<any> {
        url = this.connectionString + url;
        return await fetch(url, { method: 'DELETE', headers: { 'Authorization': this.token, 'Content-Type': 'application/json' } }).then(() => true);
    }
}

export default Nexus;
