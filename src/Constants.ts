enum Events {
    READY = "ready",
    TRACK_ADD = "trackAdd",
    TRACK_START = "trackStart",
    TRACK_ERROR = "trackError",
    TRACK_FINISH = "trackFinish",
    QUEUE_END = "queueEnd",
    QUEUE_STATE_UPDATE = "queueStateUpdate",
    VOICE_CONNECTION_READY = "connectionReady",
    VOICE_CONNECTION_ERROR = "connectionError",
    VOICE_CONNECTION_DISCONNECT = "connectionDisconnect",
    AUDIO_PLAYER_ERROR = "audioPlayerError",
    AUDIO_PLAYER_STATUS = "audioPlayerStatus",
    NO_RESULTS = "noResults",
}

export { Events };