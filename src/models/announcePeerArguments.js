const { buffer, int } = require('nativemodels/datatypes');
const { enumerable } = require('nativemodels/customtypes');

module.exports = {
	id: buffer(),
	implied_port: enumerable([0, 1]),
	info_hash: buffer(),
	port: int(),
	token: buffer(),
};
