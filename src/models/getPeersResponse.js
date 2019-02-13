const { array, buffer } = require('nativemodels/datatypes');

module.exports = {
	id: buffer(),
	nodes: buffer(),
	token: buffer(),
	values: array(),
};
