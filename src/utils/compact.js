const getRandomId = require('./getRandomId');

const compactIP = (address) => Buffer.from(address.split('.').map((value) => parseInt(value)));

const compactPort = (port) => Buffer.from(parseInt(port).toString(16), 'hex');

const compact = ({ address, id, port }) => Buffer.concat([id || getRandomId(), compactIP(address), compactPort(port)]);

const compactNodes = (nodes) => nodes.map((node) => compact(node));

module.exports = compactNodes;
