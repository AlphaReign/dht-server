/* eslint-disable camelcase */
const EventEmitter = require('events');
const bencode = require('bencode');
const compactNodes = require('./utils/compact');
const { createModel } = require('nativemodels');
const decompactNodes = require('./utils/decompact');
const dgram = require('dgram');
const getRandomId = require('./utils/getRandomId');

const announcePeerArgumentsSchema = require('./models/announcePeerArguments');
const announcePeerResponseSchema = require('./models/announcePeerResponse');
const findNodeResponseSchema = require('./models/findNodeResponse');
const fineNodeArgumentsSchema = require('./models/fineNodeArguments');
const getPeersArgumentsSchema = require('./models/getPeersArguments');
const getPeersResponseSchema = require('./models/getPeersResponse');
const messageSchema = require('./models/message');
const nodeSchema = require('./models/node');
const optionsSchema = require('./models/options');
const pingArgumentsSchema = require('./models/pingArguments');
const pingResponseSchema = require('./models/pingResponse');
const querySchema = require('./models/query');
const responseSchema = require('./models/response');

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
		this.buildModels();
		this.options = this.models.options({ ...defaultOptions, ...options });
		this.socket = dgram.createSocket('udp4');
		this.clientId = getRandomId();
		this.nodes = this.options.bootstrapNodes;
		this.socket.on('message', (message, rinfo) => this.onMessage(message, rinfo));
		this.socket.on('listening', () => this.onListening());
		this.socket.on('error', (error) => this.onError(error));
	}

	buildModels() {
		this.models = {
			announcePeerArguments: createModel(announcePeerArgumentsSchema),
			announcePeerResponse: createModel(announcePeerResponseSchema),
			findNodeResponse: createModel(findNodeResponseSchema),
			fineNodeArguments: createModel(fineNodeArgumentsSchema),
			getPeersArguments: createModel(getPeersArgumentsSchema),
			getPeersResponse: createModel(getPeersResponseSchema),
			message: createModel(messageSchema),
			node: createModel(nodeSchema),
			options: createModel(optionsSchema),
			pingArguments: createModel(pingArgumentsSchema),
			pingResponse: createModel(pingResponseSchema),
			query: createModel(querySchema),
			response: createModel(responseSchema),
		};
	}

	start() {
		this.socket.bind(this.options.port, this.options.address);
	}

	decodeMessage(message) {
		try {
			const msg = this.models.message(bencode.decode(message));

			return msg;
		} catch (error) {
			if (this.options.debug) {
				console.log(error);
			}
		}

		return {};
	}

	addNode(node) {
		this.addNodes([this.models.node(node)]);
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
		const msg = this.decodeMessage(message);

		this.emit('messageRaw', message, rinfo);
		this.emit('message', msg, rinfo);

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

	respond(response, rinfo) {
		const t = this.getTransactionId();
		const responseMessage = this.models.response({ r: response, t, y: 'r' });

		this.sendMessage(responseMessage, rinfo);
	}

	onFindNodeQuery(message, rinfo) {
		this.emit('findNodeQuery', message, rinfo);

		const nodes = compactNodes(this.nodes.slice(0, 8));
		const response = this.models.findNodeResponse({ id: this.clientId, nodes });

		this.respond(response, rinfo);
	}

	onGetPeersQuery(message, rinfo) {
		this.emit('getPeersQuery', message, rinfo);

		const infoHash =
			message.a.info_hash && Buffer.isBuffer(message.a.info_hash)
				? message.a.info_hash.toString('hex')
				: message.a.info_hash;
		const nodes = compactNodes(this.nodes.slice(0, 8));
		const token = this.getToken(infoHash);
		const response = this.models.getPeersResponse({ id: this.clientId, nodes, token });

		this.respond(response, rinfo);
	}

	onAnnouncePeerQuery(message, rinfo) {
		this.emit('announcePeerQuery', message, rinfo);

		const response = this.models.announcePeerResponse({ id: this.clientId });

		this.respond(response, rinfo);
	}

	onPingQuery(message, rinfo) {
		this.emit('pingQuery', message, rinfo);

		const response = this.models.pingResponse({ id: this.clientId });

		this.respond(response, rinfo);
	}

	query(type, args, rinfo) {
		const t = this.getTransactionId();
		const message = this.models.query({ a: args, q: type, t, y: 'q' });

		this.sendMessage(message, rinfo);
	}

	ping(rinfo) {
		const sendTo = rinfo || this.nodes[0];
		const args = this.models.pingArguments({ id: this.clientId });

		this.query('ping', args, sendTo);
	}

	findNode(nodeId, rinfo) {
		const sendTo = rinfo || this.nodes[0];
		const args = this.models.fineNodeArguments({ id: this.clientId, target: nodeId });

		this.query('find_node', args, sendTo);
	}

	getPeers(infoHash, rinfo) {
		const sendTo = rinfo || this.nodes[0];
		const args = this.models.getPeersArguments({ id: this.clientId, info_hash: infoHash });

		this.query('get_peers', args, sendTo);
	}

	announcePeer(infoHash, rinfo) {
		const sendTo = rinfo || this.nodes[0];
		const token = this.getToken(infoHash);
		const args = this.models.announcePeerArguments({
			id: this.clientId,
			implied_port: true,
			info_hash: infoHash,
			token,
		});

		this.query('announce_peer', args, sendTo);
	}
}

module.exports = DHT;
