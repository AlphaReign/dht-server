/* eslint-disable camelcase */
const EventEmitter = require('events');
const bencode = require('bencode');
const compactNodes = require('./utils/compact');
const decompactNodes = require('./utils/decompact');
const getRandomId = require('./utils/getRandomId');
const dgram = require('dgram');

const defaultOptions = {
	address: '0.0.0.0',
	bootstrapNodes: [
		{ address: 'router.bittorrent.com', port: 6881 },
		{ address: 'dht.transmissionbt.com', port: 6881 },
	],
	debug: false,
	maxNodes: 2000,
	port: 6881,
};

class DHT extends EventEmitter {
	constructor(options = {}) {
		super();
		this.options = { ...defaultOptions, ...options };
		this.socket = dgram.createSocket('udp4');
		this.clientId = getRandomId();
		this.nodes = this.options.bootstrapNodes;
		this.socket.on('message', (message, rinfo) => this.onMessage(message, rinfo));
		this.socket.on('listening', () => this.onListening());
		this.socket.on('error', (error) => this.onError(error));
	}

	start() {
		this.socket.bind(this.options.port, this.options.address);
	}

	decodeMessage(message) {
		try {
			const msg = bencode.decode(message);

			msg.y = msg.y && Buffer.isBuffer(msg.y) ? msg.y.toString() : msg.y;
			msg.q = msg.q && Buffer.isBuffer(msg.q) ? msg.q.toString() : msg.q;

			return msg;
		} catch (error) {
			if (this.options.debug) {
				console.log(error);
			}
		}

		return {};
	}

	addNode(node) {
		this.addNodes([node]);
	}

	addNodes(nodes) {
		this.nodes = [...this.nodes, ...nodes];
		while (this.nodes.length > this.options.maxNodes) {
			this.nodes.shift();
		}
	}

	getToken(infoHash) {
		return infoHash.slice(0, 10);
	}

	getTransactionId() {
		return getRandomId().slice(0, 4);
	}

	makeNeighbours() {
		this.nodes.forEach((node) => {
			this.findNode(node.id || getRandomId(), node);
		});
	}

	sendMessage(message, rinfo) {
		const buf = bencode.encode(message);

		this.socket.send(buf, 0, buf.length, rinfo.port, rinfo.address);
	}

	onListening() {
		this.emit('listening', this.options);
	}

	onError(error) {
		this.emit('error', error);
	}

	onMessage(message, rinfo) {
		this.emit('message', message, rinfo);
		const msg = this.decodeMessage(message);

		if (msg.y === 'r') {
			this.onResponse(msg, rinfo);
		} else if (msg.y === 'q') {
			this.onQuery(msg, rinfo);
		}
	}

	onResponse(message, rinfo) {
		this.emit('response', message, rinfo);

		if (message.r.token) {
			this.onGetPeersResponse(message, rinfo);
		} else if (message.r.nodes) {
			this.onFindNodeResponse(message, rinfo);
		} else {
			this.onPingOrAnnounceResponse(message, rinfo);
		}
	}

	onGetPeersResponse(message, rinfo) {
		this.emit('getPeersResponse', message, rinfo);
		if (message.r.values) {
			console.log('getPeersResponse - values', message.r.values);
		} else if (message.r.nodes) {
			const nodes = decompactNodes(message.r.nodes);

			this.addNodes(nodes);
		}
		this.addNode({ ...rinfo, id: message.r.id });
	}

	onFindNodeResponse(message, rinfo) {
		this.emit('findNodeResponse', message, rinfo);
		const nodes = decompactNodes(message.r.nodes);

		this.addNode({ ...rinfo, id: message.r.id });
		this.addNodes(nodes);
	}

	onPingOrAnnounceResponse(message, rinfo) {
		this.emit('pingOrAnnounceResponse', message, rinfo);
		this.addNode({ ...rinfo, id: message.r.id });
	}

	onQuery(message, rinfo) {
		this.emit('query', message, rinfo);

		if (message.q === 'find_node') {
			this.onFindNodeQuery(message, rinfo);
		} else if (message.q === 'get_peers') {
			this.onGetPeersQuery(message, rinfo);
		} else if (message.q === 'announce_peer') {
			this.onAnnouncePeerQuery(message, rinfo);
		} else if (message.q === 'ping') {
			this.onPingQuery(message, rinfo);
		}
	}

	onFindNodeQuery(message, rinfo) {
		this.emit('findNodeQuery', message, rinfo);

		const nodes = compactNodes(this.nodes.slice(0, 8));
		const t = this.getTransactionId();

		this.sendMessage({ r: { id: this.clientId, nodes }, t, y: 'r' }, rinfo);
	}

	onGetPeersQuery(message, rinfo) {
		this.emit('getPeersQuery', message, rinfo);

		const infoHash =
			message.a.info_hash && Buffer.isBuffer(message.a.info_hash)
				? message.a.info_hash.toString('hex')
				: message.a.info_hash;
		const nodes = compactNodes(this.nodes.slice(0, 8));
		const token = this.getToken(infoHash);
		const t = this.getTransactionId();

		this.sendMessage({ r: { id: this.clientId, nodes, token }, t, y: 'r' }, rinfo);
	}

	onAnnouncePeerQuery(message, rinfo) {
		this.emit('announcePeerQuery', message, rinfo);

		const t = this.getTransactionId();

		this.sendMessage({ r: { id: this.clientId }, t, y: 'r' }, rinfo);
	}

	onPingQuery(message, rinfo) {
		this.emit('pingQuery', message, rinfo);

		const t = this.getTransactionId();

		this.sendMessage({ r: { id: this.clientId }, t, y: 'r' }, rinfo);
	}

	query(type, ask, rinfo) {
		const t = this.getTransactionId();

		this.sendMessage({ a: ask, q: type, t, y: 'q' }, rinfo);
	}

	ping(rinfo) {
		const sendTo = rinfo || this.nodes[0];

		this.query('ping', { id: this.clientId }, sendTo);
	}

	findNode(nodeId, rinfo) {
		const sendTo = rinfo || this.nodes[0];

		this.query('find_node', { id: this.clientId, target: nodeId }, sendTo);
	}

	getPeers(infoHash, rinfo) {
		const sendTo = rinfo || this.nodes[0];

		this.query('get_peers', { id: this.clientId, info_hash: infoHash }, sendTo);
	}

	announcePeer(infoHash, rinfo) {
		const sendTo = rinfo || this.nodes[0];
		const token = this.getToken(infoHash);

		this.query('announce_peer', { id: this.clientId, implied_port: true, info_hash: infoHash, token }, sendTo);
	}
}

module.exports = DHT;
