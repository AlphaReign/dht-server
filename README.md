# AlphaReign DHT Server

This is the DHT server used for crawling and interacting with the BitTorrent DHT Network

This conforms to the [BEP 5](http://www.bittorrent.org/beps/bep_0005.html) the exception of:

-   Does not keep track of torrent peer information

This is to keep the DHT server from running out of memory since it's primary purpose is to crawl the DHT network as part of https://github.com/AlphaReign/scraper

If you wish to ensure it's a well formed DHT server, then listen to the correct events and ensure you send back the correct responses.

## Install

`yarn add dht-server`

## Getting Started

```js
const DHT = require('./dht');

const options = {};
const dht = new DHT(options);

dht.on('listening', (options) => {
	console.log(`DHT listening on ${options.address}:${options.port}`);
});
dht.on('announcePeerQuery', (message) => {
	console.log(`onAnnouncePeerQuery - new torrent: ${message.a.info_hash.toString('hex')}`);
});
dht.on('getPeersQuery', (message) => {
	console.log(`onGetPeersQuery - new torrent: ${message.a.info_hash.toString('hex')}`);
});

// Start the DHT Server
dht.start();

// Make some neighbours to ensure we get fulling on the network
dht.makeNeighbours();
```

## Options

```js
const options = {
	address: '0.0.0.0',
	bootstrapNodes: [
		{ address: 'router.bittorrent.com', port: 6881 },
		{ address: 'dht.transmissionbt.com', port: 6881 },
	],
	debug: false,
	maxNodes: 2000, // Going much higher than this has severe limits and may break stuff
	port: 6881,
};
```

## Terms

`node` is an object with at minimum and address and port

Example:

```js
{
	address: '192.168.0.1',
	port: 6881,
}
```

`infoHash` is a hex string that conforms to the BitTorrent Standard

Example: `a4104a9d2f5615601c429fe8bab8177c47c05c84`

## API

### `ping(node)`

Ping this node on the network.

### `findNode(nodeId, node)`

Find the node with nodeId by querying `node`. `node` is optional. If not is provided, it will query the a node from the internal nodes list

### `getPeers(infoHash, node)`

Find peers with the provided infoHash. `node` is optional. If not is provided, it will query the a node from the internal nodes list

### `announcePeer(infoHash, node)`

Announce that the client connected to this DHT Server is downloading a torrent with `infoHash`. `node` is optional. If not is provided, it will query the a node from the internal nodes list

### `makeNeighbours()`

This will query the internal node list for other peers

### `sendMessage(message, node)`

This will send the `message` to `node`. All messages should conform to BEP 5 standards

## Events

### `dht.on('listening', callback)`

`callback` is a function that receives the dht options object. This is primarly used for logging when the server starts listening

### `dht.on('error', callback)`

`callback` is a function that receives the error from the socket.

### `dht.on('messageRaw', callback)`

`callback` is a function that receives the raw (becoded) `message` along with the `node` address and port

### `dht.on('message', callback)`

`callback` is a function that receives the `message` (un-becoded) along with the `node` address and port

### `dht.on('response', callback)`

`callback` is a function that receives any response `message`s along with the `node` address and port

### `dht.on('query', callback)`

`callback` is a function that receives any query `message`s along with the `node` address and port

### `dht.on('getPeersResponse', callback)`

`callback` is a function that receives ths get_peers response `message`s along with the `node` address and port

### `dht.on('findNodeResponse', callback)`

`callback` is a function that receives ths find_node response `message`s along with the `node` address and port

### `dht.on('pingOrAnnounceResponse', callback)`

`callback` is a function that receives ths ping or announce response `message`s along with the `node` address and port

_Both ping and announce response messages are identical and thus we can't discern which it is_

### `dht.on('findNodeQuery', callback)`

`callback` is a function that receives ths find_node query `message`s along with the `node` address and port

### `dht.on('getPeersQuery', callback)`

`callback` is a function that receives ths get_peers query `message`s along with the `node` address and port

### `dht.on('announcePeerQuery', callback)`

`callback` is a function that receives ths announce_peer query `message`s along with the `node` address and port

### `dht.on('pingQuery', callback)`

`callback` is a function that receives ths ping query `message`s along with the `node` address and port
