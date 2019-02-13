const DHT = require('./src/index');
const dht = new DHT({ debug: true });
const onAddTorrent = (message, rinfo, event) => {
	const infoHash = message.a.info_hash.toString('hex');

	console.log(`Added torrent ${infoHash} from ${event} event`);
};

dht.on('listening', (options) => console.log(`DHT listening on ${options.address}:${options.port}`));
dht.on('announcePeerQuery', (message, rinfo) => onAddTorrent(message, rinfo, 'announcePeerQuery'));
dht.on('getPeersQuery', (message, rinfo) => onAddTorrent(message, rinfo, 'getPeersQuery'));

dht.start();

setInterval(() => dht.makeNeighbours(), 5000);
setInterval(() => console.log('total nodes', dht.nodes.length), 15000);
