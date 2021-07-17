# Reflect-Nexus-Wrapper
### A wrapper for [Reflect Nexus](https://github.com/DevSnowflake/Nexus)

## Installation
```bash
npm i reflect-nexus-wrapper
```

## Usage
```js
const client = new Discord.Client();
const { Nexus } = require('reflect-nexus-wrapper');

const myNexusInstance = new Nexus(client, {
    port: 3000; // Your Nexus server port here
    token: "SwagLordNitroUser12345"; // Your Nexus server password here
    host: 'localhost'; // Your Nexus server hostname here
    https: false; // Whether your server is secure and using https and wss protocols
});
```
### Playing music
```js
let player = myNexusInstance.players.get(message.guild.id); //Guild id
if(!player) player = myNexusInstance.createPlayer(message); // Discord.Message or Discord.Interaction

player.play("Dua Lipa - Love Again"); // Song title
```

### Other methods
```ts
// Player Methods

player.play(query: string, data?: PlayMetaData)
// Play music. now - whether you want to push the track to the first position in queue

player.connect(source?: Discord.Message | Discord.Interaction, channel?: Discord.VoiceChannel)
// Connects the player to a VoiceChannel

player.pause(); // Pauses the player
player.resume(); // Resumes the player
player.setVolume(volume: number) // Changes player volume, accepts any value between 0 and 125
player.setLoopMode(mode: LoopMode); // Changes the LoopMode, 0 = OFF, 1 = TRACK, 2 = QUEUE
player.skip() // Skips the song
player.stop() // Stops the playe - stops music, clears the queue and disconnects from the voice channel

// Nexus Methods

nexus.search(query, identifier); 
// Searchs for the query, identifier can be 'ytsearch', 'ytplaylist', 'scsearch'. (sc = soundcloud, yt = youtube)
```

## Events
##### Events are emitted on both Nexus and the guild Player
```js
//Nexus client event format
nexus.on('event', (player, data) => { 
// player is the Guild Player in which the event occours
})
//Guild Player event format
player.on('event', (data) => {
//...
})
```
#### All events
```
('ready') - Emitted when the player or nexus client is ready.
('trackAdd', Track) - When a track is added to queue.
('tracksAdd', Track[]) - When multiple tracks are added to queue.
('trackStart', Track) - When a track starts playing.
('trackError', Track) - When an error occours when playing a track.
('trackFinish', Track) - When a track ends playing.
('queueEnd') - When the queue ends. i.e- when all songs are over.
('queueStateUpdate', QueueStateUpdate) - When changes are made to the player. i.e - When volume, loopMode, etc is changed.
('connectionError', data) - When there is an error connecting to the VoiceChannel.
('connectionReady', data) - When the connection with the VoiceChannel is ready.
('connectionDisconnect', data) - When the connection with the VoiceChannel disconnects.
('audioPlayerError', data) - When there is an error in the Audio Player.
('noResults', string) - When no results are found for the query string. (when it is search for in Nexus#serch)
```
