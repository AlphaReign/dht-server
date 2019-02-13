const { array, boolean, int, object, string } = require('nativemodels/datatypes');

module.exports = {
	address: string(),
	bootstrapNodes: array(
		object({
			address: string(),
			port: int(),
		}),
	),
	debug: boolean(),
	maxNodes: int(),
	port: int(),
};
